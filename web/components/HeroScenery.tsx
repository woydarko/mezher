import type { CSSProperties } from "react";

const INK = "var(--color-ink)";

const stroke = (w = 4, color = INK): CSSProperties => ({
  fill: "none",
  stroke: color,
  strokeWidth: w,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});
const shape = (fill: string, w = 4): CSSProperties => ({ ...stroke(w), fill });

/**
 * Crayon landscape behind the hero: Bitcoin sun, clouds, hills, a little shop and a tree.
 * Sky pieces sit at the far left and right so the centred headline stays on plain paper.
 * Decorative only; it scales to the width and stays anchored to the bottom of the hero.
 * The big shapes (hills, clouds, path) carry no SVG filter: a turbulence filter at full width froze the renderer.
 */
export function HeroScenery({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax meet" className={className} aria-hidden focusable="false">
      <defs>
        <pattern id="hill-back" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-58)">
          <rect width="12" height="12" style={{ fill: "var(--color-paper-2)" }} />
          <rect x="9" width="3" height="12" style={{ fill: "var(--color-paper)" }} />
        </pattern>
        <pattern id="hill-front" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-58)">
          <rect width="12" height="12" style={{ fill: "var(--color-green)" }} />
          <rect x="9" width="3" height="12" style={{ fill: "color-mix(in srgb, var(--color-green) 55%, white)" }} />
        </pattern>
        <pattern id="sun-fill" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-58)">
          <rect width="10" height="10" style={{ fill: "var(--color-orange)" }} />
          <rect x="7.5" width="2.5" height="10" style={{ fill: "var(--color-orange-soft)" }} />
        </pattern>
      </defs>

      {/* sky: Bitcoin sun top right, two clouds, a few birds */}
      <g style={{ filter: "url(#wobble)" }}>
        <path d="M1302 20v-16M1350 44l12-12M1366 92h18M1254 44l-12-12M1350 140l12 12M1236 92h-18" style={stroke(4)} />
      </g>
      <g style={{ filter: "url(#sketch)" }}>
        <path
          d="M1303 40c30 0 52 24 51 53-1 28-24 51-53 50-28-1-50-23-50-52 1-28 22-51 53-51"
          style={shape("url(#sun-fill)")}
        />
      </g>
      <g style={{ filter: "url(#wobble)" }}>
        <path
          d="M1288 66v54M1288 66h17c9 0 14 5 14 12s-5 12-14 12h-17M1288 90h19c9 0 15 6 15 14s-6 16-16 16h-18M1296 58v8M1306 58v8M1296 120v8M1306 120v8"
          style={stroke(4)}
        />
      </g>

      <g>
        <path
          d="M70 118c-2-22 22-34 40-24 6-24 44-30 58-8 22-10 46 6 40 30 18 4 18 30-4 32H82c-22-2-28-24-12-30z"
          style={shape("var(--color-paper)", 3.5)}
        />
        <path
          d="M1150 196c-2-16 16-26 30-18 5-18 34-22 44-6 16-8 34 4 30 22 14 3 14 22-3 24h-92c-16-1-21-18-9-22z"
          style={shape("var(--color-paper)", 3.5)}
        />
      </g>
      <g style={{ filter: "url(#wobble)" }}>
        <path
          d="M250 70c8-8 14-8 20 0 6-8 12-8 20 0M300 104c6-6 11-6 16 0 5-6 10-6 16 0M1090 60c7-7 12-7 18 0 6-7 11-7 18 0"
          style={stroke(3.5)}
        />
      </g>

      {/* back hill */}
      <g>
        <path
          d="M-20 330C140 250 300 236 470 282s300 52 470 4 340-70 520-10V440H-20z"
          style={shape("url(#hill-back)", 4)}
        />
      </g>

      {/* little shop on the back hill */}
      <g style={{ filter: "url(#sketch)" }}>
        <path d="M352 286v-58h92v58" style={shape("var(--color-paper)", 4)} />
        <path d="M342 230l12-30h88l12 30z" style={shape("var(--color-yellow)", 4)} />
        <path d="M384 286v-34h26v34" style={shape("var(--color-paper-2)", 3.5)} />
      </g>
      <g style={{ filter: "url(#wobble)" }}>
        <path d="M370 200l-6 30M398 200v30M426 200l6 30" style={stroke(3.5)} />
      </g>

      {/* tree on the right */}
      <g style={{ filter: "url(#sketch)" }}>
        <path d="M1062 300v-50" style={stroke(7)} />
        <path
          d="M1062 262c-34 2-48-26-30-46-12-26 18-46 38-32 18-18 50-4 44 22 22 12 10 46-16 44-8 12-26 14-36 12z"
          style={shape("url(#hill-front)", 4)}
        />
      </g>

      {/* front hill with a path winding up to the shop */}
      <g>
        <path
          d="M-20 372C180 320 380 344 560 372s360 22 560-20 260-34 340-20V440H-20z"
          style={shape("url(#hill-front)", 4)}
        />
      </g>
      <g>
        <path d="M700 420c-40-24-120-34-160-56s-90-40-130-56" style={stroke(4, "var(--color-paper)")} />
        <path d="M700 420c-40-24-120-34-160-56s-90-40-130-56" style={{ ...stroke(2.5), strokeDasharray: "2 14" }} />
        <path
          d="M180 360l-4-14M196 362l2-14M1250 352l-4-14M1266 354l2-14M860 372l-3-12M874 373l2-12"
          style={stroke(3, "var(--color-green-ink)")}
        />
      </g>
    </svg>
  );
}
