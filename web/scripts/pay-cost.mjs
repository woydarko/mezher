// Cost of one sponsored `pay` in USD, and the payment size whose 0.5% fee covers it.
// Run: node scripts/pay-cost.mjs [gas]   (read-only, public RPC, no keys). Default gas: 679,312 (fork measurement).
import { createPublicClient, http, parseAbi } from "viem";

const RPC = process.env.MEZO_MAINNET_RPC_URL ?? "https://mainnet.mezo.public.validationcloud.io";
const PRICE_FEED = "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88";
const gas = BigInt(process.argv[2] ?? 679312);
const FEE_BPS = 50n;

const client = createPublicClient({ transport: http(RPC) });
const gasPrice = await client.getGasPrice(); // wei of BTC per gas
const price = await client.readContract({
  address: PRICE_FEED,
  abi: parseAbi(["function fetchPrice() view returns (uint256)"]),
  functionName: "fetchPrice",
}); // USD per BTC, 1e18
const costUsdE18 = (gas * gasPrice * price) / 10n ** 18n; // USD, 1e18
const breakEvenE18 = (costUsdE18 * 10000n) / FEE_BPS;
const wholeMusd = (breakEvenE18 + 10n ** 18n - 1n) / 10n ** 18n;
console.log(`block ${await client.getBlockNumber()}, gas price ${gasPrice} wei, BTC $${Number(price) / 1e18}`);
console.log(`gas ${gas}: ${gas * gasPrice} wei BTC = $${Number(costUsdE18) / 1e18} per pay`);
console.log(`break-even at ${FEE_BPS} bps: $${Number(breakEvenE18) / 1e18}, rounded up ${wholeMusd} MUSD`);
