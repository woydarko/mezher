# Architecture

Status: **Proposal - needs approval** (Phase 2 gate). Verified facts about Mezo come from `MEZO_BUILDATHON.md` §12c–§12d (checked on-chain and in `mezo-org/musd` on 2026-10-18).

## System purpose
Mezher lets a payer with an MUSD Trove on Mezo pay a merchant in MUSD, taking what it can from the payer's MUSD balance and **borrowing only the gap directly from the payer's Trove to the merchant**, in one atomic transaction that a relayer submits, so the payer pays no gas. See `docs/PRD.md` F-01..F-07.

Technical constraints: Mezo testnet (chain ID 31611); Solidity 0.8.28 with `evmVersion london`; the Mezo signature contracts and the MUSD permit verify **ECDSA only** (EOA payers); `minNetDebt` 1,800 MUSD + 200 MUSD gas compensation (a Trove always carries ≥ 2,000 MUSD debt); borrowing fee 0.1%; MCR 110%; no flashmint exists for MUSD.

## Stack decisions
| Layer | Selected technology | Reason | Constraints |
| --- | --- | --- | --- |
| Smart contract | Solidity 0.8.28 + Foundry (forge 1.6.0 installed), OpenZeppelin Contracts 5.x (`IERC20`, `IERC20Permit`, `SafeERC20` only) | Mezo docs recommend Foundry/Hardhat; Foundry gives fast unit + **fork tests against real Mezo testnet contracts** | `evm_version = "london"`; no OZ module that needs Cancun opcodes |
| Frontend | Next.js **14.2.x** (App Router) + React 18 + TypeScript | `@mezo-org/passport@0.17.2` peer-depends on React ^18 (Next 15/16 need React 19); one project serves the UI and the relayer API | Pin Next 14.2.x |
| Wallet | `@mezo-org/passport` 0.17.2 + `@rainbow-me/rainbowkit` ^2 + `wagmi` ^2 + `viem` ^2.22 + `@tanstack/react-query` ^5 | Official Mezo wallet library (Mezo Integration criterion), handles network config | Payers must be EVM/ECDSA wallets (see PRD Open decisions) |
| Backend/API | Next.js route handler `POST /api/relay` (Node runtime) using viem `walletClient` | Gasless UX (F-05) with the smallest server; same deploy as the UI | Relayer key server-only; in-memory rate limit |
| Database | **None** | All state is on-chain (`Paid` events, Trove state); payment links are stateless URLs | See DATABASE.md |
| Authentication | None (wallet signatures authorize payments) | No accounts in scope | Payment authority = payer's EIP-712 signatures, verified on-chain |
| Hosting | Vercel (Next.js) for web + relayer; contracts on Mezo testnet | Zero-config Next.js hosting, free tier | **Proposal - needs approval**; production deploys need the owner's OK each time |
| Validation | `zod` in `/api/relay` | Trust boundary input checks | — |
| Unit tests (web) | `vitest` for pure TS (quote/ICR math, link parsing) | Fast, no browser | — |

## System boundaries
- **Client owns**: wallet connection, reading chain state for display (balances, Trove, price), computing the quote (split, fee, ICR before/after, hints), building and signing the two EIP-712 messages, building payment links, listing `Paid` events. The client is never trusted for safety; the contract re-checks everything.
- **Contract (`MezherPay`) owns**: atomic execution of a payment: permit + `transferFrom` of the balance part to the merchant, `withdrawMUSDWithSignature` of the borrowed part with recipient = merchant, the **ICR ≥ 150% guard** after borrowing, input checks, and the `Paid` event. No owner, no admin, no upgradeability, holds no funds between calls.
- **Server (`/api/relay`) owns**: input validation, simulation before sending, rate limiting, paying gas from the relayer key. It cannot move funds on its own: without the payer's signatures every `pay()` reverts.
- **External services own**:
  - Mezo MUSD system (testnet): `BorrowerOperationsSignatures` `0xD757e3646AF370b15f32EB557F0F8380Df7D639e`, `BorrowerOperations` `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`, `TroveManager` `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`, `PriceFeed` `0x86bCF0841622a5dAC14A313a15f96A95421b9366`, `HintHelpers` `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6`, `SortedTroves` `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA`, `MUSD` `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`. Failure: RPC down → UI error state + "Retry"; Mezo recovery mode (TCR < 150%) can block borrowing → the revert reason is shown.
  - Mezo testnet RPC `https://rpc.test.mezo.org` (WSS `wss://rpc-ws.test.mezo.org`), explorer `https://explorer.test.mezo.org`.
- **Out of scope**: Trove open/close/collateral management (link to testnet.mezo.org), repayment, mainnet, cross-chain, x402 (stretch S-01), indexer/subgraph, user accounts.

