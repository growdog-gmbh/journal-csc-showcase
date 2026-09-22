import { Popover } from "@carbide/core";
import { Activity, CheckmarkFilled, TaskBlank, WarningAltFilled } from "@carbon/icons-react";
import { type ReactNode, useRef } from "react";
import { t } from "../../../i18n/t.js";
import { ClimateStrip } from "../shared/climate-strip/ClimateStrip.js";
import { formatCountdown, lightHours } from "../shared/schedule.js";
import { useSecondsUntil } from "../shared/useCountdown.js";
import { BenchGridCR } from "./bench-cr/BenchGridCR.js";
import styles from "./CultivationRoom.module.css";
import type { CultivationRoomData, GrowthStage } from "./types.js";

const STATUS_TOKEN = {
  ok: "var(--cultivation-room-status-ok)",
  warning: "var(--cultivation-room-status-warning)",
  neutral: "var(--cultivation-room-line-strong)",
} as const;

const STAGE_LABEL: Record<GrowthStage, string> = {
  flower: t("cultivationRoom.stage.flower"),
  vegetation: t("cultivationRoom.stage.vegetation"),
};

export interface CultivationRoomProps {
  room: CultivationRoomData;
  // Hands bench clicks to the page instead of opening the charge popover;
  // the page then shows the bench's own record. Off on the dashboard.
  onBenchSelect?: ((benchId: string) => void) | undefined;
  selectedBenchId?: string | undefined;
}

