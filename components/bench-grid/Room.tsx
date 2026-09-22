import { Bench } from "./Bench.js";
import styles from "./Room.module.css";

// Diese Komponente wird aus der Datenbank befüllt (anzahl benches, grid-row/grid-col und wird über props übergeben)

export function Room() {
  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <div className={styles.roomName}>Room 1</div>
        </div>

        <div className={`${styles.grid} ${styles.col3} ${styles.row3}`}></div>

        <div className={styles.footer}></div>
      </div>
    </>
  );
}
