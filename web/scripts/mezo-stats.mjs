// Reads Mezo mainnet MUSD state for the "why Mezher" numbers: how much MUSD credit Bitcoin
// holders could still draw before their Trove falls under Mezher's 150% floor.
// Run: node scripts/mezo-stats.mjs   (read-only, public RPC, no keys)
import { createPublicClient, http, parseAbi, formatUnits } from "viem";

const RPC = process.env.MEZO_MAINNET_RPC_URL ?? "https://mainnet.mezo.public.validationcloud.io";
// Mezo mainnet (31612), from mezo-org/musd solidity/artifacts/deployments/mainnet.
const TROVE_MANAGER = "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193";
const MUSD = "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186";
const PRICE_FEED = "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88";
const STABILITY_POOL = "0x73245Eff485aB3AAc1158B3c4d8f4b23797B0e32";
const FLOOR = 15n * 10n ** 17n; // 150%, MezherPay.MIN_ICR_AFTER
const E18 = 10n ** 18n;

const tm = parseAbi([
  "function getTroveOwnersCount() view returns (uint256)",
  "function getTroveFromTroveOwnersArray(uint256) view returns (address)",
  "function getTroveColl(address) view returns (uint256)",
  "function getTroveDebt(address) view returns (uint256)",
  "function getTCR(uint256) view returns (uint256)",
]);
const client = createPublicClient({ transport: http(RPC) });
const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });

const block = await client.getBlockNumber();
const price = await read(PRICE_FEED, parseAbi(["function fetchPrice() view returns (uint256)"]), "fetchPrice");
const count = await read(TROVE_MANAGER, tm, "getTroveOwnersCount");
const supply = await read(MUSD, parseAbi(["function totalSupply() view returns (uint256)"]), "totalSupply");
const spDeposits = await read(
  STABILITY_POOL,
  parseAbi(["function getTotalMUSDDeposits() view returns (uint256)"]),
  "getTotalMUSDDeposits",
);
const tcr = await read(TROVE_MANAGER, tm, "getTCR", [price]);

let coll = 0n, debt = 0n, headroom = 0n, withHeadroom = 0;
const n = Number(count);
for (let i = 0; i < n; i += 20) {
  const idx = Array.from({ length: Math.min(20, n - i) }, (_, k) => BigInt(i + k));
  const owners = await Promise.all(idx.map((j) => read(TROVE_MANAGER, tm, "getTroveFromTroveOwnersArray", [j])));
  const rows = await Promise.all(
    owners.map(async (o) => [await read(TROVE_MANAGER, tm, "getTroveColl", [o]), await read(TROVE_MANAGER, tm, "getTroveDebt", [o])]),
  );
  for (const [c, d] of rows) {
    coll += c;
    debt += d;
    // MUSD this Trove can still borrow and stay at or above 150%.
    const room = (c * price) / FLOOR - d;
    if (room > 0n) {
      headroom += room;
      withHeadroom++;
    }
  }
}

const usd = (v) => Math.round(Number(formatUnits(v, 18))).toLocaleString("en-US");
console.log(`Mezo mainnet, block ${block}`);
console.log(`BTC price (Mezo PriceFeed):        $${usd(price)}`);
console.log(`Open Troves:                       ${n}`);
console.log(`BTC locked in Troves:              ${Number(formatUnits(coll, 18)).toFixed(4)} BTC ($${usd((coll * price) / E18)})`);
console.log(`MUSD debt in Troves:               ${usd(debt)} MUSD`);
console.log(`System collateral ratio (TCR):     ${(Number(formatUnits(tcr, 16))).toFixed(1)}%`);
console.log(`MUSD total supply:                 ${usd(supply)}`);
console.log(`MUSD in Stability Pool:            ${usd(spDeposits)}`);
console.log(`Unused credit above 150%:          ${usd(headroom)} MUSD across ${withHeadroom} Troves`);
