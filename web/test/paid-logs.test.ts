import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { fetchBlockTimes, fetchPaidLogs, isOrderPaid, type PaidLog } from "@/lib/paid-logs";

const MERCHANT: Address = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";
const PAYER: Address = "0x11a632076c274C8A29F09AD241Ef6c46118e9be3";
const ORDER = ("0x" + "0".repeat(48) + "3f9a1c0d2b4e5f60") as Hex;

function rawLog(blockNumber: bigint, amount: bigint) {
  return {
    blockNumber,
    transactionHash: ("0x" + blockNumber.toString(16).padStart(64, "0")) as Hex,
    args: { orderId: ORDER, payer: PAYER, merchant: MERCHANT, amount, fromBalance: 0n, borrowed: amount },
  };
}

describe("fetchPaidLogs", () => {
  it("fetchPaidLogs splits range into 10k-block chunks", async () => {
    const ranges: [bigint, bigint][] = [];
    const client = {
      getBlockNumber: async () => 25_150n,
      getLogs: async (a: { fromBlock: bigint; toBlock: bigint }) => {
        ranges.push([a.fromBlock, a.toBlock]);
        return [];
      },
    };
    await fetchPaidLogs(client as never, { merchant: MERCHANT, fromBlock: 100n });
    expect(ranges).toEqual([
      [100n, 10_099n],
      [10_100n, 20_099n],
      [20_100n, 25_150n],
    ]);
  });

  it("filters by merchant (and order when given) and returns newest first", async () => {
    const seen: unknown[] = [];
    const client = {
      getBlockNumber: async () => 30_000n,
      getLogs: async (a: { fromBlock: bigint; args: unknown }) => {
        seen.push(a.args);
        if (a.fromBlock === 0n) return [rawLog(5n, 1n), rawLog(9n, 2n)];
        return a.fromBlock === 20_000n ? [rawLog(20_001n, 3n)] : [];
      },
    };
    const logs = await fetchPaidLogs(client as never, { merchant: MERCHANT, orderId: ORDER, fromBlock: 0n });
    expect(seen[0]).toEqual({ merchant: MERCHANT, orderId: ORDER });
    expect(logs.map((l) => l.blockNumber)).toEqual([20_001n, 9n, 5n]);
    expect(logs[0]).toMatchObject({ amountWei: 3n, borrowedWei: 3n, orderId: ORDER, payer: PAYER, merchant: MERCHANT });
  });
});

describe("fetchPaidLogs filters", () => {
  async function argsFor(filter: Parameters<typeof fetchPaidLogs>[1]) {
    const seen: unknown[] = [];
    const client = {
      getBlockNumber: async () => 10n,
      getLogs: async (a: { args?: unknown }) => {
        seen.push(a.args);
        return [];
      },
    };
    await fetchPaidLogs(client as never, filter);
    return seen[0];
  }

  it("filters by payer for the payer dashboard", async () => {
    expect(await argsFor({ payer: PAYER, fromBlock: 0n })).toEqual({ payer: PAYER });
  });

  it("reads every payment for the public stats", async () => {
    expect(await argsFor({ fromBlock: 0n })).toBeUndefined();
  });
});

describe("fetchBlockTimes", () => {
  it("reads each block once and maps it to its timestamp in seconds", async () => {
    const asked: bigint[] = [];
    const client = {
      getBlock: async ({ blockNumber }: { blockNumber: bigint }) => {
        asked.push(blockNumber);
        return { timestamp: blockNumber * 10n };
      },
    };
    const times = await fetchBlockTimes(client as never, [5n, 9n, 5n]);
    expect(asked).toEqual([5n, 9n]);
    expect(times.get(9n)).toBe(90);
  });
});

describe("isOrderPaid", () => {
  const log = (amountWei: bigint): PaidLog => ({
    orderId: ORDER,
    payer: PAYER,
    merchant: MERCHANT,
    amountWei,
    fromBalanceWei: 0n,
    borrowedWei: amountWei,
    txHash: ("0x" + "1".repeat(64)) as Hex,
    blockNumber: 1n,
  });

  it("is true when a log for the order covers the amount", () => {
    expect(isOrderPaid([log(12n)], ORDER, 12n)).toBe(true);
  });

  it("is false when the logged amount is lower than requested (a 1-wei fake cannot mark an order paid)", () => {
    expect(isOrderPaid([log(1n)], ORDER, 12n)).toBe(false);
  });

  it("is false for another order", () => {
    expect(isOrderPaid([log(12n)], ("0x" + "f".repeat(64)) as Hex, 12n)).toBe(false);
  });
});
