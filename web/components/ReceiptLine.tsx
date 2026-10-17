import type { ReactNode } from "react";
import styles from "./ui.module.css";

export function ReceiptLine({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className={styles.line}>
        <span>{label}</span>
        <span className={styles.leader} aria-hidden />
        <span className="mono">{value}</span>
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}
