import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { PaidLog } from "@/lib/paid-logs";
import { buildTeamWallets, parseTeamWallets, summarizeProof, TEAM_WALLETS } from "@/lib/proof";
import { tryNote, tryScenarios, sponsored } from "@/lib/try";

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
  it("accepts a mixed-case address with a wrong checksum instead of dropping it", () => {
    const mixed = "0x" + OUT1.slice(2).toUpperCase(); // fails the strict checksum
    expect(parseTeamWallets(mixed)).toEqual([OUT1]);
  });
  it("counts the demo merchant as team", () => {
    const team = buildTeamWallets(undefined, OUT2.toLowerCase());
    expect(team).toContain(OUT2);
    expect(summarizeProof([log(OUT1, OUT2)], team).outsideMerchants).toEqual([]);
    expect(buildTeamWallets(undefined, undefined)).toEqual(TEAM_WALLETS.slice(0, 1));
  });
});

describe("tryScenarios", () => {
  const m = (n: number) => BigInt(n) * 10n ** 18n;
  const kinds = (status: number, bal: bigint) => tryScenarios(status, bal).map((s) => s.kind);
  it("no Trove and little MUSD opens one and pays 20", () => {
    expect(tryScenarios(0, m(3))).toMatchObject([{ kind: "open", amount: "20" }]);
  });
  it("no Trove but 20 MUSD pays from balance instead of promising to open one", () => {
    expect(tryScenarios(0, m(1788))).toMatchObject([{ kind: "balance", amount: "20" }]);
  });
  it("a Trove and 20 MUSD offers balance and a split that still borrows", () => {
    expect(tryScenarios(1, m(20))).toMatchObject([
      { kind: "balance", amount: "20" },
      { kind: "split", amount: "25" },
    ]);
    expect(tryScenarios(1, m(1788) + 1n)).toMatchObject([{ kind: "balance" }, { kind: "split", amount: "1794" }]);
  });
  it("some balance under 20 rounds up to a whole MUSD plus 5", () => {
    expect(tryScenarios(1, m(3) + 1n)).toMatchObject([{ kind: "split", amount: "9" }]);
    expect(tryScenarios(1, m(11))).toMatchObject([{ kind: "split", amount: "16" }]);
  });
  it("empty balance borrows all 20", () => {
    expect(tryScenarios(1, 0n)).toMatchObject([{ kind: "borrow", amount: "20" }]);
  });
  it("says a fully borrowed payment needs an empty balance only when there is a balance and a Trove", () => {
    expect(tryNote(1, m(5))).toMatch(/empty balance/);
    expect(tryNote(1, 0n)).toBeUndefined();
    expect(tryNote(0, m(5))).toBeUndefined();
    expect(kinds(1, m(5))).not.toContain("borrow");
  });
  it("20 MUSD is sponsored, the old 12 was not", () => {
    expect(sponsored("20")).toBe(true);
    expect(sponsored("12")).toBe(false);
  });
});
