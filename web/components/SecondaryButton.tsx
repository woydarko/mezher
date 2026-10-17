"use client";

import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Props = { children: ReactNode; onClick?: () => void; href?: string };

export function SecondaryButton({ children, onClick, href }: Props) {
  if (href) {
    return (
      <a className={styles.secondary} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={styles.secondary} onClick={onClick}>
      {children}
    </button>
  );
}
