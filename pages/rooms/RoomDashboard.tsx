import { BoardWidget } from "@carbide/shell";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { t } from "../../i18n/t.js";
import { ChargeList } from "./ChargeList.js";
import { DocumentModal } from "./DocumentModal.js";
import { ObservationModal } from "./ObservationModal.js";
import { ROOMS, roomById } from "./placeholderRoom.js";
import { motherAsPlant, plantsOnBench, plantsOnShelf } from "./plants.js";
import { RoomList } from "./RoomList.js";
import { RoomLog } from "./RoomLog.js";
import { RoomTable, shelfUnitId } from "./RoomTable.js";
import { RoomTrend, type TrendScope } from "./RoomTrend.js";
import { roomHealth, roomListEntry } from "./summary.js";
import { TaskModal, type TaskSubject } from "./TaskModal.js";
import type {
  JournalEntry,
  ObservationRecord,
  PlantDocument,
  PlantRecord,
  RoomRecord,
  RoomTask,
} from "./types.js";
import { BenchDetail, MotherDetail, RackDetail, ShelfDetail } from "./UnitDetail.js";

export interface RoomDashboardProps {
  roomId: string;
}

// One room, five panels on the 24x20 board: the room list down the left
// edge, the room as a table top centre, the picked unit's record (or the
// charge list) to the right, the trend under the table and the
// health-tasks-journal log under that.
//
// Drill-down lives in the page's own state: a unit picked in the table
// (bench, mother plant, shelf, drying rack) opens its record and scopes
// the trend; a plant picked in that record narrows the log to the plant.
// Tasks raised on the page are kept here too until a backend keeps them.
// Everything resets with the room (the routes key the page by roomId).
export function RoomDashboard({ roomId }: RoomDashboardProps) {
  const navigate = useNavigate();
  const room = roomById(roomId);
  const [now] = useState(() => Date.now());
  const [unitId, setUnitId] = useState<string | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [raised, setRaised] = useState<RoomTask[]>([]);
  const [observed, setObserved] = useState<ObservationRecord[]>([]);
  const [added, setAdded] = useState<PlantDocument[]>([]);
  const [modal, setModal] = useState<ModalState>({ kind: null, initial: null });
  const entries = ROOMS.map(roomListEntry);

  function openRoom(id: string) {
    void navigate({ to: "/rooms/$roomId", params: { roomId: id } });
  }

  function openCharge(code: string) {
    void navigate({ to: "/charges/$chargeId", params: { chargeId: code } });
  }

  function selectUnit(id: string) {
    setUnitId((current) => (current === id ? null : id));
    setPlantId(null);
  }

  function leaveUnit() {
    setUnitId(null);
    setPlantId(null);
  }

  return (
    <>
      <BoardWidget data-surface="glass" h={20} w={4} x={1} y={1}>
        <RoomList rooms={entries} selectedId={roomId} onSelect={openRoom} />
      </BoardWidget>

      {room === undefined ? (
        <BoardWidget data-surface="glass" h={4} w={20} x={5} y={1}>
          <p>{t("roomsPage.unknownRoom", { id: roomId })}</p>
        </BoardWidget>
      ) : (
        <RoomPanels
          room={room}
          now={now}
          unitId={unitId}
          plantId={plantId}
          raised={raised}
          observed={observed}
          added={added}
          modal={modal}
          onSelectUnit={selectUnit}
          onLeaveUnit={leaveUnit}
          onSelectPlant={setPlantId}
          onOpenCharge={openCharge}
          onOpenModal={(kind, initial) => setModal({ kind, initial })}
          onCloseModal={() => setModal({ kind: null, initial: null })}
          onCreateTask={(task) => setRaised((current) => [...current, task])}
          onCreateObservation={(observation) => setObserved((current) => [...current, observation])}
          onAddDocument={(document) =>
            setAdded((current) => [
              ...current.filter((entry) => entry.id !== document.id),
              document,
            ])
          }
        />
      )}
    </>
  );
}

type ModalKind = "tasks" | "observations" | "documents" | null;

interface ModalState {
  kind: ModalKind;
  initial: string | "new" | null;
}

interface RoomPanelsProps {
  room: RoomRecord;
  now: number;
  unitId: string | null;
  plantId: string | null;
  raised: readonly RoomTask[];
  observed: readonly ObservationRecord[];
  added: readonly PlantDocument[];
  modal: ModalState;
  onSelectUnit: (id: string) => void;
  onLeaveUnit: () => void;
  onSelectPlant: (id: string | null) => void;
  onOpenCharge: (code: string) => void;
  onOpenModal: (kind: ModalKind, initial: string | "new" | null) => void;
  onCloseModal: () => void;
  onCreateTask: (task: RoomTask) => void;
  onCreateObservation: (observation: ObservationRecord) => void;
  onAddDocument: (document: PlantDocument) => void;
}

