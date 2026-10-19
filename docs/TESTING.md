# Testing

Status: **In use** (Phase 4). Contract rows are proven; web rows are still "Not run".

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
| F-03 | Balance covers all (fromBalance = amount) | Merchant +amount, payer −amount, no borrow call, `Paid(…, borrowed 0)` | Unit + Fork | Passed 2026-10-18 (unit) |
| F-03 | Borrow only (fromBalance = 0) | Merchant +amount, payer debt + amount + fee, no permit used | Unit + Fork | Passed 2026-10-18 (unit + fork) |
| F-03 | Split (5 balance + 7 borrow) | Merchant +12, payer −5, debt +7 + fee, `Paid` fields exact | Unit + Fork | Passed 2026-10-18 (unit + fork) |
| F-03 | Permit signed by another key | Reverts; nothing moves | Unit + Fork | Passed 2026-10-18 (unit) |
| F-03 | Borrow signature for a different recipient | Reverts (Mezo invalid signature); nothing moves | Fork | Passed 2026-10-18 (unit + fork) |
| F-03 | Borrow signature expired | Reverts "Signature expired"; nothing moves | Unit + Fork | Passed 2026-10-18 (unit) |
| F-03 | Permit already used (front-run) and allowance sufficient | `pay()` succeeds (try/catch path) | Unit | Passed 2026-10-18 (unit) |
| F-03 | Replay the same borrow signature twice | Second call reverts (nonce) | Fork | Passed 2026-10-18 (fork) |
| F-03 | `fromBalance > amount` | Reverts `FromBalanceExceedsAmount` | Unit | Passed 2026-10-18 (unit) |
| F-03 | Zero merchant / zero payer / zero amount | Reverts `ZeroAddress` / `ZeroAmount` | Unit | Passed 2026-10-18 (unit) |
| F-03 | Fuzz: any amount and fromBalance ≤ amount | merchant delta == amount; payer delta == fromBalance | Unit (fuzz) | Passed 2026-10-18 (unit, fromBalance = amount) |
| F-04 | Borrow leaves ICR 149.9% | Reverts `IcrBelowFloor`; nothing moves | Unit + Fork | Passed 2026-10-18 (unit + fork) |
| F-04 | Borrow leaves ICR exactly 150% | Succeeds | Unit | Passed 2026-10-18 (unit) |
| Permissions | Third party calls `pay()` with the payer's signatures but a different merchant | Reverts; funds cannot be redirected | Unit + Fork | Passed 2026-10-18 (unit + fork) |
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
- Unit: `cd contracts && forge test --match-contract MezherPayTest -vv` (ran 2026-10-18).
- Fork: `cd contracts && MEZO_TESTNET_RPC_URL=https://rpc.test.mezo.org forge test --match-path test/MezherPay.fork.t.sol -vv` (ran 2026-10-18; ~280 s, the public RPC is slow).
- End-to-end: Not configured (manual testnet run per `docs/DEMO.md`).
- Build/format: `cd contracts && forge build`, `cd contracts && forge fmt --check` (ran 2026-10-18). Web: `cd web && pnpm vitest run`, `cd web && pnpm build`, `cd web && pnpm lint` (ran 2026-10-18).
- Coverage: Not configured (planned: `cd contracts && forge coverage --ir-minimum` if needed).

## Release criteria
All "Unit", "Fork" and "Unit (vitest)" rows Passed; F-03/F-04/Permissions rows passed on fork; golden path passed manually on testnet 5 times in a row (rehearsal log in `docs/DEMO.md`); secrets greps clean; audit gate run with Critical/High fixed. Any failing row blocks submission unless it belongs to a stretch feature (then the feature is cut). Owner: repo owner.

## Results
| Date | Command | Result | Failures / limitations |
| --- | --- | --- | --- |
| 2026-10-18 | `forge test --match-contract MezherPayTest -vv` | 16 passed, 0 failed | — |
| 2026-10-18 | `MEZO_TESTNET_RPC_URL=https://rpc.test.mezo.org forge test --match-path test/MezherPay.fork.t.sol -vv` | 4 passed, 0 failed (276 s) | `PriceFeed.fetchPrice()` is mocked with `vm.mockCall` at 81,384e18: Mezo reads prices from the native precompile `0x7b7c…0015`, which does not exist in revm and makes the real PriceFeed recurse until it reverts. Live value checked with `cast call` the same day: 81,384.678e18. Every other contract in the fork flow is the real one. |
| 2026-10-18 | `forge fmt --check` / `forge build` | clean / compiles | — |
| 2026-10-18 | unit + fork rerun after fixing `foundry.toml` | 16 + 4 passed | Earlier runs used the `forge init` default config (evm osaka, optimizer off) because the intended `foundry.toml` was never written; now 0.8.28 / london / optimizer 200, confirmed in build metadata. Deploy dry run from the deployer: 701,064 gas. |
| 2026-10-18 | `forge script script/Deploy.s.sol --rpc-url mezo_testnet --account mezher-deployer --broadcast` (owner ran it) | MezherPay at 0xDF0ddaF1dA4e81f6E55284Ed8EBf58469EC219c2, block 16228993, 539,452 gas; `cast call MIN_ICR_AFTER` = 1.5e18; immutables match ARCHITECTURE; Blockscout verify passed | Verifier URL is `https://api.explorer.test.mezo.org/api/`, not the explorer host |
| 2026-10-18 | `cd web && pnpm vitest run` / `pnpm build` / `pnpm lint` | 3 passed / builds / clean | Build needs `transpilePackages` for Mezo orangekit (ships raw TS), an IgnorePlugin for optional `@x402/*` imports, and client-only wallet providers (Passport touches `document` at import). `pino-pretty` warning from wagmi is harmless. |
| 2026-10-19 | Manual golden path on Mezo testnet (`pnpm dev`, payer 0xe816…786e with Trove ICR 202% and 5 MUSD, merchant 0x0491…11aa, relayer 0x8a61…aca6) | Pass. Relayed 4 MUSD (3 balance + 1 borrowed) [0xeed3ffba…](https://explorer.test.mezo.org/tx/0xeed3ffba37020727cfe98642dc6166fb2e513f3c923bf429693ae5d9eee03652) sent by the relayer; 12 MUSD (5 + 7) [0x2e55c35d…](https://explorer.test.mezo.org/tx/0x2e55c35db52a70c7d6d6787e76aadb20715824ef535ec4cda1b44bdca19799d9) paid with own gas after a relay 503; merchant balance 16 MUSD; payer debt +7.007 MUSD (borrow + 0.1% fee); `/merchant` lists both rows with the right split; reopening the 4 MUSD link shows "Already paid" | First relay call returned 503 with no logged cause (cold route compile under low RAM or a transient RPC error); the catch now logs viem `shortMessage`. Later relays: 200 in 8 s and 2.5 s. Mezo RPC sometimes answers `eth_getTransactionReceipt` with `-32603 method handler crashed`; Blockscout API used instead. Relayer gas per pay ≈ 6e-11 BTC (gas price 146 wei). |
| 2026-10-19 | `cd web && pnpm vitest run` / `tsc --noEmit` | 65 passed / clean | `pnpm build` not rerun after the relay logging change (it would overwrite `.next` under the running dev server); last build passed 2026-10-18 |
