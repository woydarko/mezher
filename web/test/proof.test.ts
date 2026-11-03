import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { PaidLog } from "@/lib/paid-logs";
import { parseTeamWallets, summarizeProof, TEAM_WALLETS } from "@/lib/proof";
import { tryScenario } from "@/lib/try";

const TEAM = TEAM_WALLETS[0]!;
const OUT1: Address = "0x11a632076c274C8A29F09AD241Ef6c46118e9be3";
const OUT2: Address = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";
const ZERO: Address = "0x0000000000000000000000000000000000000000";

const log = (payer: Address, merchant: Address, amount = 10n * 10n ** 18n): PaidLog => ({
  orderId: ("0x" + "1".repeat(64)) as Hex,
  payer,
  merchant,
  amountWei: amount,
  fromBalanceWei: 0n,
  borrowedWei: amount,
  feeWei: 0n,
  txHash: ("0x" + "2".repeat(64)) as Hex,
  blockNumber: 1n,
});

describe("summarizeProof", () => {
  it("never counts a team wallet as outside", () => {
    const s = summarizeProof([log(TEAM, TEAM), log(TEAM.toLowerCase() as Address, OUT2)], TEAM_WALLETS);
    expect(s.outsidePayers).toEqual([]);
    expect(s.outsideMerchants).toEqual([OUT2]);
    expect(s.payments).toBe(2);
    expect(s.volumeWei).toBe(20n * 10n ** 18n);
  });

  it("counts a repeated payer once", () => {
    const s = summarizeProof([log(OUT1, TEAM), log(OUT1.toLowerCase() as Address, TEAM)], TEAM_WALLETS);
    expect(s.outsidePayers).toEqual([OUT1]);
  });

  it("ignores the zero address and reports zero for no logs", () => {
    expect(summarizeProof([log(ZERO, ZERO)], TEAM_WALLETS).outsidePayers).toEqual([]);
    expect(summarizeProof([], TEAM_WALLETS)).toEqual({ payments: 0, outsidePayers: [], outsideMerchants: [], volumeWei: 0n });
  });
});

describe("parseTeamWallets", () => {
  it("keeps valid addresses, drops junk, checksums", () => {
    expect(parseTeamWallets(` ${OUT1.toLowerCase()}, nope ,0x123,`)).toEqual([OUT1]);
    expect(parseTeamWallets(undefined)).toEqual([]);
  });
});

describe("tryScenario", () => {
  const m = (n: number) => BigInt(n) * 10n ** 18n;
  it("no Trove opens one and pays 12", () => {
    expect(tryScenario(false, m(1788))).toMatchObject({ kind: "open", amount: "12" });
  });
  it("balance covers 12 pays from balance", () => {
    expect(tryScenario(true, m(12))).toMatchObject({ kind: "balance", amount: "12" });
  });
  it("some balance rounds up to a whole MUSD plus 5", () => {
    expect(tryScenario(true, m(3) + 1n)).toMatchObject({ kind: "split", amount: "9" });
    expect(tryScenario(true, m(11))).toMatchObject({ kind: "split", amount: "16" });
  });
  it("empty balance borrows all", () => {
    expect(tryScenario(true, 0n)).toMatchObject({ kind: "borrow", amount: "12" });
  });
});
