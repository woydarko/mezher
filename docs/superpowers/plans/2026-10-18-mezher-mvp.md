# Mezher MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Mezher on Mezo testnet: a payer with an MUSD Trove pays a merchant in MUSD from their balance plus a borrow taken straight from their Trove to the merchant, atomically, through a gasless relayer, with a checkout page, receipt and merchant page.

**Architecture:** One immutable Solidity contract `MezherPay` composes MUSD's EIP-2612 permit and Mezo's `BorrowerOperationsSignatures.withdrawMUSDWithSignature` (recipient = merchant), then enforces ICR ≥ 150%. A Next.js 14 app (React 18, Mezo Passport) builds the quote and the two EIP-712 signatures client-side and posts them to `/api/relay`, which simulates and submits `pay()` from a burner key. No database: history comes from `Paid` events.

**Tech Stack:** Foundry (forge 1.6.0), Solidity 0.8.28 (`evm_version london`), OpenZeppelin Contracts 5.x; Next.js 14.2.x, React 18, TypeScript strict, `@mezo-org/passport` 0.17.2, RainbowKit 2, wagmi 2, viem ^2.22, @tanstack/react-query 5, zod, vitest, lucide-react; pnpm.

**Spec:** `docs/PRD.md` (features F-01..F-07, S-01..S-04), `docs/ARCHITECTURE.md` (interfaces, flow, addresses), `docs/DESIGN_SYSTEM.md` (tokens, screens, wireframes W0–W3, copy), `docs/SECURITY.md`, `docs/DATABASE.md`, `docs/TESTING.md` (acceptance matrix), `docs/CODE_STYLE.md`. Event and Mezo facts: `MEZO_BUILDATHON.md` §12c–§12d. Read all before Task 1.

## Global Constraints

- Chain: Mezo testnet, chain ID `31611`, RPC `https://rpc.test.mezo.org`, explorer `https://explorer.test.mezo.org`.
- Solidity `pragma solidity 0.8.28;`, `evm_version = "london"`, optimizer on, 200 runs. No PUSH0/MCOPY/transient storage.
- Mezo testnet addresses (only source: ARCHITECTURE.md): MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, BorrowerOperationsSignatures `0xD757e3646AF370b15f32EB557F0F8380Df7D639e`, BorrowerOperations `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`, TroveManager `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`, PriceFeed `0x86bCF0841622a5dAC14A313a15f96A95421b9366`, HintHelpers `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6`, SortedTroves `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA`.
- EIP-712: MUSD permit domain `{name:"Mezo USD", version:"1", chainId:31611, verifyingContract:MUSD}`, type `Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)`, nonce `MUSD.nonces(owner)`. Borrow domain `{name:"BorrowerOperationsSignatures", version:"1", chainId:31611, verifyingContract:BorrowerOperationsSignatures}`, type `WithdrawMUSD(uint256 amount,address borrower,address recipient,uint256 nonce,uint256 deadline)`, nonce `getNonce(borrower)`. Both ECDSA only.
- `MIN_ICR_AFTER = 1.5e18` (150%, 1e18 = 100%). Client signature deadline = now + 15 minutes. The relay rejects deadlines more than 1 hour ahead.
- Mezo facts: Trove min net debt 1,800 MUSD + 200 MUSD gas compensation; borrowing fee 0.1% (`getBorrowingFee`); `PriceFeed.fetchPrice()` is `view` and returns USD per BTC with 18 decimals; `TroveManager.getTroveStatus` enum `1 = active`; `getCurrentICR(borrower, price)`; `getEntireDebtAndColl(borrower)` returns `(coll, principal, interest, pendingCollateral, pendingPrincipal, pendingInterest)`; `BorrowerOperations.openTrove(uint256 debtAmount, address upperHint, address lowerHint) payable`.
- Amounts are `bigint` wei (18 decimals) in all logic; `formatUnits`/`parseUnits` only at the UI edge. No floats for money.
- Relay limits: 5 requests/minute per payer and per IP → 429; dedupe (merchant, orderId, payer) for 10 minutes → 409; body > 4 KB → 413; relayer balance < 0.0005 BTC → 503.
- Link params: `to` address, `amount` decimal > 0 with ≤ 18 decimals, `order` 16–64 hex chars (bytes32 = left-padded), `label` ≤ 60 chars, optional.
- UI: tokens and copy exactly as DESIGN_SYSTEM.md; dark only; no UI kit besides RainbowKit; no floating toasts; every screen ships empty/loading/error/success states.
- Secrets: `RELAYER_PRIVATE_KEY` read only in `web/app/api/relay/route.ts`; deployer = Foundry keystore account `mezher-deployer`; never commit `.env`.
- Testnet deploys are pre-approved; Vercel production deploys need the owner's explicit OK each time; mainnet is out of scope.
- Commits: small, conventional (`feat:`, `test:`, `chore:`, `docs:`).

## Review Focus

