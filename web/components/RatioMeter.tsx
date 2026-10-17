import { formatRatio } from "@/lib/format";
import styles from "./ratio.module.css";

const SCALE_MAX_E18 = 3n * 10n ** 18n; // bar spans 0-300%
const pos = (e18: bigint) => Number(((e18 < SCALE_MAX_E18 ? e18 : SCALE_MAX_E18) * 1000n) / SCALE_MAX_E18) / 10;

function band(e18: bigint): string {
  if (e18 < 1_500_000_000_000_000_000n) return "var(--color-error)";
  if (e18 < 2_000_000_000_000_000_000n) return "var(--color-warning)";
  return "var(--color-success)";
}

export function RatioMeter({ nowE18, afterE18 }: { nowE18: bigint; afterE18: bigint }) {
  return (
    <div className={styles.wrap}>
      <p className="mono">
        Ratio now {formatRatio(nowE18)} → after <span style={{ color: band(afterE18) }}>{formatRatio(afterE18)}</span>
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
        <div className={styles.fill} style={{ width: pos(afterE18) + "%", background: band(afterE18) }} />
        <div className={styles.marker} style={{ left: pos(1_100_000_000_000_000_000n) + "%" }} />
        <div className={styles.marker} style={{ left: pos(1_500_000_000_000_000_000n) + "%" }} />
      </div>
      <div className={styles.labels}>
        <span style={{ left: pos(1_100_000_000_000_000_000n) + "%" }}>110</span>
        <span style={{ left: pos(1_500_000_000_000_000_000n) + "%" }}>150</span>
      </div>
    </div>
  );
}
