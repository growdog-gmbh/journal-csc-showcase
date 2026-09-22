import { ScrollArea } from "@carbide/core";
import { CheckmarkFilled, WarningAltFilled } from "@carbon/icons-react";
import type { ReactNode } from "react";
import type { CultivationRoomData } from "../../components/rooms/cultivation-room/types.js";
import type { DryingRoomData } from "../../components/rooms/drying-room/types.js";
import type { MotherRoomData } from "../../components/rooms/mother-room/types.js";
import type { PropagationRoomData } from "../../components/rooms/propagation-room/types.js";
import { daysSince, hoursSince, lightHours } from "../../components/rooms/shared/schedule.js";
import { t } from "../../i18n/t.js";
import styles from "./RoomTable.module.css";
import { benchReadings, motherReadings, rackReadings, shelfReadings } from "./readings.js";
import { formatAgo, formatDay, headcount } from "./summary.js";
import table from "./Table.module.css";
import type { RoomRecord, RoomView } from "./types.js";

export interface RoomTableProps {
  room: RoomRecord;
  selectedUnitId: string | null;
  onSelectUnit: (id: string) => void;
  now: number;
}

// Unit ids are what the page selects: the bench id, the mother plant id,
// "<rack>:<level>" for a shelf, the rack id in the drying room.
export function shelfUnitId(rackId: string, level: number): string {
  return `${rackId}:${level}`;
}

interface StatProps {
  label: string;
  children: ReactNode;
}

function Stat({ label, children }: StatProps) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{children}</div>
    </div>
  );
}

// The head of the room panel, in the tile's language: name in brand,
// the counts, then the stats -- but as plain readings, the detail lives
// in the panels around it.
function RoomHead({ view, openTasks }: { view: RoomView; openTasks: number }) {
  const count = headcount(view);
  const lights =
    view.kind === "drying" ? null : lightHours(view.data.lightsOn, view.data.lightsOff);
  const units =
    view.kind === "cultivation"
      ? { n: view.data.benches.length, key: "roomsPage.units.benches" as const }
      : view.kind === "mother"
        ? { n: view.data.plants.length, key: "roomsPage.units.plants" as const }
        : { n: view.data.racks.length, key: "roomsPage.units.racks" as const };

  return (
    <div className={styles.head}>
      <div className={styles.identity}>
        <div className={styles.roomName}>{view.data.name}</div>
        <div className={styles.roomMeta}>
          <span>
            <span className={styles.num}>{units.n}</span> {t(units.key, { count: units.n })}
          </span>
          <span>
            <span className={styles.num}>{count.plantCount}</span>{" "}
            {t("roomsPage.plants", { count: count.plantCount })}
          </span>
        </div>
      </div>
      <div className={styles.stats}>
        {view.kind === "cultivation" && (
          <Stat label={t("roomsPage.head.stage")}>
            <span className={table.stage} data-stage={view.data.stage}>
              {view.data.stage === "flower"
                ? t("roomsPage.stage.flower")
                : t("roomsPage.stage.vegetation")}
            </span>
            <span className={styles.statMuted}>
              {t("roomsPage.charge.dayOf", {
                day: view.data.stageDay,
                total: view.data.stageTotal + view.data.stageExtension,
              })}
            </span>
          </Stat>
        )}
        {lights !== null && (
          <Stat label={t("roomsPage.head.light")}>
            <span className={styles.light}>{lights}</span>
            <span className={styles.statMuted}>
              {view.kind === "drying" ? "" : `${view.data.lightsOn}–${view.data.lightsOff}`}
            </span>
          </Stat>
        )}
        {view.kind === "drying" && (
          <Stat label={t("roomsPage.head.dark")}>
            <span className={styles.num}>
              {view.data.darkSince === null ? "–" : hoursSince(view.data.darkSince, new Date())}
            </span>
            <span className={styles.statMuted}>h</span>
          </Stat>
        )}
        <Stat label={t("roomsPage.head.health")}>
          <span className={count.sickCount > 0 ? table.warn : table.ok}>
            {count.sickCount > 0 ? <WarningAltFilled size={14} /> : <CheckmarkFilled size={14} />}
            <span className={styles.num}>{count.sickCount}</span>
          </span>
        </Stat>
        <Stat label={t("roomsPage.head.tasks")}>
          <span className={styles.num}>{openTasks}</span>
        </Stat>
      </div>
    </div>
  );
}

function Bar({ share, tone }: { share: number; tone: "ok" | "warning" | "neutral" }) {
  return (
    <span className={table.bar}>
      <span
        className={table.barFill}
        data-tone={tone}
        style={{ width: `${Math.min(100, Math.max(0, share * 100))}%` }}
      />
    </span>
  );
}