1. **Malformed amounts in links** (`"12,5"`, `"1e3"`, `" 12"`, `"-1"`, 19 decimals): checkout must show "This payment link is incomplete", never a wrongly parsed amount. Test in Task 5 (`parseLink rejects locale and scientific formats`).
2. **Balance changes between quote and Pay** (payer spends MUSD in another tab): the permit value is no longer covered and simulation fails; the UI must say "Your MUSD balance changed. Refresh the quote." instead of a raw revert. Test in Task 9 (`errorCopy maps ERC20InsufficientBalance to balance-changed copy`).
3. **Quote right at the 150% floor while interest accrues**: the client could show OK while the chain says 149.99%. The quote blocks Pay below 150.5%; the contract stays the real guard. Test in Task 6 (`quote blocks at 150.4% and allows at 150.5%`).
4. **Wallet account or network switched mid-checkout** after signing: stale signatures must be discarded and the quote recomputed. Test in Task 9 (`checkoutReducer resets signatures when address changes`).
5. **RPC log-range limits on `getLogs`** for merchant history: queries must chunk (10,000 blocks per call) from the deploy block. Test in Task 10 (`fetchPaidLogs splits range into 10k-block chunks`).

---

## File structure

```
contracts/
  foundry.toml                       solc 0.8.28, london, rpc_endpoints.mezo_testnet = ${MEZO_TESTNET_RPC_URL}
  remappings.txt                     @openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
  src/MezherPay.sol                  the only product contract
  src/interfaces/IMezo.sol           IBorrowerOperationsSignatures, ITroveManager, IPriceFeed (minimal)
  test/MezherPay.t.sol               unit tests (mocks)
  test/MezherPay.fork.t.sol          fork tests (real Mezo testnet)
  test/mocks/MockMUSD.sol            ERC20Permit "Mezo USD" with public mint
  test/mocks/MockBorrowerOps.sol     verifies WithdrawMUSD ECDSA sig, mints to recipient, tracks debt
  test/mocks/MockTroveManager.sol    settable ICR
  test/mocks/MockPriceFeed.sol       settable price
  script/Deploy.s.sol                deploys MezherPay with testnet addresses
web/
  package.json, tsconfig.json, next.config.mjs, vitest.config.ts, .env.example
  app/layout.tsx, app/providers.tsx, app/globals.css, app/page.tsx
  app/pay/page.tsx, app/merchant/page.tsx, app/api/relay/route.ts
  components/Header.tsx Card.tsx ReceiptLine.tsx RatioMeter.tsx PrimaryButton.tsx SecondaryButton.tsx Field.tsx StatusLine.tsx PaymentsTable.tsx
  lib/mezo.ts        chain, addresses, ABIs (as const), explorer helpers
  lib/link.ts        parseLink / buildLink / randomOrder
  lib/quote.ts       quote() and ICR helpers
  lib/signatures.ts  permitTypedData / withdrawTypedData / splitSig
  lib/hints.ts       getBorrowHints()
  lib/relay.ts       relaySchema, createRelayHandler()
  lib/errors.ts      errorCopy()
  lib/checkout.ts    checkoutReducer (pure state machine)
  lib/paid-logs.ts   fetchPaidLogs(), isOrderPaid()
  lib/abi/MezherPay.json
  test/*.test.ts     vitest
```

---

### Task 1: Foundry scaffold + `MezherPay` balance-only payments (core, F-03)

**Files:**
- Create: `contracts/foundry.toml`, `contracts/remappings.txt`, `contracts/src/MezherPay.sol`, `contracts/src/interfaces/IMezo.sol`, `contracts/test/mocks/MockMUSD.sol`, `contracts/test/mocks/MockBorrowerOps.sol` (stub for now), `contracts/test/mocks/MockTroveManager.sol`, `contracts/test/mocks/MockPriceFeed.sol`, `contracts/test/MezherPay.t.sol`

**Interfaces:**
- Produces (exact, from ARCHITECTURE.md):
  ```solidity
  struct Payment   { address payer; address merchant; uint256 amount; uint256 fromBalance; bytes32 orderId; }
  struct PermitSig { uint256 deadline; uint8 v; bytes32 r; bytes32 s; }
  struct BorrowSig { address upperHint; address lowerHint; uint256 deadline; bytes signature; }
  constructor(IERC20 musd, IBorrowerOperationsSignatures bos, ITroveManager troveManager, IPriceFeed priceFeed)
  function pay(Payment calldata p, PermitSig calldata permit, BorrowSig calldata borrow) external
  event Paid(bytes32 indexed orderId, address indexed payer, address indexed merchant, uint256 amount, uint256 fromBalance, uint256 borrowed)
  error ZeroAddress(); error ZeroAmount(); error FromBalanceExceedsAmount(); error IcrBelowFloor(uint256 icr);
  uint256 public constant MIN_ICR_AFTER = 1.5e18;
  ```
  `IMezo.sol`: `IBorrowerOperationsSignatures.withdrawMUSDWithSignature(uint256 _amount, address _upperHint, address _lowerHint, address _borrower, address _recipient, bytes memory _signature, uint256 _deadline)` and `getNonce(address) returns (uint256)`; `ITroveManager.getCurrentICR(address,uint256) returns (uint256)`; `IPriceFeed.fetchPrice() external view returns (uint256)`.

