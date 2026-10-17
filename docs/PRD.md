# Product Requirements Document

## Project context
- Product: **Mezher**, "Pay with your Bitcoin. Keep your Bitcoin."
- Owner: repo owner (solo builder; sole decision maker)
- Status: Draft. Needs owner approval (Phase 2 gate).
- Event: Mezo Buildathon Wave 1 (AKINDO). Full event reference in `MEZO_BUILDATHON.md`; live state in `docs/hackathon/STATE.md`.
- Problem: a Bitcoin holder on Mezo who wants to pay for something without selling BTC must open the Mezo app, adjust their Trove to borrow MUSD, wait for that transaction, then send a second transaction to the merchant, paying BTC gas both times. Merchants get no payment link, no receipt trail, and no way to accept "BTC credit".
- Target users:
  1. **Payer**: a BTC holder with an open MUSD Trove on Mezo (desktop browser, EVM wallet such as MetaMask, intermediate crypto user).
  2. **Merchant / seller**: anyone who wants to be paid in MUSD (freelancer, small online shop, API seller), with any EVM address.
- Desired outcome: paying with BTC credit is one checkout screen, one or two signatures, zero gas for the payer. The merchant receives the exact MUSD amount in one on-chain transaction, and the payer only borrows the part their MUSD balance does not cover.

### Demo moment (the 10 seconds judges remember)
The payer's wallet holds **5 MUSD**. The coffee costs **12 MUSD**. They press Pay, approve two wallet signatures (no transaction, no gas). The merchant's screen shows **+12 MUSD** received. The payer's Trove debt rose by exactly **7 MUSD + 0.1% fee**, and their BTC never left the Trove.

### Judging criteria -> feature mapping
| Criterion (weight) | Covered by |
| --- | --- |
| Mezo Integration (30%) | F-03 borrow-to-merchant via `BorrowerOperationsSignatures.withdrawMUSDWithSignature`; F-03 MUSD EIP-2612 permit; F-02 Trove reads (`TroveManager`, `PriceFeed`); F-04 on-chain ICR guard; F-01 Mezo Passport connect |
| Product & Business Viability (30%) | Mezo's own thesis ("live off your Bitcoin without selling it"); merchant payment links (F-06) make it a distribution channel for MUSD (Track 2); post-hackathon path in `MEZO_BUILDATHON.md` §12d (Founder Program → audit → mainnet + Mezo Market) |
| Technical Implementation (20%) | One small immutable contract with no admin (`MezherPay`), Foundry unit + fork tests against the real Mezo testnet contracts, audit gate (x-ray + solidity-auditor), composable `pay()` callable by anyone |
| User Experience (10%) | F-02 credit preview (before/after ICR), F-05 gasless relay, every screen with loading/empty/error/success states, wallet-state handling |
| Submission Materials (10%) | `docs/DEMO.md`, 2-minute video, deck, `docs/hackathon/SUBMISSION.md` (Phase 6) |

Tracks: **Track 2 (Access & Distribution)** primary; **Track 1 (DeFi, borrowing)** secondary. Submit to both.

## MVP scope
- Must ship (core): F-01 to F-07 below.
- Stretch (cut automatically if behind schedule): S-01 x402 "borrow-to-pay" adapter; S-02 in-app Trove opening via `openTroveWithSignature`; S-03 merchant QR code; S-04 Telegram notification for merchants.
- Explicitly excluded (protects the deadline):
  - Mainnet deployment (testnet only during the hackathon).
  - Opening, closing or managing collateral of a Trove (core links to the Mezo testnet app; S-02 is stretch).
  - Repaying debt, auto-repay, liquidation protection.
  - Smart-account (ERC-4337) payers and BTC-native wallets (Xverse/Unisat) as **payers**. They cannot produce the ECDSA signatures the Mezo contracts verify (see Open decisions).
  - Fiat on/off ramp, refunds, disputes, invoices with tax, multi-currency pricing.
  - User accounts, emails, a database, analytics.
  - Cross-chain (Base/Ethereum/BNB) payments.
