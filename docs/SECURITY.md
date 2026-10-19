# Security

Status: **Proposal - needs approval** (Phase 2 gate). Testnet-only product; this document does not establish any regulatory compliance.

## Assets and trust boundaries
- Protected assets:
  1. The payer's MUSD balance and Trove borrowing capacity (moved only with the payer's signatures).
  2. The relayer key and its BTC gas balance (server-side).
  3. The deployer key (Foundry encrypted keystore, local machine only).
  4. Integrity of what the payer signs (the UI must show exactly the merchant, amounts and fee that the signatures authorize).
- Trusted: the Mezo MUSD system contracts (`BorrowerOperationsSignatures`, `BorrowerOperations`, `TroveManager`, `PriceFeed`, `MUSD`) at the addresses in ARCHITECTURE.md; the `MezherPay` code after the audit gate.
- Untrusted inputs: payment link params (anyone can craft a link), `/api/relay` request bodies, any `pay()` caller, RPC responses used for display (the contract re-checks on-chain).
- Threats relevant to this product:
  - **Phishing link**: a crafted link asks for a large amount to an attacker address. Mitigation: checkout shows the full merchant address, amount, borrowed part and fee; wallet prompts show the typed data (recipient, amount); signatures expire in 15 minutes.
  - **Redirecting funds by the relayer or a third party**: impossible by construction. The borrow signature binds `borrower`, `recipient` and `amount`; the permit binds `owner`, `spender = MezherPay` and `value`; `pay()` sends only to `p.merchant`, and the Mezo contract verifies the signed `recipient`.
  - **Borrowing the Trove into liquidation**: `MezherPay` reverts if ICR after borrowing < 150% (F-04); the UI blocks it earlier.
  - **Signature replay**: Mezo `getNonce` and MUSD `nonces` increment on use; deadlines are enforced.
  - **Balance part redirect (fixed 2026-10-19)**: the EIP-2612 permit binds no merchant, so with `borrowed == 0` anyone holding the permit could call `pay()` with itself as merchant. `pay()` now requires `msg.sender == payer` when nothing is borrowed (`BalanceOnlyNeedsPayer`); with a borrow, Mezo's signature binds the recipient. Residual griefing: a front-runner can resubmit with another `orderId` or split to the same merchant.
  - **Permit front-running (griefing)**: someone submits the permit first → `pay()` wraps `permit` in try/catch and proceeds if the allowance is already sufficient (standard OZ pattern).
  - **Bypassing the ICR guard**: the borrow signature is valid on Mezo's own contract, so a third party could submit it directly to `BorrowerOperationsSignatures` and skip `MezherPay`'s guard. Funds still go only to the signed merchant and amount; Mezo's MCR (110%) still applies. Residual risk, see below.
  - **Relayer gas drain / spam**: rate limit 5/min per payer and per IP, simulation before sending (failed simulations cost no gas), dedupe window, 503 when the balance is low.
  - **Reentrancy**: `MezherPay` holds no funds and keeps no state; its only external calls are to MUSD (OZ ERC20, no hooks) and the Mezo contracts. Checks-effects-interactions is still followed.
  - **XSS through link labels**: React escapes text; labels are never rendered as HTML and are capped at 60 chars.

## Authentication and authorization
- Identity: no accounts. Identity = the wallet address that signs EIP-712 messages (EOA, ECDSA).
- Roles and permissions:

| Actor | `MezherPay.pay()` | Moves payer MUSD | Borrows from payer Trove | `/api/relay` |
| --- | --- | --- | --- | --- |
| Payer | yes (own-gas fallback) | yes, via own permit | yes, via own signature | yes |
| Relayer | yes | only with the payer's permit | only with the payer's signature | n/a (server) |
| Any third party | yes (callable) | no (needs the payer's permit) | no (needs the payer's signature) | rate-limited |
| Merchant | yes | no | no | rate-limited |
| Deployer | same as a third party (no admin functions exist) | no | no | n/a |

