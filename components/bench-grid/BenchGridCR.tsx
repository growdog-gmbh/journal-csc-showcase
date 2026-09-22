import type { CSSProperties, RefObject } from "react";
import type { BenchData, CultivationRoomData } from "../types.js";
import { BenchCR } from "./BenchCR.js";
import styles from "./BenchGridCR.module.css";

export interface BenchGridCRProps {
  rows: CultivationRoomData["rows"];
  columns: CultivationRoomData["columns"];
  benches: readonly BenchData[];
  portalRef: RefObject<HTMLDivElement | null>;
  onBenchSelect?: ((benchId: string) => void) | undefined;
  selectedBenchId?: string | undefined;
}

type GridStyle = CSSProperties & Record<"--rows" | "--cols", number>;

export function BenchGridCR({
  rows,
  columns,
  benches,
  portalRef,
  onBenchSelect,
  selectedBenchId,
}: BenchGridCRProps) {
  // This grid is only for CultivationRoom!
  const style: GridStyle = { "--rows": rows, "--cols": columns };

  return (
    <div className={styles.viewport}>
      <div className={styles.benchGrid} style={style}>
        {benches.slice(0, rows * columns).map((bench) => (
          <BenchCR
            key={bench.id}
            bench={bench}
            portalRef={portalRef}
            onSelect={onBenchSelect}
            selected={bench.id === selectedBenchId}
          />
        ))}
      </div>
    </div>
  );
}