interface RowProps {
  id: string;
  selected: boolean;
  onSelect: (id: string) => void;
  children: ReactNode;
}

function Row({ id, selected, onSelect, children }: RowProps) {
  return (
    <tr
      className={table.row}
      data-selected={selected || undefined}
      tabIndex={0}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(id);
        }
      }}
    >
      {children}
    </tr>
  );
}

function Warn({ count }: { count: number }) {
  return count > 0 ? (
    <span className={table.warn}>
      <WarningAltFilled size={12} />
      {count}
    </span>
  ) : (
    <span className={table.muted}>0</span>
  );
}

// ---- cultivation: one row per bench --------------------------------------

function BenchRows({
  data,
  selectedUnitId,
  onSelectUnit,
  now,
}: { data: CultivationRoomData } & Omit<RoomTableProps, "room">) {
  return (
    <table className={table.table}>
      <thead>
        <tr>
          <th>#</th>
          <th>{t("roomsPage.col.cultivar")}</th>
          <th>{t("roomsPage.col.charge")}</th>
          <th className={table.num}>{t("roomsPage.col.plants")}</th>
          <th className={table.num}>{t("roomsPage.col.warnings")}</th>
          <th className={table.num}>{t("roomsPage.col.leaf")}</th>
          <th className={table.num}>{t("roomsPage.col.vpd")}</th>
          <th className={table.num}>{t("roomsPage.col.vwc")}</th>
          <th className={table.num}>{t("roomsPage.col.bulkEc")}</th>
          <th className={table.num}>{t("roomsPage.col.poreEc")}</th>
          <th className={table.num}>{t("roomsPage.col.ph")}</th>
          <th className={table.num}>{t("roomsPage.col.height")}</th>
          <th className={table.num}>{t("roomsPage.col.irrigated")}</th>
        </tr>
      </thead>
      <tbody>
        {data.benches.map((bench, index) => {
          const r = benchReadings(bench, now);
          return (
            <Row
              key={bench.id}
              id={bench.id}
              selected={bench.id === selectedUnitId}
              onSelect={onSelectUnit}
            >
              <td className={table.num}>{index + 1}</td>
              <td className={table.text}>{bench.cultivar}</td>
              <td className={table.mono}>{bench.chargeCode}</td>
              <td className={table.num}>{bench.plantCount}</td>
              <td className={table.num}>
                <Warn count={bench.sickCount} />
              </td>
              <td className={table.num} data-status={r.leafTemperature.status}>
                {r.leafTemperature.value.toFixed(1)}
              </td>
              <td className={table.num} data-status={r.vpd.status}>
                {r.vpd.value.toFixed(2)}
              </td>
              <td className={table.num} data-status={r.vwc.status}>
                {r.vwc.value.toFixed(0)}
              </td>
              <td className={table.num} data-status={r.bulkEc.status}>
                {r.bulkEc.value.toFixed(2)}
              </td>
              <td className={table.num} data-status={r.poreEc.status}>
                {r.poreEc.value.toFixed(2)}
              </td>
              <td className={table.num} data-status={r.ph.status}>
                {r.ph.value.toFixed(1)}
              </td>
              <td className={table.num}>{r.heightCm}</td>
              <td className={table.num}>{formatAgo(r.lastIrrigationAt, now)}</td>
            </Row>
          );
        })}
      </tbody>
    </table>
  );
}

// ---- mother plants: one row per plant -----------------------------------

