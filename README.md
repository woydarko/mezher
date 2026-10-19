# Mezher

**Pay with your Bitcoin. Keep your Bitcoin.**

Mezher is a checkout for MUSD on [Mezo](https://mezo.org). A payer with an MUSD Trove pays a merchant in one atomic transaction: whatever their MUSD balance covers is used first, and the rest is **borrowed from their Trove straight to the merchant** with Mezo's `withdrawMUSDWithSignature`. A relayer submits the transaction, so the payer only signs and pays no gas for the borrowed part. Their BTC never leaves the Trove.

Built for the Mezo Buildathon (Wave 1). Network: **Mezo testnet**.

| | |
| --- | --- |
| Live app | Coming soon (deploy pending) |
| MezherPay contract | [`0x80ddA1a82Bb291348d4b5Ef33FAc10819071f58b`](https://explorer.test.mezo.org/address/0x80ddA1a82Bb291348d4b5Ef33FAc10819071f58b?tab=contract) (verified source, deploy block 16241205) |
| Proof, relayed gasless payment | [`0xdb3bc15e…`](https://explorer.test.mezo.org/tx/0xdb3bc15e4e65c0756eb81c49f91ee1490a568d2fbfc2601a9b5b6b86c2607eb5): 11 MUSD fully borrowed from the payer's Trove to the merchant, sent by the relayer |
| Chain | Mezo testnet, chain id 31611, RPC `https://rpc.test.mezo.org`, explorer `https://explorer.test.mezo.org` |

## How a payment works

```
merchant  ──  /merchant: amount + order id  ──►  link  /pay?to=0x…&amount=12&order=…
payer     ──  opens link, sees: 5 MUSD from balance + 7 MUSD borrowed (fee 0.1%), ratio now → after
payer     ──  signs  (1) MUSD permit for the balance part   (2) Mezo WithdrawMUSD for the borrowed part
relayer   ──  MezherPay.pay(payment, permit, borrow)
MezherPay ──  permit + transferFrom(payer → merchant, 5)
          ──  BorrowerOperationsSignatures.withdrawMUSDWithSignature(7, hints, payer, merchant, sig, deadline)
          ──  TroveManager.getCurrentICR(payer) ≥ 150%  or revert IcrBelowFloor   (all-or-nothing)
          ──  emit Paid(orderId, payer, merchant, 12, 5, 7)
merchant  ──  /merchant lists the Paid event; the link now shows "Already paid"
```

What Mezher uses from Mezo:
- **MUSD** (ERC20Permit, domain "Mezo USD" v1) for the balance part.
- **BorrowerOperationsSignatures.withdrawMUSDWithSignature** to borrow on the payer's behalf with the merchant as recipient (EIP-712 `WithdrawMUSD`, nonce + deadline, ECDSA).
- **HintHelpers / SortedTroves** for the Trove re-insertion hints, **TroveManager + PriceFeed** for the ICR check.

Safety rules enforced on-chain by `MezherPay`:
- After borrowing, the payer's Trove must stay at **ICR ≥ 150%** or the whole payment reverts (`IcrBelowFloor`). The UI blocks below 150.5%.
- The merchant is bound by Mezo's borrow signature, so a relayer or a front-runner cannot redirect the money.
- A payment with nothing borrowed must be sent by the payer itself (`BalanceOnlyNeedsPayer`): the MUSD permit names no merchant.
- No owner, no upgradeability, no funds held between calls.

## Integrate MezherPay

Any app or protocol can call `pay` with the payer's two signatures; it does not have to be our relayer.

```solidity
struct Payment   { address payer; address merchant; uint256 amount; uint256 fromBalance; bytes32 orderId; }
struct PermitSig { uint256 deadline; uint8 v; bytes32 r; bytes32 s; }               // ignored when fromBalance == 0
struct BorrowSig { address upperHint; address lowerHint; uint256 deadline; bytes signature; } // ignored when nothing is borrowed

function pay(Payment calldata p, PermitSig calldata permit, BorrowSig calldata borrow) external;
event Paid(bytes32 indexed orderId, address indexed payer, address indexed merchant,
           uint256 amount, uint256 fromBalance, uint256 borrowed);
```

The typed data builders, hint lookup and quote math are in [`web/lib/signatures.ts`](web/lib/signatures.ts), [`web/lib/hints.ts`](web/lib/hints.ts) and [`web/lib/quote.ts`](web/lib/quote.ts); the ABI is [`web/lib/abi/MezherPay.ts`](web/lib/abi/MezherPay.ts).

## Run it locally

Requirements: Node.js, pnpm, [Foundry](https://book.getfoundry.sh/).

```bash
cd web && pnpm install
cp .env.example .env.local      # set NEXT_PUBLIC_MEZHER_PAY_ADDRESS, NEXT_PUBLIC_MEZHER_PAY_DEPLOY_BLOCK, and (server only) RELAYER_PRIVATE_KEY
pnpm dev                        # http://localhost:3000
```

To pay you need a wallet on Mezo testnet with an MUSD Trove: get test BTC from the [faucet](https://faucet.test.mezo.org) and open a Trove at [testnet.mezo.org](https://testnet.mezo.org). The relayer key only lives in the server environment and pays gas in test BTC.

## Tests

```bash
cd contracts && forge test --match-contract MezherPayTest                                     # 17 unit tests
cd contracts && MEZO_TESTNET_RPC_URL=https://rpc.test.mezo.org forge test --match-path test/MezherPay.fork.t.sol   # 4 fork tests against the real Mezo contracts
cd web && pnpm vitest run                                                                     # 68 tests: link parsing, quote/ICR, signatures, hints, relay, checkout, logs
cd web && pnpm build
```

The fork tests open a real Trove on a fork of Mezo testnet and run the 5 + 7 split, a replayed signature, the ICR floor and a redirect attempt. Mezo's price oracle is a native precompile that does not exist in Foundry's EVM, so `PriceFeed.fetchPrice()` is mocked at the live price in those tests; every other contract is the real one.

## Repository

| Path | What |
| --- | --- |
| `contracts/src/MezherPay.sol` | the only product contract |
| `contracts/test/` | unit tests (mocks) and fork tests (real Mezo testnet) |
| `web/app/` | Next.js 14 app: `/` landing, `/pay` checkout, `/merchant` links + payments, `/terms`, `/api/relay` |
| `web/lib/` | link parsing, quote, signatures, hints, relay handler, Paid log reader (all unit tested) |
| `docs/` | PRD, architecture, security, design system, testing, deployments |

Stack: Solidity 0.8.28 (EVM london) + Foundry + OpenZeppelin 5; Next.js 14, React 18, viem, wagmi, RainbowKit with Mezo Passport; vitest.

## Status and limits

- Testnet only. MezherPay has had an AI-assisted security review, not a professional audit.
- The payer needs an existing Trove; opening one from inside Mezher is next.
- The relay keeps its rate limit in memory per server instance.
- Unpaid orders exist only inside their link; there is no database.

Security notes and known risks: [`docs/SECURITY.md`](docs/SECURITY.md), [`docs/hackathon/DEPLOYMENTS.md`](docs/hackathon/DEPLOYMENTS.md).
