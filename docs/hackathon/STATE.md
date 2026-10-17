# Hackathon State

Single source of truth for `/hackaton`. Update at every phase change and checkpoint. Read this first when resuming a session.
Full event reference: `MEZO_BUILDATHON.md` (repo root).

## Event
- Name: Mezo Buildathon — "Build with MUSD and MEZO: Bitcoin's Economic Layer" (AKINDO Wave Hacks), Wave 1
- Lead (sole editor of this file in team mode): solo (owner of this repo)
- Tracks / prizes targeted: Track 2 Access & Distribution + Track 1 DeFi (submit to both). Wave 1 pool $2,000 in MEZO, proportional to judge points
- Deadline: 2026-10-26 22:00, timezone not stated on the page. Working assumption (earliest plausible, JST) = **2026-10-26 20:00 +0700**. Unconfirmed — user deferred.
- Internal submit target: 2026-10-26 08:00 +0700 (12 h buffer, because the timezone is unconfirmed)
- Submission format: AKINDO form + live testnet link + public GitHub repo + project deck + 2-minute pitch video

## Judging criteria
| Criterion | Weight (if known) | Feature / evidence that covers it |
| --- | --- | --- |
| Mezo Integration (depth > surface) | 30% | Borrow from Trove via `BorrowerOperationsSignatures.withdrawMUSDWithSignature`, MUSD permit (EIP-2612), Mezo Passport — F-xx TBD in PRD |
| Product & Business Viability | 30% | "Spend BTC without selling" = Mezo's own tagline; merchant/x402 payer side; post-hackathon milestones (Founder Program → audit → mainnet/Mezo Market) |
| Technical Implementation | 20% | Small composable contract + Foundry tests + audit gate (x-ray, solidity-auditor) |
| User Experience | 10% | One-tap pay flow, gasless for the user, BTC wallet support via Passport |
| Submission Materials Quality | 10% | DEMO.md script, 2-min video, deck, SUBMISSION.md |

## Hackathon rules (binding points from the official rules page)
- Rules page: https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10 (summary in MEZO_BUILDATHON.md §5–8)
- Code origin: built during the hackathon, or a new extension of an existing product. Reused code must be open source and cited.
- AI tools / models allowed and disclosure required: no rule on the page. User decision: no AI mention in the submission.
- Team size, tracks per project, eligibility: any team size; one team per person per Wave; 18+; prohibited jurisdictions listed (Indonesia not among them); both tracks allowed; KYB required to receive rewards.
- License / open-source requirement, IP ownership: public GitHub repo required; IP stays with the participant; Supernormal gets a non-exclusive promotional license.
- Required or forbidden APIs / SDKs: MUSD and/or MEZO integration mandatory. Chains: Mezo (testnet OK), Ethereum, Base, BNB.
- Submission language and limits: English form; 2-minute pitch video; Wave 2 resubmission must state what changed.

## Environment readiness
- check-env.sh run at: 2026-10-18 00:07 +0700 - missing: bun, solana, anchor (not needed)
- check-deps.sh: 0 missing (superpowers, caveman, rtk, ponytail, solidity, x-ray, solidity-auditor, fizz OK)
- Accounts, keys (names only), hosting, repo access: AKINDO registered + Mezo Discord joined (user confirmed). Hosting: TBD in ARCHITECTURE.
- Web3: burner testnet wallet + faucet funds: user confirmed done 2026-10-18 (balance not yet checked — record in DEPLOYMENTS.md)
- AI: n.a.

## Phase cursor and clock
Current phase: 4 build (may start early: Phases 2–3 finished ahead of schedule)
Last updated: 2026-10-18 00:39 +0700

Web3 split 15% / 50% / 15% / 20% over 2026-10-18 00:15 -> 2026-10-26 20:00 +0700 (211.75 h wall clock).

