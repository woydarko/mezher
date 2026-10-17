import { AlertTriangle } from "lucide-react";
import { useId, type InputHTMLAttributes } from "react";
import styles from "./ui.module.css";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; helper?: string; error?: string };

export function Field({ label, helper, error, ...inputProps }: Props) {
  const id = useId();
  const noteId = id + "-note";
  const note = error ?? helper;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        {...inputProps}
      />
      {note && (
        <span id={noteId} className={error ? styles.helper + " " + styles.error : styles.helper}>
          {error && <AlertTriangle size={14} aria-hidden />} {note}
        </span>
      )}
    </div>
  );
}
