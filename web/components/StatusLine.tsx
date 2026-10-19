import type { ReactNode } from "react";
import { Doodle } from "./Doodle";
import styles from "./ui.module.css";

type Tone = "info" | "success" | "error";

const ICONS = { info: "spinner", success: "check", error: "warning" } as const;

export function StatusLine({ tone, children, href }: { tone: Tone; children: ReactNode; href?: string }) {
  return (
    <p className={styles.status + " " + styles[tone]} role={tone === "error" ? "alert" : "status"}>
      <Doodle name={ICONS[tone]} className={styles.icon + (tone === "info" ? " " + styles.spin : "")} />
      <span>{children}</span>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className={styles.inlineLink}>
          View on explorer <Doodle name="external" className={styles.iconSmall} />
        </a>
      )}
    </p>
  );
}
