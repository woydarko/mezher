import { AlertTriangle, Check, ExternalLink, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Tone = "info" | "success" | "error";

const ICONS = { info: Loader2, success: Check, error: AlertTriangle } as const;

export function StatusLine({ tone, children, href }: { tone: Tone; children: ReactNode; href?: string }) {
  const Icon = ICONS[tone];
  return (
    <p className={styles.status + " " + styles[tone]} role={tone === "error" ? "alert" : "status"}>
      <Icon size={16} className={tone === "info" ? styles.spin : undefined} aria-hidden />
      <span>{children}</span>
      {href && (
        <a href={href} target="_blank" rel="noreferrer">
          View on explorer <ExternalLink size={14} aria-hidden />
        </a>
      )}
    </p>
  );
}
