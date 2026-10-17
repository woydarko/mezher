# Testing

Status: **Proposal - needs approval** (Phase 2 gate). Nothing has run yet: every status is "Not run".

## Goals and scope
Before submission, these must work on Mezo testnet: the golden path J1 (PRD F-01..F-05, F-07), merchant links J2 (F-06, F-07), and every SECURITY.md control (signature binding, ICR floor, relay limits, no secret exposure). `MezherPay` is tested **test-first** (superpowers TDD): unit tests with mocks for every branch, plus fork tests against the real Mezo testnet contracts for the integration that matters (permit + `withdrawMUSDWithSignature` + ICR read).

## Test layers
- **Unit (Foundry, `contracts/test/MezherPay.t.sol`)**: input validation, split math, permit try/catch, event fields, ICR floor, using mocks in `contracts/test/mocks/` (MockMUSD with ERC20Permit, MockBorrowerOperationsSignatures that verifies an ECDSA digest and mints to the recipient, MockTroveManager with a settable ICR, MockPriceFeed).
- **Fork/integration (Foundry, `contracts/test/MezherPay.fork.t.sol`)**: fork Mezo testnet (`MEZO_TESTNET_RPC_URL`), deploy `MezherPay` in the fork, give a fresh EOA test BTC with `vm.deal`, open a real Trove through `BorrowerOperations.openTrove` (debt ≥ 1,800 MUSD), sign real EIP-712 messages with `vm.sign`, call `pay()`, and assert balances, Trove debt and events. Skipped automatically when the RPC env var is missing.
- **Unit (web, vitest)**: `lib/quote.ts` (split, fee, ICR before/after, max borrowable at 150%), `lib/link.ts` (parse/build/validate), `lib/signatures.ts` (typed-data shape matches the on-chain domains and type strings), `/api/relay` input schema and limits.
- **End-to-end**: manual on Mezo testnet with MetaMask (automated wallet signing is unreliable; a Playwright smoke test of page rendering and link validation is stretch).
- **Manual**: visual QA checklist (DESIGN_SYSTEM addendum), contrast checks, keyboard pass, 5 demo rehearsals.