- Constraints: Mezo testnet (chain ID 31611), Solidity 0.8.28 with `evmVersion london`, internal submit target 2026-10-26 08:00 +0700, solo builder, demo on a desktop browser.

## User journeys
1. **Payer pays with BTC credit (golden path).**
   - Actor: payer with an open Trove and an EVM wallet on Mezo testnet.
   - Trigger: opens a merchant payment link `/pay?to=<merchant>&amount=<MUSD>&order=<id>&label=<text>`.
   - Steps: connect wallet (F-01) → see the order, Trove health and the split "from balance / borrowed" with the ICR before and after (F-02) → press **Pay** → sign the EIP-2612 permit (only if part comes from balance) and the EIP-712 borrow message (only if part is borrowed) → the relayer submits `MezherPay.pay()` (F-05) → receipt with the tx link (F-07).
   - Result: the merchant holds `amount` MUSD more; the payer's MUSD balance dropped by the from-balance part; Trove debt rose by the borrowed part plus fee.
   - Failure/recovery: no Trove → "Open a Trove on Mezo" link plus a pay-from-balance-only option if the balance covers it; ICR after borrow below 150% → Pay disabled with a reason; signature rejected → back to the review state, nothing sent; relayer down → "Pay with my own gas" fallback (payer submits `pay()` from their wallet); tx reverted → error with the decoded reason and a retry.
2. **Merchant creates a payment link and sees it paid.**
   - Actor: merchant with any EVM address.
   - Trigger: opens `/merchant`.
   - Steps: connect wallet or paste an address → enter amount, label and order id (auto-generated) → copy the link (F-06) → watch the payments list update (F-07).
   - Result: link shared; the payment appears with payer, amount, split and tx link.
   - Failure/recovery: invalid amount → inline error; order id already paid → shown as "Paid" and the payer link shows "Already paid".
3. **Judge reproduces the demo.** Opens the deployed site, uses the pre-funded demo payer wallet described in `docs/DEMO.md`, and follows journey 1.