interface HeaderStatProps {
  label: string;
  icon?: ReactNode;
  tone: keyof typeof STATUS_TOKEN;
  popover: ReactNode;
  portalRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

// One entry of the header's status line: an eyebrow label over a value,
// with an icon only where a count needs one to be legible on its own.
// Deliberately not a chip -- these are readings, not controls.
// Popover wires the button up as its trigger itself: a click toggles, a
// click anywhere else closes. No hover: popping open while the eye merely
// passes over a room is noise, not information.
// Every value sits centred under its label; an icon pins to the box's
// left edge instead of pushing the value off centre.
function HeaderStat({ label, icon, tone, popover, portalRef, children }: HeaderStatProps) {
  return (
    <Popover
      placement="bottom"
      borderColor={STATUS_TOKEN[tone]}
      autoFocus={false}
      container={portalRef}
      content={popover}
    >
      <button type="button" className={styles.stat}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>
          {icon !== undefined && (
            <span className={styles.statIcon} data-tone={tone}>
              {icon}
            </span>
          )}
          {children}
        </div>
      </button>
    </Popover>
  );
}

export function CultivationRoom({ room, onBenchSelect, selectedBenchId }: CultivationRoomProps) {
  const lightsOffCountdown = useSecondsUntil(room.lightsOff);
  // Popover content portals to document.body by default, which is outside
  // .cultivationRoom in the DOM and can't see its component tokens
  // (--cultivation-room-*). Anchoring the portal here keeps them in scope.
  const containerRef = useRef<HTMLDivElement>(null);

  const benchCount = room.benches.length;
  const plantCount = room.benches.reduce((sum, bench) => sum + bench.plantCount, 0);
  const sickCount = room.benches.reduce((sum, bench) => sum + bench.sickCount, 0);
  const healthyPlants = plantCount - sickCount;
  const stagePlanned = room.stageTotal + room.stageExtension;
  const stageProgress = Math.min(1, room.stageDay / stagePlanned);
  const photoperiod = lightHours(room.lightsOn, room.lightsOff);

  return (
    <div className={styles.cultivationRoom} ref={containerRef}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.roomName}>{room.name}</div>
          <div className={styles.roomMeta}>
            <span>
              <span className={styles.num}>{benchCount}</span>{" "}
              {t("cultivationRoom.benches", { count: benchCount })}
            </span>
            <span>
              <span className={styles.num}>{plantCount}</span>{" "}
              {t("cultivationRoom.plants", { count: plantCount })}
            </span>
          </div>
        </div>

        <div className={styles.stats}>
          {/* every bench in this room is in the same stage */}
          <HeaderStat
            label={t("cultivationRoom.growthStage")}
            tone="neutral"
            portalRef={containerRef}
            popover={
              <div className={styles.popover}>
                <div className={styles.popoverHead}>
                  <span className={styles.popoverTitle}>{t("cultivationRoom.growthStage")}</span>
                  <span className={styles.stageWord} data-stage={room.stage}>
                    {STAGE_LABEL[room.stage]}
                  </span>
                </div>
                <div className={styles.popoverValue}>
                  <span>{room.stageDay}</span>
                  <span className={styles.popoverValueMuted}>/ {stagePlanned}</span>
                  <span className={styles.popoverValueUnit}>d</span>
                  {room.stageExtension > 0 && (
                    // Green regardless of stage: it marks days added on top of the plan, not a status.
                    <span className={styles.stageExtension}>
                      {t("cultivationRoom.stage.extended", { days: room.stageExtension })}
                    </span>
                  )}
                </div>
                <div className={styles.progress}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${stageProgress * 100}%` }}
                  />
                </div>
                <div className={styles.popoverDetail}>
                  {t("cultivationRoom.stage.startedOn", { date: room.stageStartedOn })}
                </div>
              </div>
            }
          >
            <span className={styles.stageWord} data-stage={room.stage}>
              {STAGE_LABEL[room.stage]}
            </span>
          </HeaderStat>

          <HeaderStat
            label={t("cultivationRoom.lightHours")}
            tone="neutral"
            portalRef={containerRef}
            popover={
              <div className={styles.popover}>
                <div className={styles.popoverHead}>
                  <span className={styles.popoverTitle}>{t("cultivationRoom.lightHours")}</span>
                  <span className={styles.popoverAside}>
                    <span className={styles.lightHours}>{photoperiod}</span> h
                  </span>
                </div>
                <div className={styles.popoverValue}>
                  <span>{room.lightsOn}</span>
                  <span className={styles.popoverValueMuted}>–</span>
                  <span>{room.lightsOff}</span>
                </div>
                <div className={styles.popoverDetail}>
                  {t("cultivationRoom.lightHours.countdownOff", {
                    duration: formatCountdown(lightsOffCountdown),
                  })}
                </div>
              </div>
            }
          >
            {/* configured photoperiod, not a live reading */}
            <span className={styles.lightHours}>{photoperiod}</span>
          </HeaderStat>

          <HeaderStat
            label={t("cultivationRoom.plantHealth")}
            icon={<Activity size={16} />}
            tone={sickCount > 0 ? "warning" : "ok"}
            portalRef={containerRef}
            popover={
              <div className={styles.popover}>
                <div className={styles.popoverHead}>
                  <span className={styles.popoverTitle}>{t("cultivationRoom.plantHealth")}</span>
                </div>
                <div className={styles.popoverRows}>
                  <div className={styles.popoverRow}>
                    <span className={styles.popoverRowIcon} data-tone="ok">
                      <CheckmarkFilled size={16} />
                    </span>
                    <span className={styles.num}>{healthyPlants}</span>
                    <span>{t("cultivationRoom.health.healthy")}</span>
                  </div>
                  <div className={styles.popoverRow}>
                    <span className={styles.popoverRowIcon} data-tone="warning">
                      <WarningAltFilled size={16} />
                    </span>
                    <span className={styles.num}>{sickCount}</span>
                    <span>{t("cultivationRoom.health.warnings", { count: sickCount })}</span>
                  </div>
                </div>
              </div>
            }
          >
            <span className={styles.num}>{sickCount}</span>
          </HeaderStat>

          <HeaderStat
            label={t("cultivationRoom.tasks")}
            tone={room.openTasks > 0 ? "warning" : "neutral"}
            portalRef={containerRef}
            popover={
              <div className={styles.popover}>
                <div className={styles.popoverHead}>
                  <span className={styles.popoverTitle}>{t("cultivationRoom.tasks")}</span>
                </div>
                <div className={styles.popoverRows}>
                  <div className={styles.popoverRow}>
                    <span
                      className={styles.popoverRowIcon}
                      data-tone={room.openTasks > 0 ? "warning" : "ok"}
                    >
                      {room.openTasks > 0 ? <TaskBlank size={16} /> : <CheckmarkFilled size={16} />}
                    </span>
                    <span className={styles.num}>{room.openTasks}</span>
                    <span>
                      {t("cultivationRoom.tasksCount", { count: room.openTasks })}{" "}
                      {t("cultivationRoom.tasks.open")}
                    </span>
                  </div>
                </div>
              </div>
            }
          >
            <span className={styles.num}>{room.openTasks}</span>
          </HeaderStat>
        </div>
      </div>

      <div className={styles.body}>
        <BenchGridCR
          rows={room.rows}
          columns={room.columns}
          benches={room.benches}
          portalRef={containerRef}
          onBenchSelect={onBenchSelect}
          selectedBenchId={selectedBenchId}
        />
      </div>

      <div className={styles.footer}>
        <ClimateStrip readings={room.climate} />
      </div>
    </div>
  );
}
