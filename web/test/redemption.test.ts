import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { ADDRESSES } from "@/lib/mezo";
import { readRefinanceFee, redemptionAhead } from "@/lib/redemption";

const E18 = 10n ** 18n;
const ZERO: Address = "0x0000000000000000000000000000000000000000";
const a = (n: number) => ("0x" + n.toString(16).padStart(40, "0")) as Address;

/** List from riskiest (index 0) to safest; getLast = first, getPrev = next index. */
function listClient(troves: { id: Address; debtWei: bigint }[]) {
  const reads: string[] = [];
  const client = {
    readContract: async (req: { functionName: string; args?: readonly unknown[] }) => {
      reads.push(req.functionName);
      const i = troves.findIndex((t) => t.id === req.args?.[0]);
      if (req.functionName === "getLast") return troves[0]?.id ?? ZERO;
      if (req.functionName === "getPrev") return troves[i + 1]?.id ?? ZERO;
      if (req.functionName === "getTroveDebt") return troves[i].debtWei;
      throw new Error("unexpected " + req.functionName);
    },
  } as never;
  return { client, reads };
}

const LIST = [1, 2, 3, 4].map((n) => ({ id: a(n), debtWei: BigInt(n) * 1000n * E18 }));

describe("redemptionAhead", () => {
  it("returns 0 debt ahead for the lowest-ratio Trove", async () => {
    const { client } = listClient(LIST);
    expect(await redemptionAhead(client, a(1))).toEqual({ debtAheadWei: 0n, positionFromRisk: 0, truncated: false, found: true });
  });

  it("sums the debt of every lower-ratio Trove", async () => {
    const { client } = listClient(LIST);
    expect(await redemptionAhead(client, a(3))).toEqual({
      debtAheadWei: 3000n * E18,
      positionFromRisk: 2,
      truncated: false,
      found: true,
    });
  });

  it("marks truncated when it stops at maxSteps", async () => {
    const { client } = listClient(LIST);
    expect(await redemptionAhead(client, a(4), 2)).toEqual({ debtAheadWei: 3000n * E18, positionFromRisk: 2, truncated: true, found: false });
  });

  it("finds the payer exactly at the maxSteps boundary", async () => {
    const { client } = listClient(LIST);
    expect(await redemptionAhead(client, a(3), 2)).toMatchObject({ positionFromRisk: 2, truncated: false });
  });

  it("reports found: false with zeros when the payer is not in the list", async () => {
    const { client } = listClient(LIST);
    expect(await redemptionAhead(client, a(9))).toEqual({
      debtAheadWei: 0n,
      positionFromRisk: 0,
      truncated: false,
      found: false,
    });
  });
});

describe("readRefinanceFee", () => {
  it("charges the borrowing fee on refinancingFeePercentage of net debt (debt minus 200 gas compensation)", async () => {
    const calls: { functionName: string; args?: readonly unknown[] }[] = [];
    const client = {
      readContract: async (req: { address: Address; functionName: string; args?: readonly unknown[] }) => {
        calls.push(req);
        if (req.functionName === "refinancingFeePercentage") return 20;
        return ((req.args![0] as bigint) * 10n ** 15n) / E18; // 0.1%
      },
    } as never;
    // net debt 1000 -> 20% = 200 -> 0.1% = 0.2 MUSD
    expect(await readRefinanceFee(client, 1200n * E18)).toBe(E18 / 5n);
    expect(calls[1]).toMatchObject({ address: ADDRESSES.borrowerOperations, functionName: "getBorrowingFee", args: [200n * E18] });
  });
});