- [x] **Step 1: Scaffold.** `cd contracts && forge init --no-git --force .` (delete the Counter example files), `forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git`, `foundry.toml` with `solc_version = "0.8.28"`, `evm_version = "london"`, `optimizer = true`, `optimizer_runs = 200`, `[rpc_endpoints] mezo_testnet = "${MEZO_TESTNET_RPC_URL}"`. Run `forge build`; expected: compiles.
- [x] **Step 2: Write failing tests** in `MezherPay.t.sol` (mocks deployed in `setUp`; `(payer, payerPk) = makeAddrAndKey("payer")`; MockMUSD mints 100e18 to payer; permit signed with `vm.sign` over the MockMUSD domain):
  - `test_pay_fromBalanceOnly_movesExactAmount`: amount 12e18, fromBalance 12e18 → merchant +12e18, payer −12e18; the borrow mock is never called.
  - `test_pay_emitsPaid`: `vm.expectEmit(true, true, true, true)` with `Paid(orderId, payer, merchant, 12e18, 12e18, 0)`.
  - `testRevert_zeroMerchant` / `testRevert_zeroPayer` → `ZeroAddress`; `testRevert_zeroAmount` → `ZeroAmount`; `testRevert_fromBalanceExceedsAmount` (fromBalance 13e18, amount 12e18) → `FromBalanceExceedsAmount`.
  - `testRevert_permitFromOtherKey`: permit signed by another key → `pay` reverts (permit failure swallowed, then OZ `ERC20InsufficientAllowance`); merchant balance unchanged.
  - `test_pay_permitFrontRun_stillSucceeds`: submit the permit directly to MockMUSD first, then `pay()` with the same permit → succeeds.
  - `testFuzz_pay_fromBalanceOnly(uint96 amount)`: bound to 1..100e18 → merchant delta == amount, payer delta == amount.
- [x] **Step 3: Run** `forge test --match-contract MezherPayTest -vvv`; expected: FAIL (MezherPay missing).
- [x] **Step 4: Implement `MezherPay`.** Immutables for the 4 constructor args (revert `ZeroAddress` on a zero arg). `pay` order: validate (`payer`, `merchant` non-zero; `amount > 0`; `fromBalance <= amount`) → if `fromBalance > 0`: `try IERC20Permit(address(musd)).permit(p.payer, address(this), p.fromBalance, permit.deadline, permit.v, permit.r, permit.s) {} catch {}` then `musd.safeTransferFrom(p.payer, p.merchant, p.fromBalance)` → compute `borrowed = amount - fromBalance` (borrow call added in Task 2) → `emit Paid(...)`. NatSpec on every external item.
- [x] **Step 5: Run** the test command → all PASS; `forge fmt --check` → no diff.
- [x] **Step 6: Commit** `feat(contracts): MezherPay balance-only payments with permit`.

### Task 2: Borrow-to-merchant path + ICR floor (core, F-03, F-04)

**Files:**
- Modify: `contracts/src/MezherPay.sol`, `contracts/test/mocks/MockBorrowerOps.sol`, `contracts/test/MezherPay.t.sol`

**Interfaces:**
- Consumes: Task 1 structs, errors, event.
- `MockBorrowerOps` (mirrors Mezo): EIP712 domain `("BorrowerOperationsSignatures", "1")`; `WITHDRAW_MUSD_TYPEHASH = keccak256("WithdrawMUSD(uint256 amount,address borrower,address recipient,uint256 nonce,uint256 deadline)")`; digest `_hashTypedDataV4(keccak256(abi.encodePacked(TYPEHASH, abi.encode(amount, borrower, recipient), nonces[borrower], deadline)))`; `require(block.timestamp <= deadline, "Signature expired")`; ECDSA recover must equal borrower else revert `"BorrowerOperationsSignatures: Invalid signature"`; increments the nonce; mints `amount` MockMUSD to `recipient`; adds `amount + amount / 1000` to `debt[borrower]`.

- [x] **Step 1: Failing tests:**
  - `test_pay_borrowOnly_mintsToMerchant`: fromBalance 0, amount 7e18 → merchant +7e18, payer balance unchanged, `mock.debt(payer) == 7.007e18`.
  - `test_pay_split_5plus7`: payer balance 5e18, amount 12e18, fromBalance 5e18 → merchant +12e18, payer −5e18, debt +7.007e18, event `Paid(orderId, payer, merchant, 12e18, 5e18, 7e18)`.
  - `testRevert_borrowSigForOtherRecipient`: signature with recipient = attacker, `pay` to merchant → reverts "Invalid signature"; merchant and attacker balances unchanged.
  - `testRevert_borrowSigExpired`: `vm.warp(deadline + 1)` → reverts "Signature expired".
  - `testRevert_icrBelowFloor`: MockTroveManager ICR 1.499e18 → reverts `IcrBelowFloor(1.499e18)`; merchant unchanged (atomic).
  - `test_pay_icrExactlyFloor_succeeds`: ICR 1.5e18 → succeeds.
  - `test_pay_fromBalanceOnly_skipsIcrCheck`: ICR 1e18 and borrowed 0 → succeeds.
