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

// Open Troves at earlier blocks (needs an archive RPC; the default one is). Shows how many were closed or redeemed away.
for (const b of [5_000_000n, 10_400_000n, 12_400_000n, 12_749_209n]) {
  try {
    const blk = await client.getBlock({ blockNumber: b });
    const k = await client.readContract({ address: TROVE_MANAGER, abi: tm, functionName: "getTroveOwnersCount", blockNumber: b });
    console.log(`Open Troves at block ${b} (${new Date(Number(blk.timestamp) * 1000).toISOString().slice(0, 10)}): ${k}`);
  } catch {
    console.log(`Open Troves at block ${b}: RPC has no state for it`);
  }
}

// redeemCollateral calls to the TroveManager, from the Mezo explorer API (the newest 1,000 transactions at most).
// The indexer marks many as "error: awaiting_internal_transactions", which is not a revert, so only "success" is counted as sure.
try {
  const base = `https://api.explorer.mezo.org/api/v2/addresses/${TROVE_MANAGER}/transactions?filter=to`;
  const txs = [];
  let q = "";
  for (let i = 0; i < 20; i++) {
    const j = await (await fetch(base + q)).json();
    txs.push(...j.items);
    if (!j.next_page_params) break;
    q = "&" + new URLSearchParams(Object.entries(j.next_page_params).map(([k, v]) => [k, String(v)]));
  }
  const red = txs.filter((t) => t.method === "redeemCollateral");
  const dates = txs.map((t) => t.timestamp).sort();
  console.log(
    `redeemCollateral in the newest ${txs.length} TroveManager txs (${dates[0]?.slice(0, 10)} to ${dates.at(-1)?.slice(0, 10)}): ${red.length}, of which ${red.filter((t) => t.status === "ok").length} marked success`,
  );
} catch (e) {
  console.log(`redeemCollateral count unavailable: ${e.message}`);
}
