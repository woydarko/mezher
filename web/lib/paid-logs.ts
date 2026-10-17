import { getAbiItem, type Address, type Hex, type PublicClient } from "viem";
import { ADDRESSES, mezherPayAbi } from "./mezo";

export type PaidLog = {
  orderId: Hex;
  payer: Address;
  merchant: Address;
  amountWei: bigint;
  fromBalanceWei: bigint;
  borrowedWei: bigint;
  txHash: Hex;
  blockNumber: bigint;
};

type LogClient = { getLogs: PublicClient["getLogs"]; getBlockNumber(): Promise<bigint> };

const CHUNK = 10_000n; // RPC log-range limit per call
const PAID_EVENT = getAbiItem({ abi: mezherPayAbi, name: "Paid" });

/** Paid events for `merchant` (and `orderId` when given) from `fromBlock` to head, newest first. */
export async function fetchPaidLogs(
  client: LogClient,
  a: { merchant: Address; orderId?: Hex; fromBlock: bigint },
): Promise<PaidLog[]> {
  const head = await client.getBlockNumber();
  const out: PaidLog[] = [];
  for (let from = a.fromBlock; from <= head; from += CHUNK) {
    const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
    const logs = await client.getLogs({
      address: ADDRESSES.mezherPay,
      event: PAID_EVENT,
      args: a.orderId ? { merchant: a.merchant, orderId: a.orderId } : { merchant: a.merchant },
      fromBlock: from,
      toBlock: to,
    });
    for (const l of logs) {
      out.push({
        orderId: l.args.orderId!,
        payer: l.args.payer!,
        merchant: l.args.merchant!,
        amountWei: l.args.amount!,
        fromBalanceWei: l.args.fromBalance!,
        borrowedWei: l.args.borrowed!,
        txHash: l.transactionHash!,
        blockNumber: l.blockNumber!,
      });
    }
  }
  return out.sort((x, y) => (x.blockNumber === y.blockNumber ? 0 : x.blockNumber > y.blockNumber ? -1 : 1));
}

/** Only a payment of at least the requested amount marks the order paid, so a 1-wei payment cannot. */
export function isOrderPaid(logs: PaidLog[], orderId: Hex, amountWei: bigint): boolean {
  return logs.some((l) => l.orderId.toLowerCase() === orderId.toLowerCase() && l.amountWei >= amountWei);
}