- [x] **Step 2: Run** `forge test -vvv` → new tests FAIL.
- [x] **Step 3: Implement** in `pay`: if `borrowed > 0`: `bos.withdrawMUSDWithSignature(borrowed, borrow.upperHint, borrow.lowerHint, p.payer, p.merchant, borrow.signature, borrow.deadline)`; then `uint256 icr = troveManager.getCurrentICR(p.payer, priceFeed.fetchPrice()); if (icr < MIN_ICR_AFTER) revert IcrBelowFloor(icr);`.
- [x] **Step 4: Run** `forge test -vvv` → all PASS.
- [x] **Step 5: Commit** `feat(contracts): borrow-to-merchant via withdrawMUSDWithSignature with ICR floor`.

### Task 3: Fork tests against real Mezo + testnet deploy (core, on-chain walking skeleton; F-03, F-04)

**Files:**
- Create: `contracts/test/MezherPay.fork.t.sol`, `contracts/script/Deploy.s.sol`, `contracts/.env.example` (`MEZO_TESTNET_RPC_URL=`)
- Modify: `docs/hackathon/DEPLOYMENTS.md`, `docs/TESTING.md` (Verified commands + Results), `docs/CODE_STYLE.md` (Verified commands)

**Interfaces:**
- Consumes: `MezherPay` (Tasks 1–2), the real addresses in Global Constraints.
- Produces: the deployed `MezherPay` address and deploy block (Task 4 env `NEXT_PUBLIC_MEZHER_PAY_ADDRESS`, `NEXT_PUBLIC_MEZHER_PAY_DEPLOY_BLOCK`); ABI at `web/lib/abi/MezherPay.json` (the `.abi` field of `contracts/out/MezherPay.sol/MezherPay.json`).

- [x] **Step 1: Failing fork tests.** `setUp`: `vm.createSelectFork(vm.envOr("MEZO_TESTNET_RPC_URL", string("")))`, `vm.skip(true)` when empty; deploy `MezherPay` with the real addresses; `(payer, pk) = makeAddrAndKey("forkPayer")`; `vm.deal(payer, 1 ether)` (1 test BTC); as payer, `BorrowerOperations.openTrove{value: 0.1 ether}(2_000e18, address(0), address(0))`; transfer MUSD away so the payer wallet holds exactly 5e18; build digests from the real domains (read `eip712Domain()` on both contracts). Tests:
  - `test_fork_split_5plus7`: `pay` amount 12e18 / fromBalance 5e18 → merchant MUSD +12e18; payer MUSD −5e18; principal + interest from `getEntireDebtAndColl` up by `7e18 + getBorrowingFee(7e18)` (`assertApproxEqAbs(…, 1e12)` for interest dust); `Paid` emitted.
  - `test_fork_replayBorrowSig_reverts`: a second `pay` with the same borrow signature → revert.
  - `test_fork_icrFloor`: borrow an amount that drops ICR below 150% (computed from `getCurrentICR` and price) → reverts `IcrBelowFloor`.
  - `test_fork_thirdPartyCannotRedirect`: a relayer address calls `pay` with a different merchant → revert; balances unchanged.
- [x] **Step 2: Run** `MEZO_TESTNET_RPC_URL=https://rpc.test.mezo.org forge test --match-path test/MezherPay.fork.t.sol -vvv` → PASS. If forking fails on RPC state limits, pin `--fork-block-number` to the latest `cast block-number --rpc-url https://rpc.test.mezo.org` and note it in TESTING.md.
- [x] **Step 3: Deploy script** `Deploy.s.sol`: `run()` broadcasts `new MezherPay(MUSD, BOS, TROVE_MANAGER, PRICE_FEED)` with the constants above and logs the address. The owner imports a burner once with `cast wallet import mezher-deployer --interactive` (owner types the key locally; never in chat). Deploy: `forge script script/Deploy.s.sol --rpc-url mezo_testnet --account mezher-deployer --broadcast`. Expected: address printed, tx visible on the explorer.
- [x] **Step 4: Verify on-chain.** `cast call <addr> "MIN_ICR_AFTER()(uint256)" --rpc-url https://rpc.test.mezo.org` → `1500000000000000000`. Try `forge verify-contract <addr> src/MezherPay.sol:MezherPay --verifier blockscout --verifier-url https://explorer.test.mezo.org/api`; if unsupported, record "not verified: <reason>".
- [x] **Step 5: Docs.** DEPLOYMENTS.md row for MezherPay (address, deploy tx link, verified yes/no, deploy block); CODE_STYLE/TESTING "Verified commands" replaced with the commands that actually ran; a TESTING Results row with the date and outcome.
- [x] **Step 6: Commit** `feat(contracts): fork tests on Mezo testnet and deploy MezherPay`.

### Task 4: Web scaffold, tokens, providers, base components (core, F-01)

**Files:**
- Create: `web/` (Next 14 app), `web/app/layout.tsx`, `web/app/providers.tsx`, `web/app/globals.css`, `web/components/Header.tsx`, `Card.tsx`, `PrimaryButton.tsx`, `SecondaryButton.tsx`, `Field.tsx`, `StatusLine.tsx`, `ReceiptLine.tsx`, `web/lib/mezo.ts`, `web/.env.example`, `web/vitest.config.ts`, `web/test/mezo.test.ts`

