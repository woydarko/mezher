import { describe, expect, it } from "vitest";
import { UI_ICR_FLOOR_E18, icrE18, maxBorrowWei, quote, type TroveState } from "@/lib/quote";

const E18 = 10n ** 18n;
const FEE_RATE_E18 = 10n ** 15n; // 0.1%
const fee = (borrowWei: bigint) => (borrowWei * FEE_RATE_E18) / E18;

const activeTrove: TroveState = { status: 1, collWei: 4n * 10n ** 16n, debtWei: 2000n * E18 };
const PRICE = 81_155n * E18;

describe("quote", () => {
  it("splits 12 MUSD into 5 from balance and 7 borrowed", () => {
    const q = quote({ amountWei: 12n * E18, balanceWei: 5n * E18, trove: activeTrove, priceE18: PRICE, feeWei: 7n * 10n ** 15n });
    expect(q).toEqual({
      state: "ok",
      fromBalanceWei: 5n * E18,
      borrowWei: 7n * E18,
      feeWei: 7n * 10n ** 15n,
      icrNowE18: icrE18(activeTrove.collWei, PRICE, 2000n * E18),
      icrAfterE18: icrE18(activeTrove.collWei, PRICE, 2000n * E18 + 7n * E18 + 7n * 10n ** 15n),
    });
  });

  it("needs no borrow and no Trove when the balance covers the amount", () => {
    const noTrove: TroveState = { status: 0, collWei: 0n, debtWei: 0n };
    expect(quote({ amountWei: 12n * E18, balanceWei: 20n * E18, trove: noTrove, priceE18: PRICE, feeWei: 0n })).toEqual({
      state: "ok",
      fromBalanceWei: 12n * E18,
      borrowWei: 0n,
      feeWei: 0n,
      icrNowE18: null,
      icrAfterE18: null,
    });
  });

  it("asks for a Trove when the balance is short and there is none", () => {
    const noTrove: TroveState = { status: 2, collWei: 0n, debtWei: 0n };
    expect(quote({ amountWei: 12n * E18, balanceWei: 5n * E18, trove: noTrove, priceE18: PRICE, feeWei: 7n * 10n ** 15n })).toEqual({
      state: "needs_trove",
      shortfallWei: 7n * E18,
    });
  });

  it("quote blocks at 150.4% and allows at 150.5%", () => {
    // coll 1 BTC; debt after borrow + fee is exactly 1,000 MUSD, so ICR after = price / 1,000.
    const trove: TroveState = { status: 1, collWei: E18, debtWei: 1000n * E18 - 7n * E18 - 7n * 10n ** 15n };
    const input = { amountWei: 12n * E18, balanceWei: 5n * E18, trove, feeWei: 7n * 10n ** 15n };

    const blocked = quote({ ...input, priceE18: 1504n * E18 });
    expect(blocked.state).toBe("blocked_ratio");
    if (blocked.state === "blocked_ratio") expect(blocked.icrAfterE18).toBe(1_504_000_000_000_000_000n);

    const allowed = quote({ ...input, priceE18: 1505n * E18 });
    expect(allowed.state).toBe("ok");
    if (allowed.state === "ok") expect(allowed.icrAfterE18).toBe(UI_ICR_FLOOR_E18);
  });

  it("blocked quote offers the max borrow that keeps the floor", () => {
    const trove: TroveState = { status: 1, collWei: E18, debtWei: 990n * E18 };
    const q = quote({ amountWei: 20n * E18, balanceWei: 0n, trove, priceE18: 1504n * E18, feeWei: fee(20n * E18) });
    expect(q).toEqual({
      state: "blocked_ratio",
      icrAfterE18: icrE18(E18, 1504n * E18, 990n * E18 + 20n * E18 + fee(20n * E18)),
      maxBorrowWei: maxBorrowWei(trove, 1504n * E18, UI_ICR_FLOOR_E18, FEE_RATE_E18),
    });
    if (q.state === "blocked_ratio") expect(q.maxBorrowWei).toBeGreaterThan(9n * E18);
  });
});

describe("icrE18", () => {
  it("is coll * price / debt rounded down", () => {
    expect(icrE18(E18, 3n * E18, 2n * E18)).toBe(1_500_000_000_000_000_000n);
    expect(icrE18(1n, 1n, 3n)).toBe(0n);
  });
});

describe("maxBorrowWei", () => {
  it("keeps the ICR at or above the floor after the fee, and 1 wei more breaks it", () => {
    const max = maxBorrowWei(activeTrove, PRICE, UI_ICR_FLOOR_E18, FEE_RATE_E18);
    expect(max).toBeGreaterThan(0n);
    const debtAfter = (b: bigint) => activeTrove.debtWei + b + fee(b);
    expect(icrE18(activeTrove.collWei, PRICE, debtAfter(max))).toBeGreaterThanOrEqual(UI_ICR_FLOOR_E18);
    expect(icrE18(activeTrove.collWei, PRICE, debtAfter(max + 1n))).toBeLessThan(UI_ICR_FLOOR_E18);
  });

  it("is 0 when the Trove is already at or under the floor", () => {
    const low: TroveState = { status: 1, collWei: E18, debtWei: 1000n * E18 };
    expect(maxBorrowWei(low, 1500n * E18, UI_ICR_FLOOR_E18, FEE_RATE_E18)).toBe(0n);
  });
});