## Acceptance test matrix
| Feature/risk | Scenario | Expected result | Layer | Status |
| --- | --- | --- | --- | --- |
| F-03 | Balance covers all (fromBalance = amount) | Merchant +amount, payer −amount, no borrow call, `Paid(…, borrowed 0)` | Unit + Fork | Not run |
| F-03 | Borrow only (fromBalance = 0) | Merchant +amount, payer debt + amount + fee, no permit used | Unit + Fork | Not run |
| F-03 | Split (5 balance + 7 borrow) | Merchant +12, payer −5, debt +7 + fee, `Paid` fields exact | Unit + Fork | Not run |
| F-03 | Permit signed by another key | Reverts; nothing moves | Unit + Fork | Not run |
| F-03 | Borrow signature for a different recipient | Reverts (Mezo invalid signature); nothing moves | Fork | Not run |
| F-03 | Borrow signature expired | Reverts "Signature expired"; nothing moves | Unit + Fork | Not run |
| F-03 | Permit already used (front-run) and allowance sufficient | `pay()` succeeds (try/catch path) | Unit | Not run |
| F-03 | Replay the same borrow signature twice | Second call reverts (nonce) | Fork | Not run |
| F-03 | `fromBalance > amount` | Reverts `FromBalanceExceedsAmount` | Unit | Not run |
| F-03 | Zero merchant / zero payer / zero amount | Reverts `ZeroAddress` / `ZeroAmount` | Unit | Not run |
| F-03 | Fuzz: any amount and fromBalance ≤ amount | merchant delta == amount; payer delta == fromBalance | Unit (fuzz) | Not run |
| F-04 | Borrow leaves ICR 149.9% | Reverts `IcrBelowFloor`; nothing moves | Unit + Fork | Not run |
| F-04 | Borrow leaves ICR exactly 150% | Succeeds | Unit | Not run |
| Permissions | Third party calls `pay()` with the payer's signatures but a different merchant | Reverts; funds cannot be redirected | Unit + Fork | Not run |
| F-02 | Quote: balance 5, amount 12, fee rate 0.1% | fromBalance 5, borrow 7, fee 0.007, ICR after computed | Unit (vitest) | Not run |
| F-02 | Quote: no Trove, balance < amount | State `needs_trove` | Unit (vitest) | Not run |
| F-02 | Quote: ICR after < 150% | State `blocked_ratio` | Unit (vitest) | Not run |
| F-06 | Build link amount "12", label "Coffee" | URL round-trips through parse with identical values | Unit (vitest) | Not run |
| F-06 | Amount 0 / empty / 19 decimals / bad address | Validation error, no link | Unit (vitest) | Not run |
| F-05 | Relay valid payload | 200 + hash; tx confirms on testnet | Manual (testnet) | Not run |
| F-05 | Relay malformed body | 400 `invalid_input` | Unit (vitest, route handler) | Not run |
| F-05 | Relay payload that would revert | 422 `simulation_failed` with reason; no tx sent | Manual (testnet) | Not run |
| F-05 | 6th request in a minute from one payer | 429 | Unit (vitest) | Not run |
| F-05 | Same merchant+order+payer within 10 min | 409 | Unit (vitest) | Not run |
| F-05 | Relayer key missing / balance low | 503; UI shows "Pay with my own gas" | Unit + Manual | Not run |
| F-01 | Wallet on wrong network | Switch prompt; app works after switching | Manual | Not run |
| F-07 | Paid order link reopened | Checkout shows "Already paid", Pay disabled | Manual (testnet) | Not run |
| F-07 | Merchant page after a payment | Payment listed within 15 s with tx link | Manual (testnet) | Not run |
| Isolation | Merchant page for address A | Shows only `Paid` events where merchant == A | Manual | Not run |
| Secrets | Built client bundle | No `RELAYER_PRIVATE_KEY` and no 64-hex private key pattern in `.next/static` | Manual grep (Phase 5) | Not run |
| Secrets | Git history | No key patterns in `git log -p` | Manual grep (Phase 5) | Not run |
| UX/a11y | Contrast of text roles | ≥ 4.5:1 | Manual (contrast checker) | Not run |
| UX/a11y | Keyboard through golden path | All controls reachable, focus visible | Manual | Not run |

## Fixtures and environments
- Synthetic test users: Foundry `makeAddrAndKey("payer")`, `makeAddr("merchant")`, `makeAddr("relayer")`; fork tests fund with `vm.deal` (test BTC is the native coin).
- Demo testnet wallets (addresses only, in `docs/hackathon/DEPLOYMENTS.md`): demo payer with an open Trove and ~5 MUSD wallet balance; demo merchant; relayer burner.
- External services: Mezo testnet RPC for fork tests (`MEZO_TESTNET_RPC_URL`, default `https://rpc.test.mezo.org`); mocks for unit tests. Assumption: the RPC serves the state Foundry needs for forking; if not, pin `--fork-block-number` to a recent block.
- Reset/isolation: each Foundry test runs in a fresh EVM snapshot; vitest tests are pure functions; the relay route handler is tested with an injected fake client.

## Verified commands
- Unit/integration: Not configured (planned: `cd contracts && forge test -vvv`; fork tests `cd contracts && MEZO_TESTNET_RPC_URL=https://rpc.test.mezo.org forge test --match-path test/MezherPay.fork.t.sol -vvv`; web `cd web && pnpm vitest run`).
- End-to-end: Not configured (manual testnet run per `docs/DEMO.md`).
- Build/type check: Not configured (planned: `cd contracts && forge build`; `cd web && pnpm build`).
- Coverage: Not configured (planned: `cd contracts && forge coverage --ir-minimum` if needed).

## Release criteria
All "Unit", "Fork" and "Unit (vitest)" rows Passed; F-03/F-04/Permissions rows passed on fork; golden path passed manually on testnet 5 times in a row (rehearsal log in `docs/DEMO.md`); secrets greps clean; audit gate run with Critical/High fixed. Any failing row blocks submission unless it belongs to a stretch feature (then the feature is cut). Owner: repo owner.

## Results
| Date | Command | Result | Failures / limitations |
| --- | --- | --- | --- |
| — | — | Not run | No code yet (Phase 2) |