**Interfaces:**
- Produces: `lib/mezo.ts` exports `MEZO_TESTNET` (viem `Chain`, id 31611; reuse `mezoTestnet` from `@mezo-org/passport` if exported, else `defineChain`), `ADDRESSES` (`musd`, `borrowerOpsSignatures`, `borrowerOperations`, `troveManager`, `priceFeed`, `hintHelpers`, `sortedTroves`, `mezherPay` from `NEXT_PUBLIC_MEZHER_PAY_ADDRESS`), ABIs `musdAbi`, `borrowerOpsSignaturesAbi`, `borrowerOperationsAbi`, `troveManagerAbi`, `priceFeedAbi`, `hintHelpersAbi`, `sortedTrovesAbi`, `mezherPayAbi` (all `as const`, only the functions named in ARCHITECTURE "Request and data flow"); `explorerTx(hash: Hex): string`, `explorerAddress(addr: Address): string`.
- Component props: `PrimaryButton({children, loading?, loadingLabel?, disabled?, disabledReason?, onClick})`, `SecondaryButton({children, onClick, href?})`, `ReceiptLine({label, value, sub?})`, `Field({label, helper?, error?, ...inputProps})`, `StatusLine({tone: "info" | "success" | "error", children, href?})`, `Card({children, title?})`.

- [x] **Step 1: Scaffold.** `pnpm create next-app@14 web --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*"`; pin `next@14.2.x`, `react@18`, `react-dom@18`; add `@mezo-org/passport@0.17.2 @rainbow-me/rainbowkit@^2 wagmi@^2 viem@^2.22 @tanstack/react-query@^5 zod lucide-react`, dev `vitest`. Read the Passport README for `getConfig` options (WalletConnect project id needed or not) and record the answer in ARCHITECTURE "Decisions and unknowns".
- [x] **Step 2: Failing test** `test/mezo.test.ts`: `MEZO_TESTNET.id === 31611`; `ADDRESSES.musd === "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"`; `explorerTx("0xabc")` starts with `https://explorer.test.mezo.org/tx/`.
- [x] **Step 3: Implement** `lib/mezo.ts`; `globals.css` with every DESIGN_SYSTEM token as CSS variables (plus motion tokens and the `prefers-reduced-motion` rule); fonts via `next/font/google` (Instrument Sans, JetBrains Mono); `providers.tsx` = WagmiProvider(Passport `getConfig`) + QueryClientProvider + RainbowKitProvider (initialChain Mezo testnet, `darkTheme({ accentColor: "#F7931A" })`); `Header` per the W1 top bar; components per DESIGN_SYSTEM "Components".
- [x] **Step 4: Run** `pnpm vitest run` → PASS; `pnpm build` → success; `pnpm lint` → no errors. Record the three commands as verified in CODE_STYLE.md and TESTING.md.
- [x] **Step 5: Commit** `feat(web): Next 14 scaffold with Mezo Passport, tokens and base components`.

### Task 5: Payment links (core, F-06)

**Files:**
- Create: `web/lib/link.ts`, `web/test/link.test.ts`

**Interfaces:**
- Produces: `type PayLink = { to: Address; amountWei: bigint; orderId: Hex; orderRaw: string; label?: string }`; `parseLink(params: URLSearchParams): { ok: true; link: PayLink } | { ok: false; error: "incomplete" }`; `buildLink(origin: string, input: { to: string; amount: string; order: string; label?: string }): { ok: true; url: string } | { ok: false; field: "to" | "amount" | "order" | "label"; message: string }`; `randomOrder(): string` (16 lowercase hex chars).