| Phase | Status | Budget | Planned start -> end | Actual end | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 Intake | Done | - | 2026-10-17 23:00 -> 2026-10-18 00:15 | 2026-10-18 00:15 | |
| 2 Design + docs | Done — approved by owner (incl. EVM-only payers, Vercel) | 21.75 h | 2026-10-18 00:15 -> 2026-10-18 22:00 | 2026-10-18 01:05 | 8-doc bundle + DEPLOYMENTS.md written; brainstorming questions skipped (owner delegated design: "recommend dri lu") |
| 3 Plan | Done — approved by owner; build via Orca | 10 h | 2026-10-18 22:00 -> 2026-10-19 08:00 | 2026-10-18 00:39 | docs/superpowers/plans/2026-10-18-mezher-mvp.md (11 core tasks + 4 stretch). No worktree (owner: work in place; build via Orca) |
| 4 Build | Not started | 105.83 h | 2026-10-19 08:00 -> 2026-10-23 17:50 | | testnet walking skeleton by 2026-10-21 02:00 (~40%) |
| 5 Verify + audit | Not started | 31.75 h | 2026-10-23 17:50 -> 2026-10-25 01:35 | | |
| 6 Demo and submit | Not started | 42.42 h | 2026-10-25 01:35 -> 2026-10-26 20:00 | | internal submit 2026-10-26 08:00 |

Over-budget warnings sent: none

## Idea filter result
- One-sentence pitch: Bitcoin holders on Mezo can't pay for things without first selling BTC or pre-borrowing MUSD; our pay flow borrows exactly the missing MUSD from their Trove and sends it straight to the merchant in one gasless, atomic payment — "spend your Bitcoin without selling it".
- Measurable impact claim (estimate): today paying with BTC credit = open Mezo app, adjust Trove, wait for the tx, then transfer (2 on-chain txs + gas in BTC); ours = 1 click + up to 2 signatures, 0 user transactions, 0 user gas.
- Existing APIs/tools combined: MUSD BorrowerOperationsSignatures (EIP-712 borrow-on-behalf), MUSD EIP-2612 permit, Mezo Passport (BTC wallets); optionally the x402 facilitator.
- Visible output for judges: checkout/pay UI on Mezo testnet; the merchant receives MUSD; the Trove's debt rises by the gap only; explorer tx links.
- Not a generic wrapper: yes — a new contract composing Mezo's own borrow primitive; no AI.
- Hair on fire: BTC holders who want to spend without selling (Mezo's core user); they currently need several manual steps.
- Fits the clock: core = 1 small contract + relayer + one pay screen.
- Passed filter: Yes (reference: DeCredit Wallet, LFGHO finalist + Aave Integration Prize; MUSD has no flashmint, so we use signature borrowing instead).

## Web3 (if applicable)
- Ecosystem / chain: EVM — Mezo
- Network: Mezo Testnet, chain ID 31611, RPC https://rpc.test.mezo.org, explorer https://explorer.test.mezo.org, faucet https://faucet.test.mezo.org (CAPTCHA)
- Compiler constraint: Solidity 0.8.28, evmVersion london
- Testnet deploys pre-approved: Yes (user, 2026-10-18 00:15 +0700). Mainnet always needs per-action approval.
- Sponsor protocols or bounty tracks: MUSD (Trove, BorrowerOperationsSignatures, permit), Mezo Passport, Mezo Pools (optional), x402 facilitator (optional)
- Audit gate: x-ray [Not run] | solidity-auditor [Not run] | fizz [Not run] | tests [Not run]
- Deployments file: docs/hackathon/DEPLOYMENTS.md

## Scope
- Ship now (core): PRD F-01 connect, F-02 credit preview, F-03 atomic pay (permit + borrow-to-merchant), F-04 ICR ≥ 150% guard, F-05 gasless relay, F-06 merchant payment link, F-07 receipt + merchant history
- Stretch (auto-cut if behind): S-01 x402 borrow-to-pay, S-02 in-app Trove opening, S-03 QR code, S-04 Telegram merchant ping
- Post-hackathon: Mezo Founder Program application; third-party audit; mainnet + Mezo Market listing

## Hourly checkpoints (solo: write here)
| Time | Time left | Core done / total | Cut decision |
| --- | --- | --- | --- |
| 2026-10-18 00:15 +0700 | 211.75 h | 0 / TBD | none |

## Unresolved
- Deadline timezone (JST vs other) - owner: user (deferred)
- Testnet faucet amount per claim vs the ~0.037 BTC needed for a 2,000 MUSD Trove at 150% ICR - owner: me (check wallet balance)
- Resolved: nonce getter is `getNonce(address)`; `fetchPrice()` is view; smart-account path out of scope (EVM-only payers approved).
- Resolved 2026-10-18: Passport `getConfig` requires a `walletConnectProjectId` string; empty works for MetaMask, a real id is needed only for WalletConnect QR wallets.
- `mezher-deployer` Foundry keystore not imported yet → MezherPay testnet deploy (Task 3 steps 3–5) waits - owner: user
