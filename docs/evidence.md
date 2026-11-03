# Evidence

Everything Mezher claims, with a link or a command to check it yourself.

## Contract

| What | Where |
| --- | --- |
| MezherPay v2 on Mezo testnet (31611), source verified as a partial match (Blockscout reports `is_fully_verified: false`), fee 50 bps | [`0xF113519362677fc0BDE15B172FF22DD8dB30aF27`](https://explorer.test.mezo.org/address/0xF113519362677fc0BDE15B172FF22DD8dB30aF27?tab=contract), block 16544459, deploy tx [`0x529f2cd5…`](https://explorer.test.mezo.org/tx/0x529f2cd5dab578f4fe57df3a14ffb2adb79e2197ee95af62182e8718e0c80b8a) |
| MezherPay v1 (Wave 1, superseded) | [`0x80ddA1a82Bb291348d4b5Ef33FAc10819071f58b`](https://explorer.test.mezo.org/address/0x80ddA1a82Bb291348d4b5Ef33FAc10819071f58b?tab=contract), block 16241205 |
| Source | [`contracts/src/MezherPay.sol`](../contracts/src/MezherPay.sol) |
| Mezo contracts it calls | MUSD `0x118917a4…`, BorrowerOperationsSignatures `0xD757e364…`, TroveManager `0xE47c80e8…`, PriceFeed `0x86bCF084…` (full list in [`web/lib/mezo.ts`](../web/lib/mezo.ts)) |

## Payments on chain

Everything below is on Mezo **testnet**, made from **team wallets**. None of it is outside use or revenue. The fee treasury is also a team wallet, so the fees paid so far went from team to team.

### v2 (current contract)

Gas and status checked with `eth_getTransactionReceipt` against `https://rpc.test.mezo.org` on 2026-11-03. Amounts, split and fee are as the team read them from the transactions' events; the contract's MUSD balance read 0 after each.

| Path | What happened | Tx |
| --- | --- | --- |
| `openAndPay` | Payer `0xeff1342219369dd9d8eabd0460fbac27c9e9abf4` sends 0.0648 BTC, opens a Trove with 1,800 MUSD (total debt 2,001.8), pays 20 MUSD, fee 0.1, gas 770,738. The rest of the borrowed MUSD stays with the payer. The payer paid the gas. A real permit: Approval of 20 MUSD. | [`0xbd5855f0…`](https://explorer.test.mezo.org/tx/0xbd5855f0d7c0a322c584597f81296e0be3a56c434c50c378879ef6b17336dfd0) |
| Split `pay`, relayer | 1,785 MUSD = 1,780 from balance + 5 borrowed, fee 8.925, gas 501,364. A real permit: Approval of 1,780 MUSD. | [`0x82dc5bd3…`](https://explorer.test.mezo.org/tx/0x82dc5bd34e8a0b0a28aef153dc254d734293ede829c061ced1310904847c831d) |
| Fully borrowed `pay`, relayer | 20 MUSD borrowed, fee 0.1, gas 462,947. | [`0xbb14adf9…`](https://explorer.test.mezo.org/tx/0xbb14adf9d23f25d1bf5b1b9d9d1fb816c1d1a42bd2ae51b96efd090a6a77518c) |
| Balance-only `pay`, relayer | 20 MUSD, fee 0.1, gas 104,605. A **self-payment** by the demo merchant wallet `0x04911751A39A3364474A6D068584268Aef5911AA`, so it shows the path works, not a customer. It has a zero permit and no Approval event: it spent the demo merchant's existing activation allowance, so it is not a permit proof. | [`0x0b1cbd3b…`](https://explorer.test.mezo.org/tx/0x0b1cbd3b070911af42a36f4a45a9336cb11d3163186f134239ef769045fb9948) |

The merchant in the other three is the same demo wallet. Gas figures and the break-even they imply are in [BUSINESS.md](BUSINESS.md).

### v1 (Wave 1 contract, kept for history)

| Payment | Split | Sent by | Tx |
| --- | --- | --- | --- |
| From the live site, [mezher.vercel.app](https://mezher.vercel.app) | 13 MUSD, all borrowed from the payer's Trove to the merchant | Relayer (payer paid no gas) | [`0x51e6aaf5…`](https://explorer.test.mezo.org/tx/0x51e6aaf5e6795cb9804735c9bfbfa44567aa93566e48a8847f29594bb9527dd0) |
| Local run of the same app | 11 MUSD, borrowed to the merchant | Relayer | [`0xdb3bc15e…`](https://explorer.test.mezo.org/tx/0xdb3bc15e4e65c0756eb81c49f91ee1490a568d2fbfc2601a9b5b6b86c2607eb5) |

### Outside users

**Outside users so far: 0.** `/proof` separates team wallets from outside ones, but it currently lists `0xeff1342219369dd9d8eabd0460fbac27c9e9abf4` as "outside". That wallet is a **team wallet** (it sent the `openAndPay` above). We decided not to redeploy to fix the label, so the true outside-payer count is the number `/proof` shows minus one. Check: open [`/proof`](https://mezher.vercel.app/proof) and subtract that one wallet.

## Tests

| Suite | Count | Command |
| --- | --- | --- |
| Contract unit | 53 | `cd contracts && forge test --match-contract MezherPayTest` |
| Contract invariants | 11, Foundry default 256 runs × 500 calls each | `cd contracts && forge test --match-path test/MezherPay.invariant.t.sol` |
| Contract fork (real Mezo testnet contracts) | 6 | `cd contracts && MEZO_TESTNET_RPC_URL=https://rpc.test.mezo.org forge test --match-path test/MezherPay.fork.t.sol` |
| Contract fork (Mezo mainnet) | 1 | `cd contracts && MEZO_MAINNET_RPC_URL=https://mainnet.mezo.public.validationcloud.io forge test --match-path test/MezherPay.mainnetFork.t.sol` |
| Web unit | 194 | `cd web && pnpm vitest run` |

71 contract tests, counted with `cd contracts && forge test --list --json`; all four suites passed when run on 2026-11-03. The first run recompiles and can take minutes; the invariant run took about 9.5 minutes.

The invariant suite drives random honest payments (any split of balance and borrow, and `openAndPay`), moves the Trove's ratio around the 150% floor, and replays the payer's signatures from an attacker. After every call it checks that:

- MezherPay holds no MUSD;
- the merchant received exactly the sum of settled payments;
- the payer's balance moved only by the balance parts;
- the treasury received exactly the fees, and the merchant's net matches settled payments;
- Trove debt grew only by settled borrows plus Mezo's 0.1% fee;
- no borrow settled under 150%;
- the attacker never received anything.

A final check fails the run if no honest payment or borrow settled, so the invariants cannot pass on an empty run. These invariants hold for payments through MezherPay; a Mezo borrow signature used alone skips them, see [SECURITY.md](SECURITY.md#known-limits).

Static analysis: see [SECURITY.md](SECURITY.md).

## Why it matters: Mezo mainnet numbers

Read on 2026-11-03. Read-only, no keys:

```
cd web
node scripts/mezo-stats.mjs
```

For redemptions the script lists calls from the explorer API, then reads each receipt on the RPC for status, the `Redemption` event and closures: `https://api.explorer.mezo.org/api/v2/addresses/0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193/transactions?filter=to` (the TroveManager, newest first, paged).

On Mezo mainnet (31612), block 12,973,498:

| | |
| --- | --- |
| MUSD total supply | 29,486,124 |
| MUSD in the Stability Pool | 14,172,032 |
| MUSD debt in Troves | 18,605 MUSD, 3 open Troves |
| BTC locked in Troves | 16.6557 BTC |

Open Troves over time (`getTroveOwnersCount` at a block through an archive RPC, printed by the same script):

| Block | Date | Open Troves |
| --- | --- | --- |
| 5,000,000 | 2025-11-30 | 104 |
| 10,400,000 | 2026-07-14 | 43 |
| 12,400,000 | 2026-10-09 | 12 |
| 12,749,209 | 2026-10-25 | 1 |
| 12,973,498 | 2026-11-03 | 3 |

Redemptions: the script reads the newest 1,000 transactions sent to the TroveManager (2026-07-16 to 2026-10-28; older ones are not counted): 991 `redeemCollateral` calls, 9 liquidations. The explorer labels 712 of the redemptions "error: awaiting_internal_transactions"; the receipts show status 0 (reverted, no logs) for exactly those 712. 279 succeeded (status 1). The 279 redeemed 2,308,919 MUSD for 31.72 BTC from 17 senders, and TroveManager logged 58 Trove closures from them (`TroveUpdated` with principal and interest 0, operation 2), 34 distinct borrowers. All of this is printed by `node scripts/mezo-stats.mjs`; output from 2026-11-03 is in the fix report.

What this supports: about half of the MUSD (14.17M of 29.49M, 48%) is in the Stability Pool, users have borrowed little through Troves (18.6k MUSD), and redemptions closed 58 Troves in the window above while the open count fell from 43 (14 Jul) to 1 (25 Oct). We did not examine the 104 to 43 period (30 Nov 2025 to 14 Jul 2026), so we do not say what emptied it. What it does not show: why people redeemed, or the MUSD market price. Liquidations (9 calls) and owners closing their own Troves also reduce the count. The old explanation that borrowing is low only because there is nowhere to spend is not supported by these data on its own.

Unverified: other teams' READMEs say MUSD trades near $0.989. We did not check a market price. The "104 Troves to 1" figure from those READMEs does match our own reads above (104 at block 5,000,000, 1 at block 12,749,209).

For a Mezher payer: redemption takes BTC from the lowest-ratio Troves first, so thin-ratio payers are the exposed ones. The product shows the Trove's place in that queue and refuses borrows under the floor; it cannot prevent a redemption.

Numbers change every block; rerun the script for current values.