- [x] **Step 1: Failing tests:** round trip `buildLink(origin, {to, amount: "12", order: "3f9a1c0d2b4e5f60", label: "Coffee"})` → `parseLink` gives the same `to`, `amountWei === 12n * 10n**18n`, `orderId === "0x" + "0".repeat(48) + "3f9a1c0d2b4e5f60"`, label "Coffee"; rejects amount `"0"`, `""`, 19 decimals, `"-1"`; **`parseLink rejects locale and scientific formats`** (`"12,5"`, `"1e3"`, `" 12"`); rejects a bad address and orders of 15 or 65 chars or non-hex; `buildLink` rejects a 61-char label; `randomOrder()` matches `/^[0-9a-f]{16}$/`.
- [x] **Step 2: Run** `pnpm vitest run test/link.test.ts` → FAIL.
- [x] **Step 3: Implement** with viem `isAddress`, `getAddress`, `parseUnits`, `pad`; amount regex `^\d+(\.\d{1,18})?$` and value > 0; field messages in DESIGN_SYSTEM voice ("Enter an amount greater than 0.", "Enter a valid 0x address.", "Order id must be 16–64 hex characters.", "Keep the label under 60 characters.").
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(web): payment link parse/build`.

### Task 6: Quote math (core, F-02, mirror of F-04)

**Files:**
- Create: `web/lib/quote.ts`, `web/test/quote.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type TroveState = { status: number; collWei: bigint; debtWei: bigint } // debt = principal + interest + pending
  type QuoteInput = { amountWei: bigint; balanceWei: bigint; trove: TroveState; priceE18: bigint; feeWei: bigint }
  type Quote =
    | { state: "ok"; fromBalanceWei: bigint; borrowWei: bigint; feeWei: bigint; icrNowE18: bigint | null; icrAfterE18: bigint | null }
    | { state: "needs_trove"; shortfallWei: bigint }
    | { state: "blocked_ratio"; icrAfterE18: bigint; maxBorrowWei: bigint }
  const UI_ICR_FLOOR_E18 = 1_505_000_000_000_000_000n // 150.5%: margin over the on-chain 150%
  function quote(i: QuoteInput): Quote
  function icrE18(collWei: bigint, priceE18: bigint, debtWei: bigint): bigint // coll * price / debt, rounded down
  function maxBorrowWei(trove: TroveState, priceE18: bigint, floorE18: bigint, feeRateE18: bigint): bigint
  ```
  The fee comes from the chain (`getBorrowingFee(borrowWei)`) and is passed in; `maxBorrowWei` uses `feeRateE18 = 10n**15n` (0.1%).

- [x] **Step 1: Failing tests:** balance 5e18, amount 12e18, fee 7e15, coll 0.04e18, debt 2000e18, price 81_155e18 → `ok`, fromBalance 5e18, borrow 7e18, `icrAfterE18 === icrE18(coll, price, 2000e18 + 7e18 + 7e15)`; balance ≥ amount → borrow 0 and state `ok` even without a Trove (ICR fields null when status ≠ 1); status ≠ 1 and balance < amount → `needs_trove` with the shortfall; **`quote blocks at 150.4% and allows at 150.5%`** (debt chosen so icrAfter is exactly each value); `maxBorrowWei` result keeps icr ≥ floor after the fee and +1 wei breaks it.
- [x] **Step 2: Run** `pnpm vitest run test/quote.test.ts` → FAIL.
- [x] **Step 3: Implement** (pure bigint math, round ICR down — conservative).
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(web): quote math with ICR safety margin`.

### Task 7: Typed data + Trove hints (core, F-03)

**Files:**
- Create: `web/lib/signatures.ts`, `web/lib/hints.ts`, `web/test/signatures.test.ts`, `web/test/hints.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function permitTypedData(a: { owner: Address; spender: Address; valueWei: bigint; nonce: bigint; deadline: bigint }): TypedDataDefinition
  function withdrawTypedData(a: { amountWei: bigint; borrower: Address; recipient: Address; nonce: bigint; deadline: bigint }): TypedDataDefinition
  function splitSig(sig: Hex): { v: number; r: Hex; s: Hex } // via viem parseSignature
  type HintClient = { readContract: PublicClient["readContract"] }
  function getBorrowHints(client: HintClient, a: { collWei: bigint; debtAfterWei: bigint }): Promise<{ upperHint: Address; lowerHint: Address }>
  ```
  Hints: `nicr = collWei * 10n**20n / debtAfterWei`; `HintHelpers.getApproxHint(nicr, 15n, randomSeed)` → first return value `hintAddress`; `SortedTroves.findInsertPosition(nicr, hint, hint)` → `[upper, lower]`.

- [x] **Step 1: Failing tests:** `withdrawTypedData` domain equals `{name: "BorrowerOperationsSignatures", version: "1", chainId: 31611, verifyingContract: ADDRESSES.borrowerOpsSignatures}`, primaryType `WithdrawMUSD`, fields in order `amount, borrower, recipient, nonce, deadline`; `permitTypedData` domain name `"Mezo USD"`, version `"1"`, type fields `owner, spender, value, nonce, deadline`; `hashTypedData(withdrawTypedData(x))` equals a digest built in the test the way the contract does (`keccak256(0x1901 ‖ domainSeparator ‖ keccak256(TYPEHASH ‖ abi.encode(amount, borrower, recipient) ‖ nonce ‖ deadline))` with viem `encodePacked`/`encodeAbiParameters`); `getBorrowHints` with a fake client calls `getApproxHint` then `findInsertPosition` with the computed NICR and returns that pair.
- [x] **Step 2: Run** `pnpm vitest run test/signatures.test.ts test/hints.test.ts` → FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(web): EIP-712 builders for MUSD permit and WithdrawMUSD, trove hints`.

### Task 8: Gasless relay API (core, F-05)

**Files:**
- Create: `web/lib/relay.ts`, `web/app/api/relay/route.ts`, `web/test/relay.test.ts`

**Interfaces:**
- Consumes: `mezherPayAbi`, `ADDRESSES` (Task 4).
- Produces:
  ```ts
  const relaySchema: z.ZodType<RelayRequest> // shape in ARCHITECTURE "API POST /api/relay"
  type RelayDeps = {
    simulate(req: RelayRequest): Promise<{ ok: true } | { ok: false; reason: string }>
    send(req: RelayRequest): Promise<Hex>
    relayerBalanceWei(): Promise<bigint>
    now(): number // ms
  }
  function createRelayHandler(deps: RelayDeps): (req: Request) => Promise<Response>
  ```
  `route.ts` wires real deps with viem (`createPublicClient`, `createWalletClient` with `privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY)`, `simulateContract`, `writeContract`, revert decoding with `decodeErrorResult` against `mezherPayAbi`, falling back to the Mezo revert string), `export const runtime = "nodejs"`. Logging per SECURITY.md (route, status, payer prefix, hash only).

- [x] **Step 1: Failing tests** with fake deps: valid body → 200 `{hash}` and `send` called once; malformed body → 400 `invalid_input`; body > 4096 bytes → 413; simulation `{ok: false, reason: "IcrBelowFloor"}` → 422 `simulation_failed` and `send` not called; 6th request from the same payer within 60 s (controlled `now`) → 429; the same (merchant, orderId, payer) twice within 10 minutes → 409; relayer balance < 5e14 → 503 `relayer_unavailable`; deadline > now + 3600 s → 400.
- [x] **Step 2: Run** `pnpm vitest run test/relay.test.ts` → FAIL.
- [x] **Step 3: Implement** (`// shortcut: in-memory Maps per serverless instance, move to Redis/Upstash if abused`).
- [x] **Step 4: Run** → PASS; `pnpm build` → success; `grep -r RELAYER_PRIVATE_KEY web/.next/static` → no match.
- [x] **Step 5: Commit** `feat(web): gasless relay endpoint with simulation and rate limits`.

