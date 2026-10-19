import { icrE18, UI_ICR_FLOOR_E18 } from "./quote";

// Read on Mezo testnet 2026-10-19: BorrowerOperations.minNetDebt() and MUSD_GAS_COMPENSATION().
export const MIN_NET_DEBT_WEI = 1_800n * 10n ** 18n;
export const GAS_COMPENSATION_WEI = 200n * 10n ** 18n;
/** BTC left in the wallet for the openTrove transaction fee (testnet gas is ~146 wei, so this is generous). */
export const OPEN_GAS_RESERVE_WEI = 10n ** 13n;

export type OpenTroveInput = {
  collWei: bigint;
  debtWei: bigint; // MUSD the payer receives
  feeWei: bigint; // BorrowerOperations.getBorrowingFee(debtWei)
  priceE18: bigint;
  btcBalanceWei: bigint;
};

export type OpenTroveQuote =
  | { state: "ok"; totalDebtWei: bigint; icrE18: bigint }
  | { state: "debt_too_small" }
  | { state: "not_enough_btc"; maxCollWei: bigint }
  | { state: "ratio_too_low"; icrE18: bigint; minCollWei: bigint };

/** Smallest collateral whose ratio reaches `targetE18` (ceil of target * debt / price). */
export function collateralFor(totalDebtWei: bigint, priceE18: bigint, targetE18: bigint): bigint {
  return (targetE18 * totalDebtWei + priceE18 - 1n) / priceE18;
}

/**
 * Checks a new Trove before the payer sends it: Mezo's minimum debt, enough BTC for collateral plus the
 * fee, and the same 150.5% floor the checkout uses, so the first payment out of it is not blocked.
 */
export function openTroveQuote(i: OpenTroveInput): OpenTroveQuote {
  if (i.debtWei < MIN_NET_DEBT_WEI) return { state: "debt_too_small" };
  if (i.collWei + OPEN_GAS_RESERVE_WEI > i.btcBalanceWei) {
    const max = i.btcBalanceWei - OPEN_GAS_RESERVE_WEI;
    return { state: "not_enough_btc", maxCollWei: max > 0n ? max : 0n };
  }
  const totalDebtWei = i.debtWei + i.feeWei + GAS_COMPENSATION_WEI;
  const icr = icrE18(i.collWei, i.priceE18, totalDebtWei);
  if (icr < UI_ICR_FLOOR_E18) {
    return { state: "ratio_too_low", icrE18: icr, minCollWei: collateralFor(totalDebtWei, i.priceE18, UI_ICR_FLOOR_E18) };
  }
  return { state: "ok", totalDebtWei, icrE18: icr };
}
