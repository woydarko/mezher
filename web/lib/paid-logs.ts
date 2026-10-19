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

/**
 * Paid events from `fromBlock` to head, newest first, filtered on the indexed topics given
 * (merchant, payer, orderId); no filter reads every payment.
 */
export async function fetchPaidLogs(
  client: LogClient,
  a: { merchant?: Address; payer?: Address; orderId?: Hex; fromBlock: bigint },
): Promise<PaidLog[]> {
  const head = await client.getBlockNumber();
  const filter = {
    ...(a.merchant ? { merchant: a.merchant } : {}),
    ...(a.orderId ? { orderId: a.orderId } : {}),
    ...(a.payer ? { payer: a.payer } : {}),
  };
  const args = Object.keys(filter).length > 0 ? filter : undefined;
  const out: PaidLog[] = [];
  for (let from = a.fromBlock; from <= head; from += CHUNK) {
    const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
    const logs = await client.getLogs({
      address: ADDRESSES.mezherPay,
      event: PAID_EVENT,
      args,
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

type BlockClient = { getBlock(a: { blockNumber: bigint }): Promise<{ timestamp: bigint }> };

/** Unix seconds for each distinct block (Paid logs carry block numbers, the charts need days). */
export async function fetchBlockTimes(client: BlockClient, blocks: bigint[]): Promise<Map<bigint, number>> {
  const out = new Map<bigint, number>();
  for (const blockNumber of new Set(blocks)) {
    const block = await client.getBlock({ blockNumber });
    out.set(blockNumber, Number(block.timestamp));
  }
  return out;
}

/** Only a payment of at least the requested amount marks the order paid, so a 1-wei payment cannot. */
export function isOrderPaid(logs: PaidLog[], orderId: Hex, amountWei: bigint): boolean {
  return logs.some((l) => l.orderId.toLowerCase() === orderId.toLowerCase() && l.amountWei >= amountWei);
}
