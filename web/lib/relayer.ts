// Server only: the relayer's clients and revert decoding, shared by /api/relay and /api/activate.
import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ADDRESSES, MEZO_TESTNET, mezherPayAbi, musdAbi } from "@/lib/mezo";

// MUSD reverts with OZ errors; listing them lets viem decode the name for the UI copy.
export const decodeAbi = [
  ...mezherPayAbi,
  ...musdAbi,
  {
    type: "error",
    name: "ERC20InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InsufficientAllowance",
    inputs: [
      { name: "spender", type: "address" },
      { name: "allowance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  { type: "error", name: "ERC2612InvalidSigner", inputs: [{ name: "signer", type: "address" }, { name: "owner", type: "address" }] },
  { type: "error", name: "ERC2612ExpiredSignature", inputs: [{ name: "deadline", type: "uint256" }] },
] as const;

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
