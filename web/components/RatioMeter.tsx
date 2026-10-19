import { formatRatio } from "@/lib/format";
import styles from "./ratio.module.css";

const SCALE_MAX_E18 = 3n * 10n ** 18n; // bar spans 0-300%
const LIQUIDATION_E18 = 1_100_000_000_000_000_000n;
const FLOOR_E18 = 1_500_000_000_000_000_000n;
const pos = (e18: bigint) => Number(((e18 < SCALE_MAX_E18 ? e18 : SCALE_MAX_E18) * 1000n) / SCALE_MAX_E18) / 10;

/** Crayon fill for the bar and a darker ink of the same hue for the number (text contrast). */
function band(e18: bigint): { fill: string; ink: string } {
  if (e18 < FLOOR_E18) return { fill: "var(--color-red)", ink: "var(--color-red-ink)" };
  if (e18 < 2_000_000_000_000_000_000n) return { fill: "var(--color-orange)", ink: "var(--color-orange-ink)" };
  return { fill: "var(--color-green)", ink: "var(--color-green-ink)" };
}

export function RatioMeter({ nowE18, afterE18 }: { nowE18: bigint; afterE18: bigint }) {
  const after = band(afterE18);
  return (
    <div className={styles.wrap}>
      <p className={styles.readout}>
        <span>
          Ratio now <strong className="mono">{formatRatio(nowE18)}</strong>
        </span>
        <span aria-hidden>→</span>
        <span>
          after{" "}
          <strong className="mono" style={{ color: after.ink }}>
            {formatRatio(afterE18)}
          </strong>
        </span>
      </p>
      <div
        className={styles.track}
        role="meter"
        aria-label="Collateral ratio after paying"
        aria-valuemin={0}
        aria-valuemax={300}
        aria-valuenow={Number(afterE18 / 10n ** 16n)}
        aria-valuetext={formatRatio(afterE18)}
      >
        <div className={styles.fill} style={{ width: pos(afterE18) + "%", ["--band" as string]: after.fill }} />
        <div className={styles.marker} style={{ left: pos(LIQUIDATION_E18) + "%" }} />
        <div className={styles.marker} style={{ left: pos(FLOOR_E18) + "%" }} />
      </div>
      <div className={styles.labels}>
        <span style={{ left: pos(LIQUIDATION_E18) + "%" }}>110 danger</span>
        <span style={{ left: pos(FLOOR_E18) + "%" }}>150 safe line</span>
      </div>
    </div>
  );
}