## Feature specifications
| ID | User need | Behavior | Acceptance criteria | Priority |
| --- | --- | --- | --- | --- |
| F-01 | As a payer or merchant, I need to connect a wallet on Mezo testnet | Mezo Passport / RainbowKit connect; wrong-network prompt switches to chain 31611 | Given a wallet on another chain, when I connect, then I see "Switch to Mezo Testnet" and after switching the app shows my address. Given no wallet installed, then I see an install hint, not a crash. | Must |
| F-02 | As a payer, I need to see whether I can afford the payment with my BTC credit | Reads MUSD balance, Trove status/coll/debt (`TroveManager`), BTC price (`PriceFeed`); computes fromBalance = min(balance, amount), borrow = amount − fromBalance, fee = `getBorrowingFee(borrow)`, ICR before/after, max borrowable keeping ICR ≥ 150% | Given balance 5 and amount 12, then the preview shows "5 from balance, 7 borrowed, fee 0.007" and the ICR after. Given ICR after < 150%, then Pay is disabled with "This would put your Trove below the 150% safety floor". Given no active Trove and balance ≥ amount, then pay-from-balance only. Given no Trove and balance < amount, then "Open a Trove on Mezo" CTA. | Must |
| F-03 | As a payer, I need one checkout to move balance MUSD and borrowed MUSD straight to the merchant | Client builds the EIP-2612 permit (domain "Mezo USD" v1, spender = MezherPay, value = fromBalance) and the `WithdrawMUSD(amount,borrower,recipient,nonce,deadline)` message (domain "BorrowerOperationsSignatures" v1, recipient = merchant, nonce from `getNonce`). `MezherPay.pay()` uses the permit + `transferFrom` for the balance part and calls `withdrawMUSDWithSignature` with recipient = merchant for the borrowed part, atomically | Given valid signatures, when `pay()` runs, then the merchant balance increases by exactly `amount`, the payer balance decreases by `fromBalance`, Trove debt increases by `borrow + fee`, and one `Paid` event is emitted. Given either signature invalid or expired, then the whole tx reverts and nothing moves. | Must |
| F-04 | As a payer, I need protection from borrowing my Trove into danger | After borrowing, `MezherPay` reads `getCurrentICR(payer, price)` and reverts with `IcrBelowFloor` if < 150% | Given a borrow that leaves ICR 140%, then `pay()` reverts and no MUSD moves. Given ICR 151%, then it succeeds. | Must |
| F-05 | As a payer, I need to pay without holding BTC for gas | `POST /api/relay` simulates `pay()` with `eth_call`, then sends it from the relayer key; per-payer rate limit; returns the tx hash | Given valid signed payloads, when I press Pay, then I never see a wallet tx prompt and receive a tx hash. Given a payload that fails simulation, then the API returns 422 with the revert reason and sends nothing. Given more than 5 requests/minute from one payer, then 429. Given the relayer is down, then the UI offers "Pay with my own gas". | Must |
| F-06 | As a merchant, I need a payment link | `/merchant` form (amount > 0 with up to 18 decimals, label ≤ 60 chars, order id auto = random 16 hex chars, editable) builds the `/pay` URL with a copy button | Given amount "12" and label "Coffee", when I press Create, then I get a URL that opens checkout with those values. Given amount 0 or empty, then an inline error and no link. | Must |
| F-07 | As payer and merchant, I need a receipt and history | Receipt screen after pay with the explorer link; `/merchant` lists `Paid` events filtered by merchant (newest first); a pay link's order counts as Paid when a `Paid` event exists with the same merchant + orderId and amount ≥ the requested amount | Given a confirmed payment, then the payer sees the tx link and the merchant list shows it within 15 s. Given an order already paid, then checkout shows "Already paid" and Pay is disabled. | Must |
| S-01 | As an API buyer, I want to pay an x402 endpoint on Mezo with BTC credit | Borrow the gap into my own wallet via signature, then settle x402 with the standard `@x402/evm` client | Given an x402 endpoint priced $0.01 on eip155:31611 and 0 MUSD balance, then one flow borrows and pays and the resource is returned | Stretch |
| S-02 | As a new user, I want to open a Trove in-app | `openTroveWithSignature` flow with hints | Given BTC and no Trove, then a Trove opens with min debt 1,800 MUSD | Stretch |
| S-03 | As a merchant, I want a QR code for the link | QR render of the `/pay` URL | Given a created link, then a scannable QR shows | Stretch |
| S-04 | As a merchant, I want a Telegram ping when paid | Bot posts on `Paid` events for a registered merchant | Given a payment, then a message arrives within 30 s | Stretch |

## Success measures
- Golden path completes on Mezo testnet in ≤ 3 user actions after connect (press Pay plus up to 2 signatures), 0 payer gas: measured in the demo rehearsal log.
- Payment latency from Pay click to receipt ≤ 15 s on testnet (rehearsal log, 5 runs).
- 100% of `MezherPay` external functions covered by Foundry tests; fork test of the real `withdrawMUSDWithSignature` path passes.
- Accessibility: all golden-path controls keyboard reachable with visible focus; text contrast ≥ 4.5:1 (checked with a contrast tool in Phase 5).
- Performance: checkout first load < 3 s on desktop broadband (Lighthouse, Phase 5).

## Open decisions
- Mezo Passport BTC-wallet users sign through a smart account; the Mezo signature contracts and the MUSD permit verify ECDSA only. **Proposal - needs approval:** core supports EVM (ECDSA) wallets as payers; BTC wallets are shown "coming soon" for paying. Owner: repo owner, needed before Phase 3.
- Relayer hosting = the same Next.js deployment on Vercel. Production deploys need the owner's OK each time. **Proposal - needs approval.** Owner: repo owner, needed before Phase 6.
- Deadline timezone (JST assumed). Owner: repo owner, needed before 2026-10-25.
- Resolved 2026-10-18: owner approved EVM-only payers and Vercel hosting; `PriceFeed.fetchPrice()` is `view`.

## Definition of ready
Scope, journeys and acceptance criteria above are approved by the owner. Blocking unknowns listed under Open decisions have owners. Phase 3 (plan) starts only after approval.