## Request and data flow
Golden path (J1):
1. Payer opens `/pay?to&amount&order&label`; the checkout page parses and validates params client-side (empty state if invalid).
2. After connect, the client reads in parallel: `MUSD.balanceOf(payer)`, `TroveManager.getTroveStatus/getTroveColl/getTroveDebt(payer)`, `PriceFeed.fetchPrice()` (via `eth_call`), `BorrowerOperations.getBorrowingFee(borrow)`, and `Paid` logs for (merchant, order) to detect "already paid".
3. `lib/quote.ts` computes `fromBalance = min(balance, amount)`, `borrow = amount − fromBalance`, `fee`, ICR now/after (`coll * price / debt`, 1e18 = 100%) and disables Pay below 150%.
4. On **Pay**: if `fromBalance > 0`, the payer signs the MUSD EIP-2612 permit (domain `{name:"Mezo USD", version:"1", chainId:31611, verifyingContract:MUSD}`, spender = `MezherPay`, value = fromBalance, nonce = `MUSD.nonces(payer)`, deadline = now + 15 min). If `borrow > 0`, the client computes hints (`HintHelpers.getApproxHint` → `SortedTroves.findInsertPosition` with the post-borrow NICR) and the payer signs `WithdrawMUSD(uint256 amount,address borrower,address recipient,uint256 nonce,uint256 deadline)` (domain `{name:"BorrowerOperationsSignatures", version:"1", chainId:31611, verifyingContract:0xD757…639e}`, recipient = merchant, nonce = `BorrowerOperationsSignatures.getNonce(payer)`).
5. The client `POST`s `/api/relay` with `{payment, permit, borrow}`. The server validates with zod, rate-limits by payer, `simulateContract(pay)`; on success `writeContract` from the relayer key and returns `{hash}`; on simulation failure it returns 422 with the decoded revert reason.
6. `MezherPay.pay()` checks inputs → permit (try/catch) → `safeTransferFrom(payer → merchant, fromBalance)` → `withdrawMUSDWithSignature(borrow, hints, payer, merchant, sig, deadline)` → reads `getCurrentICR(payer, price)` and reverts `IcrBelowFloor` if < 1.5e18 → emits `Paid`.
7. The client waits for the receipt (`waitForTransactionReceipt`), shows the Receipt screen with the explorer link and the new ratio. `/merchant` picks the event up on its next poll (every 5 s).
Failure: any revert → nothing moves (atomic) and the UI shows the reason with Retry. Relayer unavailable (network error/5xx) → "Pay with my own gas": the payer's wallet calls `pay()` directly with the same signatures.

## Interfaces
**Contract `MezherPay`** (`contracts/src/MezherPay.sol`) — **Proposal - needs approval**
```solidity
struct Payment   { address payer; address merchant; uint256 amount; uint256 fromBalance; bytes32 orderId; }
struct PermitSig { uint256 deadline; uint8 v; bytes32 r; bytes32 s; }          // ignored when fromBalance == 0
struct BorrowSig { address upperHint; address lowerHint; uint256 deadline; bytes signature; } // ignored when borrowed == 0

uint256 public constant MIN_ICR_AFTER = 1.5e18; // 150%
constructor(IERC20 musd, IBorrowerOperationsSignatures bos, ITroveManager troveManager, IPriceFeed priceFeed); // immutables

function pay(Payment calldata p, PermitSig calldata permit, BorrowSig calldata borrow) external;

event Paid(bytes32 indexed orderId, address indexed payer, address indexed merchant,
           uint256 amount, uint256 fromBalance, uint256 borrowed);

error ZeroAddress(); error ZeroAmount(); error FromBalanceExceedsAmount();
error IcrBelowFloor(uint256 icr);
```
Rules: `borrowed = amount − fromBalance`; anyone may call `pay()` (relayer or payer); signatures bind payer, merchant and amounts, so the caller cannot redirect funds. `orderId` is informational (event only, no on-chain uniqueness; avoids a griefing vector where a third party pre-marks an order as paid). Double-pay protection is client + relayer side (see below).

**Mezo interfaces used** (minimal, in `contracts/src/interfaces/`): `IBorrowerOperationsSignatures.withdrawMUSDWithSignature(uint256,address,address,address,address,bytes,uint256)` and `getNonce(address)`; `ITroveManager.getCurrentICR(address,uint256)`; `IPriceFeed.fetchPrice()`; `IERC20Permit.permit` on MUSD.

**API `POST /api/relay`**
- Request JSON: `{ payment: {payer, merchant, amount, fromBalance, orderId}, permit: {deadline, v, r, s}, borrow: {upperHint, lowerHint, deadline, signature} }`. Addresses = checksummed hex; amounts = decimal strings in wei; `orderId` = 0x + 64 hex.
- 200 `{ hash }` — tx sent.
- 400 `{ error: "invalid_input", details }` — zod failure.
- 409 `{ error: "already_relayed" }` — the same (merchant, orderId, payer) was sent in the last 10 minutes (in-memory).
- 422 `{ error: "simulation_failed", reason }` — `pay()` would revert (decoded custom error or Mezo revert string).
- 429 `{ error: "rate_limited" }` — > 5 requests/minute per payer or per IP.
- 503 `{ error: "relayer_unavailable" }` — relayer key missing or balance below 0.000001 BTC (testnet gas ~146 wei, ~10k payments).

