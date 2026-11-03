import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createFaucetHandler, faucetClaimWei } from "@/lib/faucet";
import { ADDRESSES, MEZO_TESTNET, priceFeedAbi } from "@/lib/mezo";

export const runtime = "nodejs";

const client = createPublicClient({ chain: MEZO_TESTNET, transport: http() });
// Its own key, never the relayer's. Server only, never logged.
function loadAccount() {
  const key = process.env.FAUCET_PRIVATE_KEY as Hex | undefined;
  if (!key) return undefined;
  try {
    return privateKeyToAccount(key);
  } catch {
    // a malformed key reads as unset; never print the key or viem's message
    console.info(JSON.stringify({ route: "/api/faucet", error: "invalid_faucet_key" }));
    return undefined;
  }
}
const account = loadAccount();
const wallet = account ? createWalletClient({ account, chain: MEZO_TESTNET, transport: http() }) : undefined;

const handler = createFaucetHandler({
  async claimWei() {
    const price = await client.readContract({ address: ADDRESSES.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" });
    return faucetClaimWei(price, process.env.FAUCET_CLAIM_WEI);
  },
  balanceOf: (addr) => client.getBalance({ address: addr }),
  // No key reads as empty, which the handler maps to 503 faucet_empty.
  faucetBalanceWei: async () => (account ? client.getBalance({ address: account.address }) : 0n),
  send: (to, wei) => wallet!.sendTransaction({ to, value: wei }),
  now: () => Date.now(),
});

export function POST(req: Request): Promise<Response> {
  return handler(req);
}