### Task 9: Checkout + receipt (core, F-01, F-02, F-03, F-05, F-07; golden path end to end)

**Files:**
- Create: `web/app/pay/page.tsx`, `web/components/RatioMeter.tsx`, `web/lib/checkout.ts`, `web/lib/errors.ts`, `web/test/checkout.test.ts`, `web/test/errors.test.ts`

**Interfaces:**
- Consumes: `parseLink` (T5), `quote`, `UI_ICR_FLOOR_E18` (T6), `permitTypedData`, `withdrawTypedData`, `splitSig`, `getBorrowHints` (T7), `/api/relay` (T8), components (T4).
- Produces:
  ```ts
  type CheckoutState = { step: "idle" | "signing_permit" | "signing_borrow" | "sending" | "confirming" | "paid" | "failed"; address?: Address; permit?: PermitSig; borrow?: BorrowSig; hash?: Hex; error?: string }
  type CheckoutEvent = { type: "ADDRESS_CHANGED"; address?: Address } | { type: "START" } | { type: "PERMIT_SIGNED"; permit: PermitSig } | { type: "BORROW_SIGNED"; borrow: BorrowSig } | { type: "SENT"; hash: Hex } | { type: "CONFIRMED" } | { type: "FAILED"; code: string } | { type: "RESET" }
  function checkoutReducer(s: CheckoutState, e: CheckoutEvent): CheckoutState
  function errorCopy(code: string): string // API codes, MezherPay errors, Mezo revert strings, OZ ERC20 errors → DESIGN_SYSTEM voice
  ```
  `RatioMeter({nowE18, afterE18})`: `role="meter"`, markers at 110% and 150%, colour bands per DESIGN_SYSTEM.

- [x] **Step 1: Failing tests:** **`checkoutReducer resets signatures when address changes`** (`ADDRESS_CHANGED` from `signing_borrow` with a stored permit → `idle` with permit/borrow cleared); the happy sequence idle → … → paid keeps the hash; `FAILED` stores `errorCopy(code)`; **`errorCopy maps ERC20InsufficientBalance to balance-changed copy`** ("Your MUSD balance changed. Refresh the quote."); `IcrBelowFloor` → "Your Trove would drop below 150%. Pay less or add collateral on Mezo."; `rate_limited` → "Too many attempts. Wait a minute and try again."; `relayer_unavailable` → "Our gas relay is down. Pay with your own gas instead."; `"Signature expired"` → "Your signature expired. Press Pay again."; unknown → "Something went wrong (<code>). Try again."
- [x] **Step 2: Run** `pnpm vitest run test/checkout.test.ts test/errors.test.ts` → FAIL.
- [x] **Step 3: Implement** the reducer and copy, then the page per wireframes W1/W2 and DESIGN_SYSTEM states: invalid link → empty state; reads via wagmi `useReadContracts` (MUSD balance, `getTroveStatus`, `getEntireDebtAndColl`, `fetchPrice`, `getBorrowingFee(borrowWei)`) → `quote()`; "Already paid" behind `const ALREADY_PAID_CHECK = false` (flipped in Task 10); Pay → sign the permit if `fromBalanceWei > 0` → hints + sign the borrow if `borrowWei > 0` → POST `/api/relay` → `waitForTransactionReceipt` → receipt with `explorerTx` and the new ICR; 503/network error → "Pay with my own gas" calls `writeContract(pay)` from the wallet with the same signatures; wrong network → RainbowKit switch prompt; no Trove → CTA link `https://testnet.mezo.org`.
- [ ] **Step 4: Run** unit tests → PASS; `pnpm build` → success. **Manual golden path on Mezo testnet** (`pnpm dev`, demo payer wallet, merchant = a second address, amount larger than the balance): receipt shows the tx; the explorer shows the merchant received the full amount. Record the tx hash in DEPLOYMENTS.md "Reference transactions" and the run in TESTING.md Results.
- [x] **Step 5: Commit** `feat(web): checkout with credit preview, signatures, relay and receipt`.

### Task 10: Merchant page, landing, already-paid (core, F-06, F-07)

