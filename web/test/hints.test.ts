import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getBorrowHints, type HintClient } from "@/lib/hints";
import { ADDRESSES } from "@/lib/mezo";

const HINT: Address = "0xb8c3c58e9635900F7BE8f3aF66f36EA8C6B411dE";
const UPPER: Address = "0x0000000000000000000000000000000000000001";
const LOWER: Address = "0x52d033E64774F31A8B7562806aA5782CbbD29382";

describe("getBorrowHints", () => {
  it("asks HintHelpers for an approx hint, then SortedTroves for the insert position at the post-borrow NICR", async () => {
    const calls: { address: Address; functionName: string; args: readonly unknown[] }[] = [];
    const client = {
      readContract: async (req: { address: Address; functionName: string; args: readonly unknown[] }) => {
        calls.push(req);
        if (req.functionName === "getApproxHint") return [HINT, 0n, 0n];
        return [UPPER, LOWER];
      },
    } as unknown as HintClient;

    const collWei = 4n * 10n ** 16n;
    const debtAfterWei = 2007n * 10n ** 18n;
    const hints = await getBorrowHints(client, { collWei, debtAfterWei });

    const nicr = (collWei * 10n ** 20n) / debtAfterWei;
    expect(calls[0]).toMatchObject({ address: ADDRESSES.hintHelpers, functionName: "getApproxHint" });
    expect(calls[0].args.slice(0, 2)).toEqual([nicr, 15n]);
    expect(calls[1]).toMatchObject({
      address: ADDRESSES.sortedTroves,
      functionName: "findInsertPosition",
      args: [nicr, HINT, HINT],
    });
    expect(hints).toEqual({ upperHint: UPPER, lowerHint: LOWER });
  });
});
