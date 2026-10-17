# Database

**No database.** Status: **Proposal - needs approval** (Phase 2 gate).

Reason: every piece of state Mezher needs already lives on-chain or in the URL. A database would add hosting, migrations, secrets and a privacy surface without serving any PRD feature (F-01..F-07). If a stretch feature needs persistence (S-04 Telegram merchant registry), it gets its own section here before it is built.

## Storage model
- Database/provider: none. Sources of truth:
  1. **Mezo testnet chain**: `Paid` events of `MezherPay`, MUSD balances, Trove state (`TroveManager`), nonces (`MUSD.nonces`, `BorrowerOperationsSignatures.getNonce`).
  2. **Payment link URL** (`/pay?to&amount&order&label`): the order lives only in the link.
  3. **Relayer memory** (`/api/relay`): rate-limit counters and the 10-minute dedupe set. Ephemeral, per serverless instance, lost on cold start (acceptable).
- Ownership model: single-user per wallet. Each payer authorizes only their own funds with their own signatures; merchants are plain addresses.
- Data classification: all on-chain data is **public** by nature (addresses, amounts, order ids). Labels live only in links, which anyone holding the link can read. No personal or sensitive data is collected; the UI tells merchants not to put personal data in labels.

## Entities
| Entity | Purpose | Owner | Retention |
| --- | --- | --- | --- |
| Payment (`Paid` event) | Proof that a merchant was paid, with the balance/borrow split | Payer (initiator) / public chain | Permanent (blockchain) |
| Payment link (URL) | Carries the merchant, amount, order id, label | Merchant | As long as the URL is shared; never stored by Mezher |
| Relay record (memory) | Rate limiting and dedupe | System | ≤ 10 minutes, in memory only |
| Trove (Mezo) | Collateral/debt the payer borrows against | Payer (Mezo protocol) | Mezo protocol rules |

## Schema
- `Paid` event (on-chain, `MezherPay`): `orderId bytes32 indexed`, `payer address indexed`, `merchant address indexed`, `amount uint256` (wei, 18 decimals), `fromBalance uint256`, `borrowed uint256`. Invariant: `amount == fromBalance + borrowed`.
- Payment link query params: `to` (checksummed address, required), `amount` (decimal string, > 0, ≤ 18 decimals, required), `order` (16–64 hex chars, required; converted to `bytes32` as `0x` + hex left-padded with zeros), `label` (UTF-8, ≤ 60 chars, optional).
- Relayer memory (TypeScript `Map`): `rate:<payer|ip> → {count, windowStart}`; `dedupe:<merchant>:<orderId>:<payer> → expiresAt`.

## Relationships
- One merchant has 0..n `Paid` events; one payer has 0..n `Paid` events; one payment link (merchant + order) normally maps to 0..1 `Paid` event (not enforced on-chain, see ARCHITECTURE "orderId is informational").
- Delete/update behaviour: none. On-chain records are immutable; links are not stored.

## Access rules
- Read: anyone can read `Paid` events and balances (public chain). The merchant page shows events for whatever address is entered; this is public data.
- Create: a `Paid` event is created only by a successful `pay()`, which requires the payer's valid EIP-712 signatures for every MUSD moved. The relayer cannot create a payment without them.
- Update/delete: impossible.
- Isolation: enforced by the Mezo contracts' signature checks (borrower = signer, recipient bound in the signature) and the MUSD permit (owner = signer).

## Queries and indexes
- Merchant history: `getLogs({address: MezherPay, event: Paid, args: {merchant}, fromBlock: NEXT_PUBLIC_MEZHER_PAY_DEPLOY_BLOCK})`, newest first, client-side pagination of 20. Uses the indexed `merchant` topic.
- Already-paid check: same query with `args: {merchant, orderId}`.
- Payer receipt: `getTransactionReceipt(hash)` + decode `Paid`.
- Index: event topics (`orderId`, `payer`, `merchant`) are indexed on-chain. If the RPC limits the log range, fall back to chunked queries of 10,000 blocks (verify the limit in Phase 4). An indexer (Goldsky, available on Mezo testnet) is post-hackathon.

## Migrations and seed data
- Migration tool: none (no schema). A new contract version = new address + new deploy block in env vars; old events remain readable at the old address.
- Seed data (demo, synthetic): one demo payer wallet with an open Trove and ~5 MUSD left in its wallet balance; one demo merchant address; 1–2 earlier `Paid` events so `/merchant` is not empty. Recorded in `docs/hackathon/DEPLOYMENTS.md` (addresses only, never keys).
- Rollback/backups: not applicable; the chain is the backup.

## Data validation
- URL params: validated in `web/lib/link.ts` before any chain read → invalid → checkout empty state "This payment link is incomplete".
- Relay input: zod schema at `/api/relay` (addresses, uint strings, hex lengths, `fromBalance ≤ amount`, `amount > 0`, deadlines in the future and ≤ 1 hour ahead) → 400.
- Contract: `ZeroAddress`, `ZeroAmount`, `FromBalanceExceedsAmount`, `IcrBelowFloor` custom errors; Mezo contracts revert on bad signatures, expired deadlines, insufficient collateral and recovery-mode rules.