// An observation raised on the page, as the room journal lists it.
function asJournalEntry(observation: ObservationRecord): JournalEntry {
  return {
    id: observation.id,
    at: observation.at,
    kind: "observation",
    author: observation.author,
    text: observation.text,
    chargeCode: observation.chargeCode,
  };
}

// The picked unit resolved against the room: what the record panel shows,
// which plants it lists, and what the trend is scoped to.
interface Selection {
  panel: React.ReactNode;
  plants: readonly PlantRecord[];
  // A mother plant is a unit and a plant at once: the log reads it.
  unitAsPlant: PlantRecord | null;
  trendScope: TrendScope | null;
  subject: TaskSubject | null;
}

function resolveSelection(
  room: RoomRecord,
  unitId: string | null,
  plantId: string | null,
  now: number,
  onSelectPlant: (id: string | null) => void,
  onLeaveUnit: () => void,
): Selection {
  const none: Selection = {
    panel: null,
    plants: [],
    unitAsPlant: null,
    trendScope: null,
    subject: null,
  };
  if (unitId === null) return none;
  const { view } = room;
  const rows = { selectedPlantId: plantId, onSelectPlant, now, onBack: onLeaveUnit };

  switch (view.kind) {
    case "cultivation": {
      const index = view.data.benches.findIndex((bench) => bench.id === unitId);
      const bench = view.data.benches[index];
      if (bench === undefined) return none;
      const plants = plantsOnBench(bench, now);
      const label = t("roomsPage.bench", { n: index + 1 });
      return {
        panel: <BenchDetail bench={bench} benchNumber={index + 1} plants={plants} {...rows} />,
        plants,
        unitAsPlant: null,
        trendScope: { benchId: bench.id, label },
        subject: {
          value: `unit:${bench.id}`,
          label: `${label} · ${bench.cultivar}`,
          chargeCode: bench.chargeCode,
          plantId: null,
        },
      };
    }
    case "mother": {
      const plant = view.data.plants.find((entry) => entry.id === unitId);
      if (plant === undefined) return none;
      return {
        panel: <MotherDetail plant={plant} now={now} onBack={onLeaveUnit} />,
        plants: [],
        unitAsPlant: motherAsPlant(plant, now),
        trendScope: { benchId: plant.id, label: plant.id },
        subject: {
          value: `unit:${plant.id}`,
          label: `${plant.id} · ${plant.cultivar}`,
          chargeCode: plant.chargeCode,
          plantId: plant.id,
        },
      };
    }
    case "propagation": {
      for (const rack of view.data.racks) {
        for (const shelf of rack.shelves) {
          if (shelfUnitId(rack.id, shelf.level) !== unitId) continue;
          const cultivar =
            room.charges.find((charge) => charge.code === shelf.chargeCode)?.cultivar ?? "";
          const plants = shelf.chargeCode === "" ? [] : plantsOnShelf(rack, shelf, cultivar, now);
          const label = `${rack.name} · ${t("roomsPage.shelf.level", { n: shelf.level })}`;
          return {
            panel: (
              <ShelfDetail
                rack={rack}
                shelf={shelf}
                cultivar={cultivar}
                plants={plants}
                {...rows}
              />
            ),
            plants,
            unitAsPlant: null,
            trendScope: null,
            subject: {
              value: `unit:${unitId}`,
              label,
              chargeCode: shelf.chargeCode === "" ? null : shelf.chargeCode,
              plantId: null,
            },
          };
        }
      }
      return none;
    }
    case "drying": {
      const rack = view.data.racks.find((entry) => entry.id === unitId);
      if (rack === undefined) return none;
      const chargeCode = rack.levels.find((level) => level.chargeCode !== "")?.chargeCode ?? null;
      return {
        panel: (
          <RackDetail rack={rack} charges={view.data.charges} now={now} onBack={onLeaveUnit} />
        ),
        plants: [],
        unitAsPlant: null,
        trendScope: null,
        subject: { value: `unit:${rack.id}`, label: rack.name, chargeCode, plantId: null },
      };
    }
  }
}

