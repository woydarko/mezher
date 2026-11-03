import { zeroAddress, type Address, type PublicClient } from "viem";
import { ADDRESSES, borrowerOperationsAbi, sortedTrovesAbi, troveManagerAbi } from "./mezo";
import { GAS_COMPENSATION_WEI } from "./trove";

type ReadClient = { readContract: PublicClient["readContract"] };

export type RedemptionAhead = { debtAheadWei: bigint; positionFromRisk: number; truncated: boolean; found: boolean };

/**
 * Redemptions take Troves from SortedTroves.getLast() (lowest NICR) upward via getPrev.
 * Sums the debt of the Troves strictly ahead of the payer; `truncated` when maxSteps ran out first.
 */
export async function redemptionAhead(client: ReadClient, payer: Address, maxSteps = 50): Promise<RedemptionAhead> {
  const st = { address: ADDRESSES.sortedTroves, abi: sortedTrovesAbi } as const;
  let cur = await client.readContract({ ...st, functionName: "getLast" });
  let debtAheadWei = 0n;
  for (let i = 0; ; i++) {
    if (cur === zeroAddress) return { debtAheadWei: 0n, positionFromRisk: 0, truncated: false, found: false }; // payer not in the list
    if (cur.toLowerCase() === payer.toLowerCase()) return { debtAheadWei, positionFromRisk: i, truncated: false, found: true };
    if (i === maxSteps) return { debtAheadWei, positionFromRisk: i, truncated: true, found: false };
    const [debt, prev] = await Promise.all([
      client.readContract({ address: ADDRESSES.troveManager, abi: troveManagerAbi, functionName: "getTroveDebt", args: [cur] }),
      client.readContract({ ...st, functionName: "getPrev", args: [cur] }),
    ]);
    debtAheadWei += debt;
    cur = prev;
  }
}

/**
 * Fee BorrowerOperations.refinance charges: the borrowing fee on refinancingFeePercentage % of net debt
 * (debt minus gas compensation). Interest accruing before the tx can move it by a few wei.
 */
export async function readRefinanceFee(client: ReadClient, debtWei: bigint): Promise<bigint> {
  const bo = { address: ADDRESSES.borrowerOperations, abi: borrowerOperationsAbi } as const;
  const pct = await client.readContract({ ...bo, functionName: "refinancingFeePercentage" });
  const amount = (BigInt(pct) * (debtWei - GAS_COMPENSATION_WEI)) / 100n;
  return client.readContract({ ...bo, functionName: "getBorrowingFee", args: [amount] });
}
