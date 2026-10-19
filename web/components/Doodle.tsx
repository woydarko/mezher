import type { CSSProperties } from "react";
import styles from "./doodle.module.css";

const INK = "var(--color-ink)";

/** Hand-drawn marks, decorative only. Lines run through the #wobble filter so they look crayon-drawn. */
const DOODLES = {
  coin: {
    viewBox: "0 0 64 64",
    paths: [
      { d: "M33 5c14 0 26 12 25 27-1 14-12 26-27 26C17 58 6 46 6 31 7 17 18 5 34 6", fill: "var(--color-orange)" },
      { d: "M25 18v28M25 18h9c5 0 8 3 8 6.5S39 31 34 31h-9M25 31h10c5 0 8 3 8 7s-3 8-9 8h-9M29 13v5M34 13v5M29 46v5M34 46v5" },
    ],
  },
  check: {
    viewBox: "0 0 64 64",
    paths: [{ d: "M9 35c4 4 9 9 13 14C30 35 41 22 56 11", stroke: "var(--color-green-ink)", width: 7, draw: true }],
  },
  star: {
    viewBox: "0 0 64 64",
    paths: [{ d: "M32 6l6 17 18 1-14 11 5 18-15-10-15 10 5-18L8 24l18-1z", fill: "var(--color-yellow)" }],
  },
  arrow: {
    viewBox: "0 0 64 40",
    paths: [{ d: "M4 22c15-5 31-5 52-2M43 9c5 4 10 8 14 12-4 4-9 8-14 11" }],
  },
  circle: {
    viewBox: "0 0 200 60",
    paths: [
      {
        d: "M14 34C8 14 70 4 120 7s78 14 72 30-64 21-112 18S6 44 12 26C18 12 60 6 96 6",
        stroke: "var(--color-orange)",
        width: 5,
      },
    ],
  },
  underline: {
    viewBox: "0 0 200 16",
    paths: [{ d: "M4 10c44-6 98-7 192-3", stroke: "var(--color-yellow)", width: 9 }],
  },
  // Crayon stand-ins for status/action icons, so no machine-drawn glyph sits next to the crayon UI.
  warning: {
    viewBox: "0 0 64 64",
    paths: [{ d: "M32 7L59 55H5zM32 24v15M32 47v1", stroke: "var(--color-red-ink)", width: 5 }],
  },
  spinner: {
    viewBox: "0 0 64 64",
    paths: [{ d: "M32 8c14 0 24 11 24 24S45 56 32 56 8 45 8 32c0-6 2-11 6-15", width: 6 }],
  },
  external: {
    viewBox: "0 0 64 64",
    paths: [{ d: "M36 10h18v18M54 10L28 36M46 40v14H10V18h14", width: 5 }],
  },
  copy: {
    viewBox: "0 0 64 64",
    paths: [{ d: "M22 12h30v36H22zM14 20v34h28", width: 5 }],
  },
} as const;

export type DoodleName = keyof typeof DOODLES;

type PathSpec = { d: string; fill?: string; stroke?: string; width?: number; draw?: boolean };

export function Doodle({ name, className, style }: { name: DoodleName; className?: string; style?: CSSProperties }) {
  const doodle = DOODLES[name];
  return (
    <svg
      viewBox={doodle.viewBox}
      className={styles.doodle + (className ? " " + className : "")}
      style={style}
      preserveAspectRatio={name === "circle" || name === "underline" ? "none" : undefined}
      aria-hidden
      focusable="false"
    >
      <g className={styles.wobble}>
        {(doodle.paths as readonly PathSpec[]).map((p) => (
          <path
            key={p.d}
            d={p.d}
            className={p.draw ? styles.draw : undefined}
            pathLength={p.draw ? 1 : undefined}
            style={{
              fill: p.fill ?? "none",
              stroke: p.stroke ?? INK,
              strokeWidth: p.width ?? 3.5,
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }}
          />
        ))}
      </g>
    </svg>
  );
}