function RoomPanels({
  room,
  now,
  unitId,
  plantId,
  raised,
  observed,
  added,
  modal,
  onSelectUnit,
  onLeaveUnit,
  onSelectPlant,
  onOpenCharge,
  onOpenModal,
  onCloseModal,
  onCreateTask,
  onCreateObservation,
  onAddDocument,
}: RoomPanelsProps) {
  const { view } = room;
  const selection = resolveSelection(room, unitId, plantId, now, onSelectPlant, onLeaveUnit);
  const pickedPlant =
    selection.plants.find((entry) => entry.id === plantId) ?? selection.unitAsPlant;
  // Tasks raised on the page join the room's own; a plant's view adds the
  // ones raised on that plant to the ones it came with.
  const roomTasks = [...room.tasks, ...raised];
  const plant =
    pickedPlant === null || pickedPlant === undefined
      ? null
      : {
          ...pickedPlant,
          tasks: [
            ...pickedPlant.tasks,
            ...raised.filter((task) => task.plantId === pickedPlant.id),
          ],
          observations: [
            ...pickedPlant.observations,
            ...observed.filter((entry) => entry.plantIds.includes(pickedPlant.id)),
          ],
          // A re-upload under the same name replaces the earlier version.
          documents: [
            ...pickedPlant.documents.filter((entry) => !added.some((late) => late.id === entry.id)),
            ...added.filter((entry) => entry.plantId === pickedPlant.id),
          ],
        };
  const allTasks = [...roomTasks, ...selection.plants.flatMap((entry) => entry.tasks)];
  const allObservations = [
    ...selection.plants.flatMap((entry) => entry.observations),
    ...(selection.unitAsPlant?.observations ?? []),
    ...observed,
  ];
  const journal = [...room.journal, ...observed.map(asJournalEntry)];

  const subjects: TaskSubject[] = [
    { value: "room", label: view.data.name, chargeCode: null, plantId: null },
    ...room.charges.map((charge) => ({
      value: `charge:${charge.code}`,
      label: `${charge.code} · ${charge.cultivar}`,
      chargeCode: charge.code,
      plantId: null,
    })),
    ...(selection.subject === null ? [] : [selection.subject]),
    ...(plant === null || plant.id === selection.unitAsPlant?.id
      ? []
      : [
          {
            value: `plant:${plant.id}`,
            label: `${t("roomsPage.plant")} ${plant.id}`,
            chargeCode: plant.chargeCode,
            plantId: plant.id,
          },
        ]),
  ];
  const defaultSubject = subjects.at(-1)?.value ?? "room";

  return (
    <>
      <BoardWidget data-surface="glass" h={10} w={12} x={5} y={1}>
        <RoomTable room={room} selectedUnitId={unitId} onSelectUnit={onSelectUnit} now={now} />
      </BoardWidget>

      <BoardWidget data-surface="glass" h={10} w={8} x={17} y={1}>
        {selection.panel ?? (
          <ChargeList charges={room.charges} roomKind={view.kind} now={now} onOpen={onOpenCharge} />
        )}
      </BoardWidget>

      <BoardWidget data-surface="glass" h={10} w={12} x={5} y={11}>
        <RoomTrend roomId={room.id} view={view} scope={selection.trendScope} now={now} />
      </BoardWidget>

      <BoardWidget data-surface="glass" h={10} w={8} x={17} y={11}>
        <RoomLog
          health={roomHealth(view)}
          tasks={roomTasks}
          journal={journal}
          plant={plant}
          now={now}
          onOpenTask={(id) => onOpenModal("tasks", id)}
          onNewTask={() => onOpenModal("tasks", "new")}
          onOpenObservation={(id) => onOpenModal("observations", id)}
          onNewObservation={() => onOpenModal("observations", "new")}
          onOpenDocuments={() => onOpenModal("documents", null)}
          onLeavePlant={() => (plantId === null ? onLeaveUnit() : onSelectPlant(null))}
        />
      </BoardWidget>

      {modal.kind === "tasks" && (
        <TaskModal
          open
          onOpenChange={(open) => {
            if (!open) onCloseModal();
          }}
          tasks={allTasks}
          initial={modal.initial}
          subjects={subjects}
          defaultSubject={defaultSubject}
          onCreate={onCreateTask}
        />
      )}
      {modal.kind === "observations" && (
        <ObservationModal
          open
          onOpenChange={(open) => {
            if (!open) onCloseModal();
          }}
          observations={allObservations}
          initial={modal.initial}
          subjects={subjects}
          defaultSubject={defaultSubject}
          now={now}
          onCreate={onCreateObservation}
        />
      )}
      {modal.kind === "documents" && plant !== null && (
        <DocumentModal
          open
          onOpenChange={(open) => {
            if (!open) onCloseModal();
          }}
          plantId={plant.id}
          documents={plant.documents}
          now={now}
          onAdd={onAddDocument}
        />
      )}
    </>
  );
}