function MotherRows({
  data,
  selectedUnitId,
  onSelectUnit,
  now,
}: { data: MotherRoomData } & Omit<RoomTableProps, "room">) {
  const today = new Date(now);
  return (
    <table className={table.table}>
      <thead>
        <tr>
          <th>{t("roomsPage.col.plant")}</th>
          <th>{t("roomsPage.col.cultivar")}</th>
          <th>{t("roomsPage.col.charge")}</th>
          <th>{t("roomsPage.col.health")}</th>
          <th className={table.num}>{t("roomsPage.col.leaf")}</th>
          <th className={table.num}>{t("roomsPage.col.vpd")}</th>
          <th className={table.num}>{t("roomsPage.col.vwc")}</th>
          <th className={table.num}>{t("roomsPage.col.poreEc")}</th>
          <th className={table.num}>{t("roomsPage.col.ph")}</th>
          <th className={table.num}>{t("roomsPage.col.irrigated")}</th>
          <th className={table.num}>{t("roomsPage.col.inService")}</th>
          <th className={table.num}>{t("roomsPage.col.lastCut")}</th>
          <th className={table.num}>{t("roomsPage.col.sinceCut")}</th>
          <th className={table.num}>{t("roomsPage.col.cuttings")}</th>
          <th className={table.num}>{t("roomsPage.col.perWeek")}</th>
        </tr>
      </thead>
      <tbody>
        {data.plants.map((plant) => {
          const inService = daysSince(plant.motherSince, today);
          const sinceCut = daysSince(plant.lastCut, today);
          const perWeek = inService > 0 ? (plant.cuttingsTotal / inService) * 7 : 0;
          const r = motherReadings(plant, now);
          return (
            <Row
              key={plant.id}
              id={plant.id}
              selected={plant.id === selectedUnitId}
              onSelect={onSelectUnit}
            >
              <td className={`${table.text} ${table.mono}`}>{plant.id}</td>
              <td className={table.text}>{plant.cultivar}</td>
              <td className={table.mono}>{plant.chargeCode}</td>
              <td>
                {plant.health === "warning" ? (
                  <span className={table.warn}>
                    <WarningAltFilled size={12} />
                    {t("roomsPage.health.warning")}
                  </span>
                ) : (
                  <span className={table.ok}>
                    <CheckmarkFilled size={12} />
                  </span>
                )}
              </td>
              <td className={table.num} data-status={r.leafTemperature.status}>
                {r.leafTemperature.value.toFixed(1)}
              </td>
              <td className={table.num} data-status={r.vpd.status}>
                {r.vpd.value.toFixed(2)}
              </td>
              <td className={table.num} data-status={r.vwc.status}>
                {r.vwc.value.toFixed(0)}
              </td>
              <td className={table.num} data-status={r.poreEc.status}>
                {r.poreEc.value.toFixed(2)}
              </td>
              <td className={table.num} data-status={r.ph.status}>
                {r.ph.value.toFixed(1)}
              </td>
              <td className={table.num}>{formatAgo(r.lastIrrigationAt, now)}</td>
              <td className={table.num}>{inService} d</td>
              <td className={table.num}>{formatDay(plant.lastCut)}</td>
              <td className={table.num} data-status={sinceCut > 10 ? "warning" : "ok"}>
                {sinceCut} d
              </td>
              <td className={table.num}>{plant.cuttingsTotal}</td>
              <td className={table.num}>{perWeek.toFixed(1)}</td>
            </Row>
          );
        })}
      </tbody>
    </table>
  );
}

// ---- propagation: one row per shelf --------------------------------------

function ShelfRows({
  data,
  selectedUnitId,
  onSelectUnit,
}: { data: PropagationRoomData } & Omit<RoomTableProps, "room">) {
  return (
    <table className={table.table}>
      <thead>
        <tr>
          <th>{t("roomsPage.col.rack")}</th>
          <th className={table.num}>{t("roomsPage.col.level")}</th>
          <th>{t("roomsPage.col.kind")}</th>
          <th>{t("roomsPage.col.charge")}</th>
          <th className={table.num}>{t("roomsPage.col.plants")}</th>
          <th>{t("roomsPage.col.fill")}</th>
          <th className={table.num}>{t("roomsPage.col.warnings")}</th>
          <th className={table.num}>{t("roomsPage.col.day")}</th>
          <th>{t("roomsPage.col.rooted")}</th>
          <th className={table.num}>{t("roomsPage.col.moisture")}</th>
        </tr>
      </thead>
      <tbody>
        {data.racks.flatMap((rack) =>
          rack.shelves.map((shelf) => {
            const id = shelfUnitId(rack.id, shelf.level);
            const empty = shelf.chargeCode === "";
            const r = empty ? null : shelfReadings(rack, shelf);
            return (
              <Row key={id} id={id} selected={id === selectedUnitId} onSelect={onSelectUnit}>
                <td className={table.text}>{rack.name}</td>
                <td className={table.num}>{shelf.level}</td>
                <td className={table.stage} data-stage={rack.kind}>
                  {rack.kind === "clone"
                    ? t("roomsPage.stage.clone")
                    : t("roomsPage.stage.seedling")}
                </td>
                <td className={table.mono}>
                  {empty ? (
                    <span className={table.muted}>{t("roomsPage.shelf.empty")}</span>
                  ) : (
                    shelf.chargeCode
                  )}
                </td>
                <td className={table.num}>
                  {shelf.plantCount}
                  <span className={table.muted}>/{shelf.capacity}</span>
                </td>
                <td>
                  <Bar share={shelf.plantCount / shelf.capacity} tone={empty ? "neutral" : "ok"} />
                </td>
                <td className={table.num}>
                  <Warn count={shelf.sickCount} />
                </td>
                <td className={table.num}>{r === null ? "–" : r.day}</td>
                <td>
                  {r === null ? (
                    <span className={table.muted}>–</span>
                  ) : (
                    <>
                      <Bar
                        share={r.rootedPercent / 100}
                        tone={r.day > 10 && r.rootedPercent < 60 ? "warning" : "ok"}
                      />
                      <span className={table.num}>{r.rootedPercent} %</span>
                    </>
                  )}
                </td>
                <td className={table.num} data-status={r?.moisture.status}>
                  {r === null ? "–" : r.moisture.value.toFixed(0)}
                </td>
              </Row>
            );
          }),
        )}
      </tbody>
    </table>
  );
}

