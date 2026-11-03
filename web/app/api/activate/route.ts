import { createActivateHandler, type ActivateRequest } from "@/lib/activate";
import { ADDRESSES, musdAbi } from "@/lib/mezo";
import { account, decodeAbi, publicClient, relayerBalanceWei, revertReason, walletClient } from "@/lib/relayer";

export const runtime = "nodejs";

function permitArgs({ permit: p }: ActivateRequest) {
  return [p.owner, p.spender, p.value, p.deadline, p.v, p.r, p.s] as const;
}

// No deployed MezherPay means there is no valid spender, so the route answers 503 instead of building a handler.
const mezherPay = ADDRESSES.mezherPay;
const handler = mezherPay
  ? createActivateHandler({
      mezherPay,
      relayerBalanceWei,
      async simulate(r) {
        try {
          await publicClient.simulateContract({
            account,
            address: ADDRESSES.musd,
            abi: decodeAbi,
            functionName: "permit",
            args: permitArgs(r),
          });
          return { ok: true };
        } catch (err) {
          return { ok: false, reason: revertReason(err) };
        }
      },
      async send(r) {
        return walletClient!.writeContract({
          address: ADDRESSES.musd,
          abi: musdAbi,
          functionName: "permit",
          args: permitArgs(r),
        });
      },
      now: () => Date.now(),
    })
  : null;

export function POST(req: Request): Promise<Response> {
  return handler ? handler(req) : Promise.resolve(Response.json({ error: "relayer_unavailable" }, { status: 503 }));
}