- Ownership checks: on-chain only (signature recovery inside MUSD `permit` and Mezo `_verifySignature`).
- Recovery and revocation: a payer revokes a pending signature by letting it expire (15 min) or by consuming the nonce (any other signed Mezo action). No admin can pause or change `MezherPay`.

## Secrets and configuration
- Secret names only: `RELAYER_PRIVATE_KEY` (Vercel env, server-only route). The deployer key lives in the Foundry keystore account `mezher-deployer` (`cast wallet import`), never in `.env` or the repo.
- Public config (safe in the client bundle): `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL`, `NEXT_PUBLIC_MEZHER_PAY_ADDRESS`, `NEXT_PUBLIC_MEZHER_PAY_DEPLOY_BLOCK`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- Storage and rotation: relayer = a burner testnet key funded with ≤ 0.01 testnet BTC; rotate by generating a new key and updating the env var; the old key is drained to the owner. Owner: repo owner.
- Client exposure: `RELAYER_PRIVATE_KEY` is read only in `app/api/relay/route.ts` (Node runtime). Phase 5 greps the built `.next/static` bundle for `RELAYER_PRIVATE_KEY` and 64-hex patterns.
- `.env*` is git-ignored except `.env.example` (names only). Phase 5 greps `git log -p` for key-like patterns (`0x[0-9a-fA-F]{64}`).

## Input and output handling
- Validation: zod at `/api/relay` (see DATABASE.md "Data validation"); link params validated before any chain read; contract custom errors for on-chain invariants.
- Injection/XSS: React rendering only, no `dangerouslySetInnerHTML`; URLs built with `URLSearchParams`; explorer links built from validated hashes only.
- Uploads: none.
- Rate limits: `/api/relay` 5 requests/minute per payer address and per IP → 429; request body ≤ 4 KB → 413.
- Output: the API returns no stack traces; revert reasons are decoded to known error names or the Mezo revert string.

## Privacy
- Data collected: none stored by Mezher. The relayer sees the payer address, merchant, amounts and IP transiently (rate limiting).
- Retention: in memory ≤ 10 minutes; Vercel request logs follow Vercel's default retention.
- Logging redaction: never log signatures, `v/r/s`, private keys, or full request bodies; log only the route, status, payer address prefix and tx hash.
- On-chain data is public; labels are never written on-chain (only the order id is). The merchant page warns that labels are visible to anyone with the link.

## Dependencies and deployment
- Dependency policy: only the packages listed in ARCHITECTURE.md; versions pinned in the lockfile; any new package needs a one-line reason in the commit message. OpenZeppelin via `forge install` pinned to a release tag.
- Environment separation: local (anvil fork) vs Vercel production (testnet). No mainnet configuration exists in the repo; adding one requires explicit owner approval.
- Security-sensitive change review: any change to `MezherPay.sol`, `/api/relay`, or `lib/signatures.ts` re-runs the unit + fork tests and gets a `requesting-code-review` pass. Before the demo, the web3 audit gate (x-ray → solidity-auditor → fizz if time allows) runs on the final contract.

## Verification
Tests listed in TESTING.md: permit/borrow signature from a different signer reverts; recipient mismatch reverts; expired deadline reverts; ICR floor revert; `fromBalance > amount` revert; zero merchant/amount reverts; a third-party caller cannot redirect funds; relay 400/409/413/422/429/503 paths; secret-exposure grep on the bundle and git history.

Residual risks (owner: repo owner):
- The ICR guard can be bypassed by submitting the raw Mezo borrow signature directly (funds still only reach the signed merchant; Mezo MCR 110% still applies). Post-hackathon fix: a smart-account payer whose signature is valid only through `MezherPay`.
- The in-memory rate limit is per serverless instance; determined spam can still burn some relayer gas (bounded by the ≤ 0.01 BTC float).
- Single relayer key; if leaked, an attacker can only spend its gas float (it cannot move user funds).
- AI-assisted audit only (x-ray / solidity-auditor), not a professional audit; must not be described as audited.
- Mezo MUSD contracts are upgradeable proxies controlled by Mezo; their behaviour could change under us.
