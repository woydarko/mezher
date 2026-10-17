const E18 = 10n ** 18n;

/** Debt = principal + interest + pending, as returned by getEntireDebtAndColl. */
export type TroveState = { status: number; collWei: bigint; debtWei: bigint };
export type QuoteInput = { amountWei: bigint; balanceWei: bigint; trove: TroveState; priceE18: bigint; feeWei: bigint };
export type Quote =
  | {
      state: "ok";
      fromBalanceWei: bigint;
      borrowWei: bigint;
      feeWei: bigint;
      icrNowE18: bigint | null;
      icrAfterE18: bigint | null;
    }
  | { state: "needs_trove"; shortfallWei: bigint }
  | { state: "blocked_ratio"; icrAfterE18: bigint; maxBorrowWei: bigint };

const TROVE_ACTIVE = 1;
const FEE_RATE_E18 = 10n ** 15n; // Mezo borrowing fee, 0.1%

/** 150.5%: margin over the on-chain 150% so accruing interest between quote and tx cannot trip the contract. */
export const UI_ICR_FLOOR_E18 = 1_505_000_000_000_000_000n;

/** coll * price / debt, 1e18 = 100%, rounded down (conservative). Debt is never 0 for an active Trove. */
export function icrE18(collWei: bigint, priceE18: bigint, debtWei: bigint): bigint {
  return (collWei * priceE18) / debtWei;
}

/** Largest borrow whose debt after the fee keeps icrE18 >= floorE18. */
export function maxBorrowWei(trove: TroveState, priceE18: bigint, floorE18: bigint, feeRateE18: bigint): bigint {
  // icrE18 >= floor  <=>  debtAfter <= coll * price / floor (integer floor)
  const room = (trove.collWei * priceE18) / floorE18 - trove.debtWei;
  if (room <= 0n) return 0n;
  const withFee = (b: bigint) => b + (b * feeRateE18) / E18;
  let b = (room * E18) / (E18 + feeRateE18);
  while (withFee(b + 1n) <= room) b += 1n; // the floored fee can leave a few wei of room
  return b;
}

export function quote(i: QuoteInput): Quote {
  const fromBalanceWei = i.balanceWei < i.amountWei ? i.balanceWei : i.amountWei;
  const borrowWei = i.amountWei - fromBalanceWei;
  const active = i.trove.status === TROVE_ACTIVE;
  const icrNowE18 = active ? icrE18(i.trove.collWei, i.priceE18, i.trove.debtWei) : null;

  if (borrowWei === 0n) {
    return { state: "ok", fromBalanceWei, borrowWei, feeWei: 0n, icrNowE18, icrAfterE18: icrNowE18 };
  }
  if (!active) return { state: "needs_trove", shortfallWei: borrowWei };

  const icrAfterE18 = icrE18(i.trove.collWei, i.priceE18, i.trove.debtWei + borrowWei + i.feeWei);
  if (icrAfterE18 < UI_ICR_FLOOR_E18) {
    return {
      state: "blocked_ratio",
      icrAfterE18,
      maxBorrowWei: maxBorrowWei(i.trove, i.priceE18, UI_ICR_FLOOR_E18, FEE_RATE_E18),
    };
  }
  return { state: "ok", fromBalanceWei, borrowWei, feeWei: i.feeWei, icrNowE18, icrAfterE18 };
}
