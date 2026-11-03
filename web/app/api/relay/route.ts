import { createRelayHandler, type RelayRequest } from "@/lib/relay";
import { ADDRESSES, mezherPayAbi } from "@/lib/mezo";
import { account, decodeAbi, publicClient, relayerBalanceWei, revertReason, walletClient } from "@/lib/relayer";

export const runtime = "nodejs";

function payArgs(r: RelayRequest) {
  return [r.order, r.orderSig, r.permit, r.borrow] as const;
}

const handler = createRelayHandler({
  relayerBalanceWei,
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
