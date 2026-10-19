import { useId, type ReactNode } from "react";
import { formatMusd } from "@/lib/format";
import type { DayTotal } from "@/lib/stats";
import c from "./charts.module.css";

const W = 700;
const H = 240;
const PAD_X = 36;
const PAD_TOP = 28;
const PAD_BOTTOM = 48;

const dayLabel = (s: number) => new Date(s * 1000).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });

/** Daily MUSD received, drawn as crayon bars on paper. The aria-label carries the same numbers as text. */
export function CrayonBarChart({ days, label }: { days: DayTotal[]; label: string }) {
  const id = useId().replace(/:/g, "");
  const max = days.reduce((m, d) => (d.totalWei > m ? d.totalWei : m), 0n);
  const slot = (W - PAD_X * 2) / days.length;
  const barW = Math.max(8, slot * 0.62);
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const busy = days.filter((d) => d.count > 0);
  const summary =
    label +
    ": " +
    (busy.length === 0
      ? "no payments in this period"
      : busy.map((d) => dayLabel(d.dayStartSec) + " " + formatMusd(d.totalWei) + " MUSD").join(", "));

  return (
    <figure className={c.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        <defs>
          <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-58)">
            <rect width="10" height="10" style={{ fill: "var(--color-yellow)" }} />
            <rect x="7.5" width="2.5" height="10" style={{ fill: "var(--color-paper)" }} />
          </pattern>
        </defs>
        {/* baseline drawn as a crayon stroke */}
        <path
          d={`M${PAD_X - 6} ${H - PAD_BOTTOM} C ${W / 3} ${H - PAD_BOTTOM - 2}, ${(2 * W) / 3} ${H - PAD_BOTTOM + 2}, ${W - PAD_X + 6} ${H - PAD_BOTTOM}`}
          className={c.ink}
          style={{ filter: "url(#wobble)" }}
        />
        {days.map((d, i) => {
          const h = max === 0n ? 0 : Number((d.totalWei * 1000n) / max) / 1000;
          const barH = Math.max(d.count > 0 ? 6 : 0, h * plotH);
          const x = PAD_X + i * slot + (slot - barW) / 2;
          const y = H - PAD_BOTTOM - barH;
          return (
            <g key={d.dayStartSec}>
              {barH > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={3}
                  className={c.bar}
                  style={{ fill: `url(#${id})`, filter: "url(#sketch)" }}
                >
                  <title>{dayLabel(d.dayStartSec) + ": " + formatMusd(d.totalWei) + " MUSD, " + d.count + " payments"}</title>
                </rect>
              )}
              {/* every third day, counted back from today, so labels stay large enough on a phone */}
              {(days.length - 1 - i) % 3 === 0 && (
                <text x={x + barW / 2} y={H - 12} textAnchor="middle" className={c.tick}>
                  {dayLabel(d.dayStartSec)}
                </text>
              )}
            </g>
          );
        })}
        {max > 0n && (
          <text x={PAD_X - 4} y={PAD_TOP - 10} className={c.tick}>
            {"max " + formatMusd(max) + " MUSD"}
          </text>
        )}
      </svg>
      {busy.length === 0 && <figcaption className={c.empty}>No payments in the last {days.length} days yet.</figcaption>}
    </figure>
  );
}

/** How much of the money came from wallet balances vs borrowed against BTC. */
export function SplitBar({ fromBalanceWei, borrowedWei }: { fromBalanceWei: bigint; borrowedWei: bigint }) {
  const total = fromBalanceWei + borrowedWei;
  if (total === 0n) return <p className={c.empty}>Nothing paid yet.</p>;
  const borrowedPct = Number((borrowedWei * 1000n) / total) / 10;
  return (
    <div className={c.split}>
      <div
        className={c.splitTrack}
        role="img"
        aria-label={`${(100 - borrowedPct).toFixed(1)}% from wallet balances, ${borrowedPct.toFixed(1)}% borrowed against BTC`}
      >
        <span className={c.splitBalance} style={{ width: 100 - borrowedPct + "%" }} />
        <span className={c.splitBorrowed} style={{ width: borrowedPct + "%" }} />
      </div>
      <div className={c.splitLegend}>
        <span>
          <i className={c.keyBalance} aria-hidden /> From balance <b className="mono">{formatMusd(fromBalanceWei)} MUSD</b>
        </span>
        <span>
          <i className={c.keyBorrowed} aria-hidden /> Borrowed against BTC{" "}
          <b className="mono">
            {formatMusd(borrowedWei)} MUSD ({borrowedPct.toFixed(1)}%)
          </b>
        </span>
      </div>
    </div>
  );
}

export function StatTile({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <div className={c.tile}>
      <span className={c.tileLabel}>{label}</span>
      <span className={c.tileValue + " mono"}>
        {value}
        {unit && <span className={c.tileUnit}> {unit}</span>}
      </span>
      {sub && <span className={c.tileSub}>{sub}</span>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={c.grid}>{children}</div>;
}
