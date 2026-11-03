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

// redeemCollateral calls to the TroveManager: hashes from the Mezo explorer API (newest 1,000 transactions at most),
// outcomes from the receipts on the RPC. The explorer's own status ("error: awaiting_internal_transactions") is NOT used:
// receipts show those calls reverted (status 0x0, no logs).
const REDEMPTION_TOPIC = "0x43a3f4082a4dbc33d78e317d2497d3a730bc7fc3574159dcea1056e62e5d9ad8"; // Redemption(attempted, actual, collateralSent, fee)
const TROVE_UPDATED_TOPIC = "0x85a52d2a9df6d50beea0d12f454309d08739d01fde1aa65491f68b92367297b4"; // borrower indexed; 7 data words, last = operation
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
  const dates = txs.map((t) => t.timestamp).sort();
  const red = txs.filter((t) => t.method === "redeemCollateral");
  const receipts = [];
  for (let i = 0; i < red.length; i += 50) {
    const batch = red.slice(i, i + 50).map((t, k) => ({ jsonrpc: "2.0", id: k, method: "eth_getTransactionReceipt", params: [t.hash] }));
    const out = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(batch) })).json();
    for (const o of out) receipts.push({ tx: red[o.id], r: o.result });
  }
  let ok = 0, reverted = 0, missing = 0, musd = 0n, btc = 0n, closures = 0;
  const senders = new Set(), borrowers = new Set();
  for (const { tx, r } of receipts) {
    if (!r) { missing++; continue; }
    if (r.status !== "0x1") { reverted++; continue; }
    ok++;
    senders.add(r.from.toLowerCase());
    for (const l of r.logs) {
      if (l.address.toLowerCase() !== TROVE_MANAGER.toLowerCase()) continue;
      const w = l.data.slice(2).match(/.{64}/g) ?? [];
      if (l.topics[0] === REDEMPTION_TOPIC) { musd += BigInt("0x" + w[1]); btc += BigInt("0x" + w[2]); }
      if (l.topics[0] === TROVE_UPDATED_TOPIC && w.length === 7 && BigInt("0x" + w[0]) === 0n && BigInt("0x" + w[1]) === 0n && BigInt("0x" + w[6]) === 2n) {
        closures++;
        borrowers.add(l.topics[1]);
      }
    }
  }
  const other = txs.length - red.length;
  console.log(`TroveManager txs read: ${txs.length} (${dates[0]?.slice(0, 10)} to ${dates.at(-1)?.slice(0, 10)}; older ones are not counted); ${other} are liquidations`);
  console.log(`redeemCollateral calls: ${red.length}: ${ok} succeeded, ${reverted} reverted (receipt status 0)${missing ? `, ${missing} receipts not found` : ""}`);
  console.log(`  the ${ok} that succeeded redeemed ${Number(formatUnits(musd, 18)).toLocaleString("en-US", { maximumFractionDigits: 0 })} MUSD for ${Number(formatUnits(btc, 18)).toFixed(2)} BTC, from ${senders.size} senders`);
  console.log(`  they closed ${closures} Troves (TroveUpdated with debt 0, operation 2), ${borrowers.size} distinct borrowers`);
} catch (e) {
  console.log(`redemption numbers unavailable: ${e.message}`);
}
