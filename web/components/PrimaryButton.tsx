"use client";

import type { ReactNode } from "react";
import { Doodle } from "./Doodle";
import styles from "./ui.module.css";

type Props = {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
};

export function PrimaryButton({ children, loading, loadingLabel, disabled, disabledReason, onClick }: Props) {
  const showReason = Boolean(disabled && disabledReason);
  return (
    <>
      <button
        type="button"
        className={styles.primary}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-describedby={showReason ? "primary-disabled-reason" : undefined}
        onClick={onClick}
      >
        {loading && <Doodle name="spinner" className={styles.icon + " " + styles.spin} />}
        {loading && loadingLabel ? loadingLabel : children}
      </button>
      {showReason && (
        <p id="primary-disabled-reason" className={styles.reason}>
          {disabledReason}
        </p>
      )}
    </>
  );
}