// ---- drying: one row per rack -------------------------------------------

function RackRows({
  data,
  selectedUnitId,
  onSelectUnit,
  now,
}: { data: DryingRoomData } & Omit<RoomTableProps, "room">) {
  const today = new Date(now);
  return (
    <table className={table.table}>
      <thead>
        <tr>
          <th>{t("roomsPage.col.rack")}</th>
          <th>{t("roomsPage.col.charge")}</th>
          <th>{t("roomsPage.col.cultivar")}</th>
          <th className={table.num}>{t("roomsPage.col.plants")}</th>
          <th>{t("roomsPage.col.fill")}</th>
          <th className={table.num}>{t("roomsPage.col.hungOn")}</th>
          <th className={table.num}>{t("roomsPage.col.day")}</th>
          <th className={table.num}>{t("roomsPage.col.moisture")}</th>
          <th className={table.num}>{t("roomsPage.col.snapTest")}</th>
        </tr>
      </thead>
      <tbody>
        {data.racks.map((rack) => {
          const plants = rack.levels.reduce((sum, level) => sum + level.plantCount, 0);
          const capacity = rack.levels.reduce((sum, level) => sum + level.capacity, 0);
          const chargeCode = rack.levels.find((level) => level.chargeCode !== "")?.chargeCode ?? "";
          const charge = data.charges.find((entry) => entry.chargeCode === chargeCode);
          const day = charge === undefined ? 0 : daysSince(charge.hungOn, today);
          const r = charge === undefined ? null : rackReadings(rack, day);
          return (
            <Row
              key={rack.id}
              id={rack.id}
              selected={rack.id === selectedUnitId}
              onSelect={onSelectUnit}
            >
              <td className={table.text}>{rack.name}</td>
              <td className={table.mono}>
                {chargeCode === "" ? <span className={table.muted}>–</span> : chargeCode}
              </td>
              <td className={table.text}>{charge?.cultivar ?? ""}</td>
              <td className={table.num}>
                {plants}
                <span className={table.muted}>/{capacity}</span>
              </td>
              <td>
                <Bar share={capacity > 0 ? plants / capacity : 0} tone="neutral" />
              </td>
              <td className={table.num}>{charge === undefined ? "–" : formatDay(charge.hungOn)}</td>
              <td className={table.num}>{charge === undefined ? "–" : day}</td>
              <td className={table.num} data-status={r?.moisture.status}>
                {r === null ? "–" : `${r.moisture.value.toFixed(0)} %`}
              </td>
              <td className={table.num}>
                {r?.snapTestOn === undefined || r.snapTestOn === null ? (
                  <span className={table.muted}>–</span>
                ) : (
                  formatDay(r.snapTestOn)
                )}
              </td>
            </Row>
          );
        })}
      </tbody>
    </table>
  );
}

// The room as a table: the tile's head over one row per unit with the
// readings the tile only hints at. A row picked here opens that unit's
// record in the panel on the right.
export function RoomTable({ room, selectedUnitId, onSelectUnit, now }: RoomTableProps) {
  const { view } = room;
  const rows = {
    cultivation: view.kind === "cultivation" && (
      <BenchRows
        data={view.data}
        selectedUnitId={selectedUnitId}
        onSelectUnit={onSelectUnit}
        now={now}
      />
    ),
    mother: view.kind === "mother" && (
      <MotherRows
        data={view.data}
        selectedUnitId={selectedUnitId}
        onSelectUnit={onSelectUnit}
        now={now}
      />
    ),
    propagation: view.kind === "propagation" && (
      <ShelfRows
        data={view.data}
        selectedUnitId={selectedUnitId}
        onSelectUnit={onSelectUnit}
        now={now}
      />
    ),
    drying: view.kind === "drying" && (
      <RackRows
        data={view.data}
        selectedUnitId={selectedUnitId}
        onSelectUnit={onSelectUnit}
        now={now}
      />
    ),
  }[view.kind];

  return (
    <div className={styles.panel}>
      <RoomHead view={view} openTasks={room.tasks.length} />
      <ScrollArea axis="both" className={table.wrap}>
        {rows}
      </ScrollArea>
    </div>
  );
}
