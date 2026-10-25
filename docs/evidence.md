# Evidence

Everything Mezher claims, with a link or a command to check it yourself.

## Contract

| What | Where |
| --- | --- |
| MezherPay on Mezo testnet (31611), source verified | [`0x80ddA1a82Bb291348d4b5Ef33FAc10819071f58b`](https://explorer.test.mezo.org/address/0x80ddA1a82Bb291348d4b5Ef33FAc10819071f58b?tab=contract), block 16241205 |
| Source | [`contracts/src/MezherPay.sol`](../contracts/src/MezherPay.sol) |
| Mezo contracts it calls | MUSD `0x118917a4…`, BorrowerOperationsSignatures `0xD757e364…`, TroveManager `0xE47c80e8…`, PriceFeed `0x86bCF084…` (full list in [`web/lib/mezo.ts`](../web/lib/mezo.ts)) |

## Payments on chain

| Payment | Split | Sent by | Tx |
| --- | --- | --- | --- |
| From the live site, [mezher.vercel.app](https://mezher.vercel.app) | 13 MUSD, all borrowed from the payer's Trove to the merchant | Relayer (payer paid no gas) | [`0x51e6aaf5…`](https://explorer.test.mezo.org/tx/0x51e6aaf5e6795cb9804735c9bfbfa44567aa93566e48a8847f29594bb9527dd0) |
| Local run of the same app | 11 MUSD, borrowed to the merchant | Relayer | [`0xdb3bc15e…`](https://explorer.test.mezo.org/tx/0xdb3bc15e4e65c0756eb81c49f91ee1490a568d2fbfc2601a9b5b6b86c2607eb5) |

In each, the `Paid` event and the MUSD `Transfer` to the merchant sit in the same transaction as Mezo's `withdrawMUSDWithSignature` borrow.

## Tests

| Suite | Count | Command |
| --- | --- | --- |
| Contract unit | 17 | `cd contracts && forge test --match-contract MezherPayTest` |
| Contract invariants | 6 invariants, 256 runs × 500 calls each | `cd contracts && forge test --match-path test/MezherPay.invariant.t.sol` |
| Contract fork (real Mezo testnet contracts) | 4 | `cd contracts && MEZO_TESTNET_RPC_URL=https://rpc.test.mezo.org forge test --match-path test/MezherPay.fork.t.sol` |
| Web unit (incl. the embed button) | 92 | `cd web && pnpm vitest run` |

The invariant suite drives random honest payments (any split of balance and borrow), moves the Trove's ratio around the 150% floor, and replays the payer's signatures from an attacker. After every call it checks that:

- MezherPay holds no MUSD;
- the merchant received exactly the sum of settled payments;
- the payer's balance moved only by the balance parts;
- Trove debt grew only by settled borrows plus Mezo's 0.1% fee;
- no borrow settled under 150%;
- the attacker never received anything.

A final check fails the run if no honest payment or borrow settled, so the invariants cannot pass on an empty run.

Static analysis: see [SECURITY.md](SECURITY.md).

## Why it matters: Mezo mainnet numbers

`cd web && node scripts/mezo-stats.mjs` reads Mezo mainnet (31612) through a public RPC, read-only. On block 12,749,209 (25 Oct 2026):

| | |
| --- | --- |
| MUSD total supply | 29,482,017 |
| Held by protocol contracts (Stability Pool 14.2M, IdleStrategy 7.4M, concentrated pool 5.3M, bridge 1.6M) | ~28.5M |
| Borrowed by users through Troves | 14,489 MUSD, 1 open Trove |
| BTC locked in Troves | 16.59 BTC |

The MUSD exists; very little of it reaches people by borrowing against Bitcoin. A loan is only worth opening if there is somewhere to spend it. Mezher makes the borrow happen at the moment of purchase, straight to the merchant.

Numbers change every block; rerun the script for current values.
