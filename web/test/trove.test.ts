import { describe, expect, it } from "vitest";
import { icrE18, UI_ICR_FLOOR_E18 } from "@/lib/quote";
import {
  GAS_COMPENSATION_WEI,
  MIN_NET_DEBT_WEI,
  OPEN_GAS_RESERVE_WEI,
  collateralFor,
  openTroveQuote,
} from "@/lib/trove";

const E18 = 10n ** 18n;
const PRICE = 81_000n * E18;
const DEBT = 1_800n * E18;
const FEE = (DEBT * 10n ** 15n) / E18; // 0.1%
const BALANCE = E18; // 1 BTC

describe("openTroveQuote", () => {
  it("adds Mezo's fee and the 200 MUSD gas compensation to the debt", () => {
    const q = openTroveQuote({ collWei: E18 / 20n, debtWei: DEBT, feeWei: FEE, priceE18: PRICE, btcBalanceWei: BALANCE });
    const total = DEBT + FEE + GAS_COMPENSATION_WEI;
    expect(q).toEqual({ state: "ok", totalDebtWei: total, icrE18: icrE18(E18 / 20n, PRICE, total) });
  });

  it("rejects a borrow under Mezo's 1,800 MUSD minimum", () => {
    const q = openTroveQuote({
      collWei: E18,
      debtWei: MIN_NET_DEBT_WEI - 1n,
      feeWei: 0n,
      priceE18: PRICE,
      btcBalanceWei: BALANCE,
    });
    expect(q).toEqual({ state: "debt_too_small" });
  });

  it("keeps a little BTC for the transaction fee and says how much can be locked", () => {
    const q = openTroveQuote({ collWei: BALANCE, debtWei: DEBT, feeWei: FEE, priceE18: PRICE, btcBalanceWei: BALANCE });
    expect(q).toEqual({ state: "not_enough_btc", maxCollWei: BALANCE - OPEN_GAS_RESERVE_WEI });
  });

  it("blocks a Trove opened under the 150.5% floor and names the collateral that clears it", () => {
    const total = DEBT + FEE + GAS_COMPENSATION_WEI;
    const tooLittle = collateralFor(total, PRICE, UI_ICR_FLOOR_E18) - 1n;
    const q = openTroveQuote({ collWei: tooLittle, debtWei: DEBT, feeWei: FEE, priceE18: PRICE, btcBalanceWei: BALANCE });
    expect(q.state).toBe("ratio_too_low");
    if (q.state !== "ratio_too_low") return;
    expect(q.icrE18 < UI_ICR_FLOOR_E18).toBe(true);
    expect(icrE18(q.minCollWei, PRICE, total) >= UI_ICR_FLOOR_E18).toBe(true);
  });
});

describe("collateralFor", () => {
  it("returns the smallest collateral that reaches the target ratio", () => {
    const total = 2_001_800n * 10n ** 15n;
    const target = 2n * E18;
    const coll = collateralFor(total, PRICE, target);
    expect(icrE18(coll, PRICE, total) >= target).toBe(true);
    expect(icrE18(coll - 1n, PRICE, total) < target).toBe(true);
  });
});