**Events/jobs**: no background jobs. `Paid` is the only event consumer interface (merchant page polls `getLogs` filtered by `merchant`, from the deployment block). Idempotency: the relayer dedupe window plus the UI "already paid" check on events.

## Project structure
```
/                         repo root (pnpm not required; two independent packages)
├─ AGENTS.md, CLAUDE.md   agent entry points
├─ MEZO_BUILDATHON.md     event reference (do not edit during build)
├─ docs/                  PRD, DESIGN_SYSTEM, ARCHITECTURE, DATABASE, SECURITY, CODE_STYLE, TESTING, DEMO (Phase 6)
│  └─ hackathon/          STATE.md, DEPLOYMENTS.md, PITCH.md, SUBMISSION.md
├─ contracts/             Foundry project
│  ├─ foundry.toml        solc 0.8.28, evm_version london, rpc_endpoints.mezo_testnet
│  ├─ src/MezherPay.sol
│  ├─ src/interfaces/     IBorrowerOperationsSignatures.sol, ITroveManager.sol, IPriceFeed.sol
│  ├─ test/MezherPay.t.sol        unit tests with mocks
│  ├─ test/MezherPay.fork.t.sol   fork tests against Mezo testnet
│  ├─ test/mocks/
│  └─ script/Deploy.s.sol
└─ web/                   Next.js 14 app
   ├─ app/ (page.tsx landing, pay/page.tsx, merchant/page.tsx, api/relay/route.ts, layout.tsx, globals.css)
   ├─ components/         UI components listed in DESIGN_SYSTEM §11
   ├─ lib/mezo.ts         chain config + Mezo contract addresses + ABIs
   ├─ lib/quote.ts        split / fee / ICR math (pure, unit tested)
   ├─ lib/hints.ts        Trove hint computation
   ├─ lib/signatures.ts   EIP-712 typed data builders (permit + WithdrawMUSD)
   ├─ lib/abi/MezherPay.json  copied from contracts/out after deploy
   └─ .env.example
```

## Operations
- Environments: local (anvil fork of Mezo testnet for contract tests; `next dev` against Mezo testnet), Vercel production (Mezo testnet). No staging.
- Configuration (names only): `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL`, `NEXT_PUBLIC_MEZHER_PAY_ADDRESS`, `NEXT_PUBLIC_MEZHER_PAY_DEPLOY_BLOCK`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (only if Passport/RainbowKit requires it — verify during scaffold), `RELAYER_PRIVATE_KEY` (server only). Contracts: deployer key from the Foundry keystore account `mezher-deployer` (never in `.env`).
- Deployment: `forge script script/Deploy.s.sol --rpc-url mezo_testnet --account mezher-deployer --broadcast` (testnet pre-approved), then record the address in `docs/hackathon/DEPLOYMENTS.md` and set `NEXT_PUBLIC_MEZHER_PAY_ADDRESS`. Web: Vercel deploy (owner's OK each time).
- Rollback: the contract is immutable; a bug means deploying a new `MezherPay` and switching the env var (payments are atomic, so no stuck funds). Web: Vercel instant rollback to the previous deployment.
- Logs/monitoring: Vercel function logs for `/api/relay` (no signatures or keys logged); the relayer BTC balance is checked on every request (503 under threshold) and before the demo.
- Scale limits: in-memory rate limit is per serverless instance (acceptable for a demo; noted in SECURITY residual risks). One relayer key → nonces serialize; fine for demo traffic.

## Decisions and unknowns
Confirmed by evidence:
- MUSD has no flashmint; borrow-on-behalf exists via `withdrawMUSDWithSignature` (ECDSA, EIP-712 domain "BorrowerOperationsSignatures" v1, nonce getter `getNonce`). MUSD permit domain "Mezo USD" v1.
- MUSD is minted to `_recipient` on a debt increase (`BorrowerOperations._withdrawMUSD` → `musd.mint(_account, …)`).
- Mezo Pools, Pyth, x402 facilitator, EntryPoint v0.7 exist on testnet (not used by core).
- `IPriceFeed.fetchPrice()` is declared `external view` (checked in `mezo-org/musd` 2026-10-18).
Proposals (owner approval needed): the whole stack above; Vercel hosting; EVM-only payers; ICR floor 150% hard-coded; no on-chain order uniqueness.
Unknowns (owner: builder, resolve in Phase 4 tests):
- Whether `getCurrentICR` includes pending rewards/interest exactly as the post-borrow check needs (fork test asserts behaviour).
- Resolved 2026-10-18: `@mezo-org/passport@0.17.2` `getConfig` types `walletConnectProjectId: string` as required. RainbowKit throws at runtime on an empty id, so web passes `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "mezher-no-walletconnect"`; injected wallets (MetaMask) never use it; WalletConnect QR wallets need a real id from cloud.reown.com (set it before the Vercel deploy).
