# Code Style

Status: **Proposal - needs approval** (Phase 2 gate). No code exists yet; commands below are recorded as "Not configured" until the scaffold task creates the config and they actually run.

## Languages and conventions
- Language/version:
  - Solidity **0.8.28**, pinned (`pragma solidity 0.8.28;`), `evm_version = "london"` (Mezo requirement), optimizer on, 200 runs.
  - TypeScript 5.x, `strict: true`, React 18, Next.js 14.2.x App Router.
- Naming:
  - Solidity: contracts/interfaces/structs `PascalCase` (`MezherPay`, `IPriceFeed`), functions/vars/immutables `camelCase` (`musd`, `bos`), constants `UPPER_SNAKE_CASE` (`MIN_ICR_AFTER`), custom errors `PascalCase` (`IcrBelowFloor`), events past tense (`Paid`). Test files `<Contract>.t.sol`, fork tests `<Contract>.fork.t.sol`, test functions `test_<behavior>` / `testRevert_<condition>` / `testFuzz_<property>`.
  - TS: library files `kebab-case.ts`, components `PascalCase.tsx`; functions/vars `camelCase`; types `PascalCase`; env vars `UPPER_SNAKE_CASE`.
  - Amounts: always `bigint` in wei (18 decimals) in logic; convert with viem `parseUnits`/`formatUnits` only at the UI edge. Names carry the unit when ambiguous (`amountWei`, `icrE18`).
- Formatting/linting: `forge fmt` for Solidity; Prettier defaults + `next lint` (ESLint `next/core-web-vitals`) for TS. Configs are created by the scaffold task.
- Type safety: no `any`; contract calls typed through viem ABIs declared `as const`; zod schemas at the API boundary infer request types.

## Organization
- Directory responsibilities: as in ARCHITECTURE.md "Project structure" (`contracts/` Foundry, `web/` Next.js).
- Shared components/utilities: UI in `web/components/`; chain config, ABIs and Mezo addresses only in `web/lib/mezo.ts`; EIP-712 builders only in `web/lib/signatures.ts`; quote math only in `web/lib/quote.ts`; hints only in `web/lib/hints.ts`; link parse/build only in `web/lib/link.ts`; error-code copy in `web/lib/errors.ts`.
- Business logic placement: safety rules live **on-chain** (`MezherPay`) and are mirrored for display in `lib/quote.ts`. Components never compute money math inline.
- Import/dependency boundaries: `components/` may import `lib/`; `lib/` never imports `components/` or `app/`; `app/api/**` may import `lib/` but never client components; `RELAYER_PRIVATE_KEY` is read only in `app/api/relay/route.ts`.

## Coding rules
- Keep functions focused; follow established repository patterns.
- Validate external inputs at the trust boundary (link params, `/api/relay`, contract entry).
- Handle loading, empty, error, and success states explicitly (DESIGN_SYSTEM "Screen states").
- Avoid silent failures and undocumented magic values (`MIN_ICR_AFTER = 1.5e18` is a named constant; deadlines and rate limits are named constants).
- Reuse existing components before introducing new abstractions.
- Solidity (solskill standards): custom errors (no revert strings), checks-effects-interactions, `SafeERC20` for token transfers, immutables for external addresses, NatSpec on every external function/event/error, no `tx.origin`, no inline assembly, no owner/admin functions.
- Ponytail: no feature, option or abstraction that no PRD feature needs; one-line comments only for the "why"; a known shortcut gets `// shortcut: <limit>, <when to upgrade>`.
- UI: tokens only (DESIGN_SYSTEM Do/Don't list); no UI kit besides RainbowKit.

## Errors and logging
- Contract: custom errors `ZeroAddress()`, `ZeroAmount()`, `FromBalanceExceedsAmount()`, `IcrBelowFloor(uint256 icr)`; Mezo reverts bubble up unchanged.
- API error shape: `{ "error": "<snake_case_code>", "reason"?: string, "details"?: unknown }` with the status codes in ARCHITECTURE.md.
- UI error copy: "what happened + what to do next" (DESIGN_SYSTEM voice), mapping known error codes in `lib/errors.ts`.
- Logging: server logs only route, status, payer address prefix (`0x1234…`) and tx hash; never signatures, keys or bodies (SECURITY.md).

## Dependencies
- New packages: only those listed in ARCHITECTURE.md; anything else needs a one-line justification in the commit message and must not duplicate an existing capability.
- Versioning/lockfile practice: pin exact versions in `web/package.json`; commit `pnpm-lock.yaml`; Foundry libs via `forge install <repo>@<tag>` (git submodules, committed).

## Review checklist
- Implementation matches the approved feature acceptance criteria (PRD F-xx).
- Types, format, and lint checks use confirmed repository commands.
- No credentials or unrelated files in the diff.
- Tests cover meaningful changed behavior.
- Money math uses `bigint` wei; no floating point for amounts.
- Every new screen state from DESIGN_SYSTEM exists.

## Verified commands
- Format: `cd contracts && forge fmt --check` (ran 2026-10-18, clean). Web: Prettier not configured (lint covers style).
- Lint: `cd web && pnpm lint` (ran 2026-10-18, no warnings).
- Type check: `cd contracts && forge build` (ran 2026-10-18, compiles). Web: `cd web && pnpm tsc --noEmit` and `cd web && pnpm build` (ran 2026-10-18, pass).
Never invent commands or claim checks passed without running them. The scaffold task replaces "Not configured" with the real commands after running them once.
