import type { ReactNode } from "react";
import styles from "./doodle.module.css";

const INK = "var(--color-ink)";

type Stroke = { fill?: string; stroke?: string; w?: number };
const s = ({ fill = "none", stroke = INK, w = 3.5 }: Stroke = {}) => ({
  fill,
  stroke,
  strokeWidth: w,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/** Small crayon scenes for the landing "how it works" cards. Decorative; the card text carries the meaning. */
const SCENES: Record<"link" | "sign" | "paid", ReactNode> = {
  // a little shop sending a speech bubble with a link in it
  link: (
    <>
      <path d="M16 98V54h62v44" style={s({ fill: "var(--color-paper)" })} />
      <path d="M10 55l9-22h56l9 22z" style={s({ fill: "var(--color-orange)" })} />
      <path d="M33 33l-5 22M47 33v22M61 33l5 22" style={s()} />
      <path d="M38 98V74h18v24" style={s({ fill: "var(--color-yellow)" })} />
      <path d="M6 99c30-2 60-2 92 0" style={s({ w: 3 })} />
      <path
        d="M98 12h54c5 0 7 2 7 7v25c0 5-2 7-7 7h-32l-13 11 2-11h-11c-5 0-7-2-7-7V19c0-5 2-7 7-7z"
        style={s({ fill: "var(--color-paper)" })}
      />
      <path
        d="M118 38l-3 3c-4 4-10 4-13 0s-4-9 0-13l4-4c4-4 9-4 13 0M132 25l3-3c4-4 10-4 13 0s4 9 0 13l-4 4c-4 4-9 4-13 0M116 36l17-12"
        style={s({ stroke: "var(--color-orange-ink)", w: 4 })}
      />
    </>
  ),
  // a receipt being signed with a crayon
  sign: (
    <>
      <path d="M36 8h66l12 12v80H36z" style={s({ fill: "var(--color-paper)" })} transform="rotate(-4 75 55)" />
      <path
        d="M48 30h48M48 42h48M48 54h30"
        style={s({ stroke: "var(--color-muted)", w: 3 })}
        transform="rotate(-4 75 55)"
      />
      <path
        d="M46 82c5-11 9 3 13-4s8-8 10 1 6-6 11-3 4 7 10 0"
        style={s({ w: 3.5 })}
        transform="rotate(-4 75 55)"
      />
      <path d="M112 96l32-56 11 6-32 56-13 5z" style={s({ fill: "var(--color-yellow)" })} />
      <path d="M112 96l1-11 9 5z" style={s({ fill: INK })} />
      <path d="M140 47l11 6" style={s()} />
    </>
  ),
  // BTC stays locked, the merchant's bag fills up
  paid: (
    <>
      <path d="M28 56V44c0-9 6-15 13-15s13 6 13 15v12" style={s({ w: 4 })} />
      <path d="M16 56h50v40H16z" style={s({ fill: "var(--color-paper-2)" })} />
      <path d="M41 63c7 0 11 5 11 11s-4 11-11 11-11-5-11-11 5-11 12-11" style={s({ fill: "var(--color-orange)" })} />
      <path
        d="M38 68v13M38 68h4c2 0 3 1 3 3s-1 3-3 3h-4M38 74h5c2 0 3 1 3 3.5S45 81 43 81h-5"
        style={s({ w: 2.5 })}
      />
      <path d="M76 70c8-4 16-4 24 0M92 63l8 7-8 7" style={s({ stroke: "var(--color-green-ink)", w: 4 })} />
      <path
        d="M128 42c-15 6-23 20-23 34 0 14 10 22 25 22s25-8 25-22c0-14-8-28-23-34z"
        style={s({ fill: "var(--color-green)" })}
      />
      <path d="M121 42l7-9 8 9" style={s({ w: 3.5 })} />
      <path d="M137 64c-2-4-12-4-12 2s12 3 12 9-10 6-12 2M131 57v28" style={s({ w: 3 })} />
      <path d="M158 22l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" style={s({ fill: "var(--color-yellow)", w: 2.5 })} />
    </>
  ),
};

export function Illustration({ name, className }: { name: keyof typeof SCENES; className?: string }) {
  return (
    <svg
      viewBox="0 0 170 110"
      className={styles.doodle + (className ? " " + className : "")}
      aria-hidden
      focusable="false"
    >
      <g className={styles.wobble}>{SCENES[name]}</g>
    </svg>
  );
}
