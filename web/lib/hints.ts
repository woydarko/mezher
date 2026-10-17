import type { Address, PublicClient } from "viem";
import { ADDRESSES, hintHelpersAbi, sortedTrovesAbi } from "./mezo";

export type HintClient = { readContract: PublicClient["readContract"] };

const HINT_TRIALS = 15n;

/** Liquity-style insert hints for the payer's Trove at its post-borrow nominal ICR. */
export async function getBorrowHints(
  client: HintClient,
  a: { collWei: bigint; debtAfterWei: bigint },
): Promise<{ upperHint: Address; lowerHint: Address }> {
  const nicr = (a.collWei * 10n ** 20n) / a.debtAfterWei;
  const seed = BigInt(crypto.getRandomValues(new Uint32Array(1))[0]);
  const [hint] = await client.readContract({
    address: ADDRESSES.hintHelpers,
    abi: hintHelpersAbi,
    functionName: "getApproxHint",
    args: [nicr, HINT_TRIALS, seed],
  });
  const [upperHint, lowerHint] = await client.readContract({
    address: ADDRESSES.sortedTroves,
    abi: sortedTrovesAbi,
    functionName: "findInsertPosition",
    args: [nicr, hint, hint],
  });
  return { upperHint, lowerHint };
}
