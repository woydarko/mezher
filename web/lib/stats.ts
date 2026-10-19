import type { PaidLog } from "./paid-logs";

const DAY_S = 86_400;
const MCR_E18 = 11n * 10n ** 17n; // Mezo minimum collateral ratio, 110% (read on testnet 2026-10-19)

export type Summary = {
  count: number;
  totalWei: bigint;
  avgWei: bigint;
  fromBalanceWei: bigint;
  borrowedWei: bigint;
  uniquePayers: number;
  uniqueMerchants: number;
};

/** Totals over Paid events; every number comes from the logs, nothing is estimated. */
export function summarize(logs: PaidLog[]): Summary {
  let totalWei = 0n;
  let fromBalanceWei = 0n;
  let borrowedWei = 0n;
  const payers = new Set<string>();
  const merchants = new Set<string>();
  for (const l of logs) {
    totalWei += l.amountWei;
    fromBalanceWei += l.fromBalanceWei;
    borrowedWei += l.borrowedWei;
    payers.add(l.payer.toLowerCase());
    merchants.add(l.merchant.toLowerCase());
  }
  return {
    count: logs.length,
    totalWei,
    avgWei: logs.length > 0 ? totalWei / BigInt(logs.length) : 0n,
    fromBalanceWei,
    borrowedWei,
    uniquePayers: payers.size,
    uniqueMerchants: merchants.size,
  };
}

export type DayTotal = { dayStartSec: number; totalWei: bigint; count: number };

/** One bucket per UTC day for the last `days` days (today included), oldest first; older points are dropped. */
export function dailyTotals(points: { timestampSec: number; amountWei: bigint }[], days: number, nowSec: number): DayTotal[] {
  const today = Math.floor(nowSec / DAY_S) * DAY_S;
  const first = today - (days - 1) * DAY_S;
  const buckets: DayTotal[] = Array.from({ length: days }, (_, i) => ({ dayStartSec: first + i * DAY_S, totalWei: 0n, count: 0 }));
  for (const p of points) {
    const i = Math.floor((p.timestampSec - first) / DAY_S);
    if (i < 0 || i >= days) continue;
    buckets[i].totalWei += p.amountWei;
    buckets[i].count += 1;
  }
  return buckets;
}

/** BTC price (1e18 = 1 USD) at which the Trove's ratio falls to Mezo's 110% and it can be liquidated. */
export function liquidationPriceE18(collWei: bigint, debtWei: bigint): bigint {
  if (collWei === 0n) return 0n;
  return (debtWei * MCR_E18) / collWei;
}
