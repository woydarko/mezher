import { getAbiItem, getAddress, isAddress, zeroAddress, type Address, type Hex, type PublicClient } from "viem";
import { ADDRESSES, mezherPayAbi } from "./mezo";
import type { PaidLog } from "./paid-logs";

/** Wallets we control; they never count as outside. Extend with env NEXT_PUBLIC_TEAM_WALLETS (comma separated). */
const BASE_TEAM: Address[] = ["0xcEc048337868f8cfeE21613591C53B5f690847Fa"];

export function parseTeamWallets(env: string | undefined): Address[] {
  return (env ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => isAddress(s))
    .map((s) => getAddress(s));
}

export const TEAM_WALLETS: Address[] = [...BASE_TEAM, ...parseTeamWallets(process.env.NEXT_PUBLIC_TEAM_WALLETS)];

export const isTeam = (a: Address, team: Address[] = TEAM_WALLETS) => team.some((t) => t.toLowerCase() === a.toLowerCase());

/** Outside = not a team wallet and not the zero address; each address is counted once. */
export function summarizeProof(logs: PaidLog[], teamWallets: Address[]) {
  const outside = (pick: (l: PaidLog) => Address): Address[] => {
    const seen = new Map<string, Address>();
    for (const l of logs) {
      const a = pick(l);
      if (a.toLowerCase() !== zeroAddress && !isTeam(a, teamWallets)) seen.set(a.toLowerCase(), getAddress(a));
    }
    return [...seen.values()];
  };
  return {
    payments: logs.length,
    outsidePayers: outside((l) => l.payer),
    outsideMerchants: outside((l) => l.merchant),
    volumeWei: logs.reduce((sum, l) => sum + l.amountWei, 0n),
  };
}

const OPENED_EVENT = getAbiItem({ abi: mezherPayAbi, name: "OpenedAtCheckout" });
const CHUNK = 10_000n; // RPC log-range limit per call

type OpenedClient = { getLogs: PublicClient["getLogs"]; getBlockNumber(): Promise<bigint> };

/** Tx hashes of payments that opened a Trove at checkout (the `openAndPay` path), from `fromBlock` to head. */
export async function fetchOpenedTxs(client: OpenedClient, fromBlock: bigint): Promise<Set<Hex>> {
  const head = await client.getBlockNumber();
  const out = new Set<Hex>();
  for (let from = fromBlock; from <= head; from += CHUNK) {
    const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
    const logs = await client.getLogs({ address: ADDRESSES.mezherPay, event: OPENED_EVENT, fromBlock: from, toBlock: to });
    for (const l of logs) out.add(l.transactionHash!);
  }
  return out;
}
