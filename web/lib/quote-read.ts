import type { Address, PublicClient } from "viem";
import { ADDRESSES, borrowerOperationsAbi, musdAbi, priceFeedAbi, troveManagerAbi } from "./mezo";
import { toTroveState, type QuoteInput } from "./quote";

export type QuoteReads = Omit<QuoteInput, "amountWei" | "minIcrE18">;

/** Everything quote() needs, read from chain. Used by both the screen and the pre-signing re-read. */
export async function readQuoteInputs(client: PublicClient, owner: Address, amountWei: bigint): Promise<QuoteReads> {
  const read = client.readContract;
  const priceE18 = await read({ address: ADDRESSES.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" });
  const tm = { address: ADDRESSES.troveManager, abi: troveManagerAbi } as const;
  const [balanceWei, status, debtAndColl, capacityWei, recoveryMode] = await Promise.all([
    read({ address: ADDRESSES.musd, abi: musdAbi, functionName: "balanceOf", args: [owner] }),
    read({ ...tm, functionName: "getTroveStatus", args: [owner] }),
    read({ ...tm, functionName: "getEntireDebtAndColl", args: [owner] }),
    read({ ...tm, functionName: "getTroveMaxBorrowingCapacity", args: [owner] }),
    read({ ...tm, functionName: "checkRecoveryMode", args: [priceE18] }),
  ]);
  const borrow = amountWei - (balanceWei < amountWei ? balanceWei : amountWei);
  const feeWei =
    borrow > 0n
      ? await read({ address: ADDRESSES.borrowerOperations, abi: borrowerOperationsAbi, functionName: "getBorrowingFee", args: [borrow] })
      : 0n;
  return { balanceWei, trove: toTroveState(status, debtAndColl), priceE18, feeWei, capacityWei, recoveryMode };
}
