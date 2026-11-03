// Server only: the relayer's clients and revert decoding, shared by /api/relay and /api/activate.
import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ADDRESSES, MEZO_TESTNET, mezherPayCallAbi, musdAbi } from "@/lib/mezo";

// MezherPay and MUSD calls, with the MUSD errors, so a simulation names its revert.
export const decodeAbi = [...mezherPayCallAbi, ...musdAbi] as const;

export const publicClient = createPublicClient({ chain: MEZO_TESTNET, transport: http() });
const key = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
export const account = key ? privateKeyToAccount(key) : undefined;
export const walletClient = account ? createWalletClient({ account, chain: MEZO_TESTNET, transport: http() }) : undefined;

export async function relayerBalanceWei(): Promise<bigint> {
  // No key or no deployed contract reads as an empty relayer, which the handlers map to 503.
  if (!account || !ADDRESSES.mezherPay) return 0n;
  return publicClient.getBalance({ address: account.address });
}

/** Revert name or string; anything else (RPC down, timeout) rethrows so the handler answers 503. */
export function revertReason(err: unknown): string {
  const revert = err instanceof BaseError ? err.walk((e) => e instanceof ContractFunctionRevertedError) : null;
  if (!(revert instanceof ContractFunctionRevertedError)) throw err;
  return revert.data?.errorName ?? revert.reason ?? revert.signature ?? "unknown";
}