**Files:**
- Create: `web/app/merchant/page.tsx`, `web/components/PaymentsTable.tsx`, `web/lib/paid-logs.ts`, `web/test/paid-logs.test.ts`
- Modify: `web/app/page.tsx` (replace the scaffold page with W0), `web/app/pay/page.tsx` (`ALREADY_PAID_CHECK = true`)

**Interfaces:**
- Produces: `type PaidLog = { orderId: Hex; payer: Address; merchant: Address; amountWei: bigint; fromBalanceWei: bigint; borrowedWei: bigint; txHash: Hex; blockNumber: bigint }`; `fetchPaidLogs(client: { getLogs: PublicClient["getLogs"]; getBlockNumber(): Promise<bigint> }, a: { merchant: Address; orderId?: Hex; fromBlock: bigint }): Promise<PaidLog[]>` (newest first, 10,000-block chunks); `isOrderPaid(logs: PaidLog[], orderId: Hex, amountWei: bigint): boolean` (true only when a log has the same orderId and amount ≥ requested).

- [x] **Step 1: Failing tests:** **`fetchPaidLogs splits range into 10k-block chunks`** (fake client, fromBlock 100, head 25,150 → 3 calls with ranges [100, 10099], [10100, 20099], [20100, 25150]); results sorted newest first; `isOrderPaid` is false when the logged amount is lower than requested (a 1-wei fake payment cannot mark an order paid).
- [x] **Step 2: Run** `pnpm vitest run test/paid-logs.test.ts` → FAIL.
- [x] **Step 3: Implement** the helpers; `/merchant` per W3 (connected address prefilled and editable; `buildLink` + `randomOrder`; copy button with a "Copied" state; payments list polling every 5 s with empty/loading/error states; label notice "Labels are visible to anyone with the link."); landing per W0; checkout "Already paid" state.
- [ ] **Step 4: Run** unit tests → PASS; `pnpm build` → success; manual: create a link on `/merchant`, pay it from another browser profile, see it listed within 15 s, reopen the link → "Already paid".
- [x] **Step 5: Commit** `feat(web): merchant links, payments history and landing`.

### Task 11: Ship the walking skeleton (core; deploy + docs sync)

**Files:**
- Modify: `docs/hackathon/DEPLOYMENTS.md`, `docs/hackathon/STATE.md`, `docs/TESTING.md`
- Create: `README.md` (minimal: pitch line, live URL, chain info, run in ≤ 5 commands; the full README is Phase 6)

- [ ] **Step 1:** Ask the owner for OK to create the Vercel project and deploy to production (needed every time). Set the env vars in Vercel (names in ARCHITECTURE "Operations"); the owner funds the relayer burner with ≤ 0.01 test BTC.
- [ ] **Step 2:** Deploy; open the URL logged out on another device; run the golden path once with the demo payer. Expected: receipt + explorer tx.
- [ ] **Step 3:** Record the URL, relayer address, reference tx and "network switch tested with a fresh wallet: Yes/No" in DEPLOYMENTS.md; add a checkpoint row in STATE.md and a Results row in TESTING.md.
- [ ] **Step 4: Commit** `chore: deploy walking skeleton to Vercel + Mezo testnet`.

### Stretch tasks (auto-cut if behind; only after Task 11, in this order)

- **S-03 QR code:** `web/components/LinkQr.tsx` renders the `/pay` URL (dependency `qrcode`, with a one-line justification in the commit). Test: renders an `svg` for a valid URL. Commit `feat(web): QR for payment links`.
- **S-02 In-app Trove opening:** `openTroveWithSignature` on the no-Trove state (debt ≥ 1,800 MUSD, hints from `getBorrowHints`). vitest for the typed data of `OpenTrove(uint256 assetAmount,uint256 debtAmount,address borrower,address recipient,uint256 nonce,uint256 deadline)` and a manual testnet run.
- **S-01 x402 borrow-to-pay:** a demo x402 seller (`@x402/express`, price `"$0.01"`, network `eip155:31611`) and a buyer flow that borrows the gap to the buyer's own wallet via `withdrawMUSDWithSignature(recipient = buyer)` and then pays with `@x402/fetch`. Write its own mini-plan before starting.
- **S-04 Telegram ping:** needs persistence; write a DATABASE.md section first.

---

## Schedule (build window 2026-10-19 08:00 → 2026-10-23 17:50 +0700, from STATE.md)
| Target end | Tasks | Milestone |
| --- | --- | --- |
| 2026-10-19 20:00 | 1, 2 | contract logic done test-first |
| 2026-10-20 14:00 | 3 | real Mezo fork proof + testnet deploy |
| 2026-10-21 02:00 | 4, 5, 6 | ~40% of build: contract live, web skeleton |
| 2026-10-22 02:00 | 7, 8, 9 | golden path end to end on testnet |
| 2026-10-22 20:00 | 10, 11 | all core done + deployed |
| 2026-10-23 17:50 | S-03 → S-02 → S-01 | stretch |

Behind at 50% of build (2026-10-21 12:55 +0700): drop all stretch; if still behind, ship F-05 with the own-gas path only and keep the relay for Wave 2.
