import { describe, expect, it } from "vitest";
import { UI_ICR_FLOOR_E18, icrE18, maxBorrowWei, quote, type TroveState } from "@/lib/quote";

const E18 = 10n ** 18n;
const FEE_RATE_E18 = 10n ** 15n; // 0.1%
const fee = (borrowWei: bigint) => (borrowWei * FEE_RATE_E18) / E18;

const activeTrove: TroveState = { status: 1, collWei: 4n * 10n ** 16n, debtWei: 2000n * E18 };
const PRICE = 81_155n * E18;
const SAFE = { recoveryMode: false, capacityWei: 10n ** 30n, minIcrE18: UI_ICR_FLOOR_E18 };

describe("quote", () => {
  it("splits 12 MUSD into 5 from balance and 7 borrowed", () => {
    const q = quote({ ...SAFE, amountWei: 12n * E18, balanceWei: 5n * E18, trove: activeTrove, priceE18: PRICE, feeWei: 7n * 10n ** 15n });
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
    expect(quote({ ...SAFE, amountWei: 12n * E18, balanceWei: 20n * E18, trove: noTrove, priceE18: PRICE, feeWei: 0n })).toEqual({
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
    expect(quote({ ...SAFE, amountWei: 12n * E18, balanceWei: 5n * E18, trove: noTrove, priceE18: PRICE, feeWei: 7n * 10n ** 15n })).toEqual({
      state: "needs_trove",
      shortfallWei: 7n * E18,
    });
  });

  it("quote blocks at 150.4% and allows at 150.5%", () => {
    // coll 1 BTC; debt after borrow + fee is exactly 1,000 MUSD, so ICR after = price / 1,000.
    const trove: TroveState = { status: 1, collWei: E18, debtWei: 1000n * E18 - 7n * E18 - 7n * 10n ** 15n };
    const input = { amountWei: 12n * E18, balanceWei: 5n * E18, trove, feeWei: 7n * 10n ** 15n };

    const blocked = quote({ ...SAFE, ...input, priceE18: 1504n * E18 });
    expect(blocked.state).toBe("blocked_ratio");
    if (blocked.state === "blocked_ratio") expect(blocked.icrAfterE18).toBe(1_504_000_000_000_000_000n);

    const allowed = quote({ ...SAFE, ...input, priceE18: 1505n * E18 });
    expect(allowed.state).toBe("ok");
    if (allowed.state === "ok") expect(allowed.icrAfterE18).toBe(UI_ICR_FLOOR_E18);
  });

  it("blocked quote offers the max borrow that keeps the floor", () => {
    const trove: TroveState = { status: 1, collWei: E18, debtWei: 990n * E18 };
    const q = quote({ ...SAFE, amountWei: 20n * E18, balanceWei: 0n, trove, priceE18: 1504n * E18, feeWei: fee(20n * E18) });
    expect(q).toEqual({
      state: "blocked_ratio",
      icrAfterE18: icrE18(E18, 1504n * E18, 990n * E18 + 20n * E18 + fee(20n * E18)),
      maxBorrowWei: maxBorrowWei(trove, 1504n * E18, UI_ICR_FLOOR_E18, FEE_RATE_E18),
    });
    if (q.state === "blocked_ratio") expect(q.maxBorrowWei).toBeGreaterThan(9n * E18);
  });
});

describe("quote with Recovery Mode and capacity", () => {
  // coll 1 BTC at 3,000: ICR room to 150.5% is about 1,993 MUSD of debt.
  const trove: TroveState = { status: 1, collWei: E18, debtWei: 1000n * E18 };
  const base = { ...SAFE, trove, priceE18: 3000n * E18, balanceWei: 0n };
  const q = (over: Partial<Parameters<typeof quote>[0]>) =>
    quote({ amountWei: 10n * E18, feeWei: fee(10n * E18), ...base, ...over });

  it("blocks a borrow in Recovery Mode", () => {
    expect(q({ recoveryMode: true })).toEqual({ state: "blocked_recovery", fromBalanceWei: 0n });
  });

  it("still allows a balance-only payment in Recovery Mode", () => {
    const r = q({ recoveryMode: true, balanceWei: 10n * E18 });
    expect(r.state).toBe("ok");
    if (r.state === "ok") expect(r.borrowWei).toBe(0n);
  });

  it("asks for a Trove before it reports Recovery Mode", () => {
    expect(q({ recoveryMode: true, trove: { status: 0, collWei: 0n, debtWei: 0n } }).state).toBe("needs_trove");
  });

  it("blocks a borrow above maxBorrowingCapacity, ok at the limit", () => {
    const debtAfter = 1000n * E18 + 10n * E18 + fee(10n * E18);
    expect(q({ capacityWei: debtAfter - 1n }).state).toBe("blocked_capacity");
    expect(q({ capacityWei: debtAfter }).state).toBe("ok");
  });

  it("reports the smaller of ICR room and capacity room as maxBorrowWei", () => {
    // Capacity room is 5 MUSD of debt, far below the ICR room.
    const tight = q({ capacityWei: 1005n * E18 });
    expect(tight.state).toBe("blocked_capacity");
    if (tight.state === "blocked_capacity") {
      expect(tight.maxBorrowWei).toBeLessThan(5n * E18);
      expect(tight.maxBorrowWei).toBeGreaterThan(4n * E18);
    }
    // Ratio blocks first; capacity room (900) is below ICR room (about 993), so capacity wins.
    const both = q({ amountWei: 5000n * E18, feeWei: fee(5000n * E18), capacityWei: 1900n * E18 });
    expect(both.state).toBe("blocked_ratio");
    if (both.state === "blocked_ratio") {
      expect(both.maxBorrowWei).toBeLessThan(900n * E18);
      expect(both.maxBorrowWei).toBeGreaterThan(899n * E18);
    }
    // With ample capacity the ICR room wins.
    const icr = q({ amountWei: 5000n * E18, feeWei: fee(5000n * E18) });
    if (icr.state === "blocked_ratio") expect(icr.maxBorrowWei).toBe(maxBorrowWei(trove, 3000n * E18, UI_ICR_FLOOR_E18, FEE_RATE_E18));
  });

  it("canRefinance is true outside Recovery Mode", () => {
    const r = q({ capacityWei: 0n });
    expect(r).toMatchObject({ state: "blocked_capacity", canRefinance: true });
  });

  it("uses the payer's minIcr when it is above the UI floor", () => {
    const loose = q({ amountWei: 900n * E18, feeWei: fee(900n * E18) }); // ICR after about 157%
    expect(loose.state).toBe("ok");
    const strict = q({ amountWei: 900n * E18, feeWei: fee(900n * E18), minIcrE18: 2n * E18 });
    expect(strict.state).toBe("blocked_ratio");
    if (strict.state === "blocked_ratio") {
      expect(strict.maxBorrowWei).toBe(maxBorrowWei(trove, 3000n * E18, 2n * E18, FEE_RATE_E18));
    }
  });

  it("clamps a minIcr below the UI floor up to the floor", () => {
    expect(q({ minIcrE18: E18, amountWei: 1000n * E18, feeWei: fee(1000n * E18) }).state).toBe("blocked_ratio");
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
