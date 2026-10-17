import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ADDRESSES, MEZO_TESTNET, mezherPayAbi } from "@/lib/mezo";
import { createRelayHandler, type RelayRequest } from "@/lib/relay";

export const runtime = "nodejs";

// MUSD reverts with OZ ERC20 errors; listing them lets viem decode the name for the UI copy.
const decodeAbi = [
  ...mezherPayAbi,
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
] as const;

const publicClient = createPublicClient({ chain: MEZO_TESTNET, transport: http() });
const key = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
const account = key ? privateKeyToAccount(key) : undefined;
const walletClient = account ? createWalletClient({ account, chain: MEZO_TESTNET, transport: http() }) : undefined;

function payArgs(r: RelayRequest) {
  return [r.payment, r.permit, r.borrow] as const;
}

/** Revert name or string; anything else (RPC down, timeout) rethrows so the handler answers 503. */
function revertReason(err: unknown): string {
  const revert = err instanceof BaseError ? err.walk((e) => e instanceof ContractFunctionRevertedError) : null;
  if (!(revert instanceof ContractFunctionRevertedError)) throw err;
  return revert.data?.errorName ?? revert.reason ?? revert.signature ?? "unknown";
}

const handler = createRelayHandler({
  async relayerBalanceWei() {
    // No key or no deployed contract reads as an empty relayer, which the handler maps to 503.
    if (!account || !ADDRESSES.mezherPay) return 0n;
    return publicClient.getBalance({ address: account.address });
  },
  async simulate(r) {
    try {
      await publicClient.simulateContract({
        account,
        address: ADDRESSES.mezherPay!,
        abi: decodeAbi,
        functionName: "pay",
        args: payArgs(r),
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: revertReason(err) };
    }
  },
  async send(r) {
    return walletClient!.writeContract({
      address: ADDRESSES.mezherPay!,
      abi: mezherPayAbi,
      functionName: "pay",
      args: payArgs(r),
    });
  },
  now: () => Date.now(),
});

export function POST(req: Request): Promise<Response> {
  return handler(req);
}
