import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { PaidLog } from "@/lib/paid-logs";
import { dailyTotals, liquidationPriceE18, summarize } from "@/lib/stats";

const E18 = 10n ** 18n;
const A = "0x11a632076c274C8A29F09AD241Ef6c46118e9be3" as Address;
const B = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2" as Address;
const DAY = 86_400;

const log = (payer: Address, merchant: Address, amount: bigint, fromBalance: bigint): PaidLog => ({
  orderId: ("0x" + "0".repeat(64)) as Hex,
  payer,
  merchant,
  amountWei: amount,
  fromBalanceWei: fromBalance,
  borrowedWei: amount - fromBalance,
  txHash: ("0x" + "1".repeat(64)) as Hex,
  blockNumber: 1n,
});

describe("summarize", () => {
  it("totals amounts, the balance vs borrowed split and unique payers and merchants", () => {
    const s = summarize([log(A, B, 12n * E18, 5n * E18), log(A, B, 4n * E18, 3n * E18), log(B, A, 2n * E18, 0n)]);
    expect(s).toEqual({
      count: 3,
      totalWei: 18n * E18,
      avgWei: 6n * E18,
      fromBalanceWei: 8n * E18,
      borrowedWei: 10n * E18,
      uniquePayers: 2,
      uniqueMerchants: 2,
    });
  });

  it("is all zeros for no payments, without dividing by zero", () => {
    expect(summarize([])).toMatchObject({ count: 0, totalWei: 0n, avgWei: 0n, uniquePayers: 0 });
  });

  it("counts an address once whatever its letter case", () => {
    expect(summarize([log(A, B, E18, 0n), log(A.toLowerCase() as Address, B, E18, 0n)]).uniquePayers).toBe(1);
  });
});

describe("dailyTotals", () => {
  const now = 20_000 * DAY + 3_600; // 01:00 UTC on day 20000

  it("returns one bucket per UTC day, oldest first, including empty days and today", () => {
    const b = dailyTotals(
      [
        { timestampSec: now - 60, amountWei: 2n },
        { timestampSec: now - DAY, amountWei: 3n },
        { timestampSec: now - DAY - 10, amountWei: 4n },
      ],
      3,
      now,
    );
    expect(b).toEqual([
      { dayStartSec: 19_998 * DAY, totalWei: 0n, count: 0 },
      { dayStartSec: 19_999 * DAY, totalWei: 7n, count: 2 },
      { dayStartSec: 20_000 * DAY, totalWei: 2n, count: 1 },
    ]);
  });

  it("ignores payments older than the window", () => {
    expect(dailyTotals([{ timestampSec: now - 10 * DAY, amountWei: 9n }], 3, now).every((d) => d.count === 0)).toBe(true);
  });
});

describe("liquidationPriceE18", () => {
  it("is the BTC price where the ratio falls to Mezo's 110% minimum", () => {
    // 0.05 BTC, 2,000 MUSD debt -> 2,000 * 1.1 / 0.05 = 44,000 USD
    expect(liquidationPriceE18(E18 / 20n, 2_000n * E18)).toBe(44_000n * E18);
  });

  it("is zero when there is no collateral to liquidate", () => {
    expect(liquidationPriceE18(0n, 2_000n * E18)).toBe(0n);
  });
});
