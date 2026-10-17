import type { ReactNode } from "react";
import styles from "./ui.module.css";

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section className={styles.card}>
      {title && <h2 className="section-label">{title}</h2>}
      {children}
    </section>
  );
}
