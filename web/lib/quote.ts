const E18 = 10n ** 18n;

/** Debt = principal + interest + pending, as returned by getEntireDebtAndColl. */
export type TroveState = { status: number; collWei: bigint; debtWei: bigint };
export type QuoteInput = {
  amountWei: bigint;
  balanceWei: bigint;
  trove: TroveState;
  priceE18: bigint;
  feeWei: bigint;
  recoveryMode: boolean;
  /** TroveManager.getTroveMaxBorrowingCapacity: fixed when the Trove is opened or refinanced. */
  capacityWei: bigint;
  /** Payer's chosen minimum ICR after the payment; clamped up to UI_ICR_FLOOR_E18. */
  minIcrE18: bigint;
};
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
  | { state: "blocked_ratio"; icrAfterE18: bigint; maxBorrowWei: bigint }
  | { state: "blocked_recovery"; fromBalanceWei: bigint }
  | { state: "blocked_capacity"; maxBorrowWei: bigint; canRefinance: boolean };

const TROVE_ACTIVE = 1;
const FEE_RATE_E18 = 10n ** 15n; // Mezo borrowing fee, 0.1%

/** 150.5%: margin over the on-chain 150% so accruing interest between quote and tx cannot trip the contract. */
export const UI_ICR_FLOOR_E18 = 1_505_000_000_000_000_000n;

/** coll * price / debt, 1e18 = 100%, rounded down (conservative). Debt is never 0 for an active Trove. */
export function icrE18(collWei: bigint, priceE18: bigint, debtWei: bigint): bigint {
  return (collWei * priceE18) / debtWei;
}

/** Largest borrow whose debt plus fee fits in `room` of extra debt. */
function borrowFitting(room: bigint, feeRateE18: bigint): bigint {
  if (room <= 0n) return 0n;
  const withFee = (b: bigint) => b + (b * feeRateE18) / E18;
  let b = (room * E18) / (E18 + feeRateE18);
  while (withFee(b + 1n) <= room) b += 1n; // the floored fee can leave a few wei of room
  return b;
}

/** Largest borrow whose debt after the fee keeps icrE18 >= floorE18. */
export function maxBorrowWei(trove: TroveState, priceE18: bigint, floorE18: bigint, feeRateE18: bigint): bigint {
  // icrE18 >= floor  <=>  debtAfter <= coll * price / floor (integer floor)
  return borrowFitting((trove.collWei * priceE18) / floorE18 - trove.debtWei, feeRateE18);
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);

/** Largest borrow that keeps both the ratio floor and the Trove's fixed borrowing capacity. */
export function maxBorrowWithCapacityWei(trove: TroveState, priceE18: bigint, floorE18: bigint, feeRateE18: bigint, capacityWei: bigint): bigint {
  return min(maxBorrowWei(trove, priceE18, floorE18, feeRateE18), borrowFitting(capacityWei - trove.debtWei, feeRateE18));
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

  // A debt increase without new collateral always lowers ICR, which Mezo refuses in Recovery Mode.
  if (i.recoveryMode) return { state: "blocked_recovery", fromBalanceWei };

  const floorE18 = i.minIcrE18 > UI_ICR_FLOOR_E18 ? i.minIcrE18 : UI_ICR_FLOOR_E18;
  const debtAfterWei = i.trove.debtWei + borrowWei + i.feeWei;
  const icrAfterE18 = icrE18(i.trove.collWei, i.priceE18, debtAfterWei);
  // Smaller of ICR room and capacity room.
  const maxFor = () => maxBorrowWithCapacityWei(i.trove, i.priceE18, floorE18, FEE_RATE_E18, i.capacityWei);
  if (icrAfterE18 < floorE18) return { state: "blocked_ratio", icrAfterE18, maxBorrowWei: maxFor() };
  // Mezo: maxBorrowingCapacity >= netDebtChange + debt (_requireHasBorrowingCapacity).
  if (debtAfterWei > i.capacityWei) return { state: "blocked_capacity", maxBorrowWei: maxFor(), canRefinance: !i.recoveryMode };
  return { state: "ok", fromBalanceWei, borrowWei, feeWei: i.feeWei, icrNowE18, icrAfterE18 };
}

/** Builds a TroveState from getTroveStatus and getEntireDebtAndColl; the one place the debt formula lives. */
export function toTroveState(
  status: bigint | number,
  debtAndColl: readonly [bigint, bigint, bigint, bigint, bigint, bigint],
): TroveState {
  const [coll, principal, interest, , pendingPrincipal, pendingInterest] = debtAndColl;
  return { status: Number(status), collWei: coll, debtWei: principal + interest + pendingPrincipal + pendingInterest };
}
