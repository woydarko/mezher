# Deployments

Judges and teammates read this to reproduce the on-chain demo. Testnet only unless the user explicitly approved mainnet. Never put private keys or seed phrases here.

## Network
| Field | Value |
| --- | --- |
| Chain / ecosystem | Mezo Testnet (EVM, Cosmos SDK + CometBFT, gas = BTC) |
| Chain ID / cluster | 31611 (CAIP-2 `eip155:31611`) |
| RPC URL (public) | https://rpc.test.mezo.org (WSS wss://rpc-ws.test.mezo.org) |
| Fallback RPC | None public for testnet (mainnet providers: Boar, Imperator, Validation Cloud, dRPC); fallback = recorded demo video |
| Block explorer | https://explorer.test.mezo.org |
| Faucet | https://faucet.test.mezo.org (CAPTCHA, test BTC + MEZO). MUSD: borrow against test BTC or swap BTC→MUSD at https://testnet.mezo.org |

## Contracts / programs
Mezo contracts we integrate with (deployed by Mezo, from `mezo-org/musd` `solidity/artifacts/deployments/matsnet/`):
| Name | Address | Notes |
| --- | --- | --- |
| MUSD | 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 | ERC20Permit, domain "Mezo USD" v1 |
| BorrowerOperationsSignatures | 0xD757e3646AF370b15f32EB557F0F8380Df7D639e | EIP-712 domain "BorrowerOperationsSignatures" v1 |
| BorrowerOperations | 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5 | minNetDebt 1,800 MUSD; fee 0.1% (read on-chain 2026-10-18) |
| TroveManager | 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0 | gas compensation 200 MUSD |
| PriceFeed | 0x86bCF0841622a5dAC14A313a15f96A95421b9366 | — |
| HintHelpers | 0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6 | — |
| SortedTroves | 0x722E4D24FD6Ff8b0AC679450F3D91294607268fA | — |

Our contracts:
| Name | Address / program ID | Deploy tx | Verified on explorer | Source path |
| --- | --- | --- | --- | --- |
| MezherPay | [0xDF0ddaF1dA4e81f6E55284Ed8EBf58469EC219c2](https://explorer.test.mezo.org/address/0xDF0ddaF1dA4e81f6E55284Ed8EBf58469EC219c2) (deploy block 16228993, 2026-10-18) | [0xa5621587…e5f4](https://explorer.test.mezo.org/tx/0xa562158792e47ecfa5095b501c1c9f5287f5bddce6a313db00f184d5934ee5f4) | Yes, Blockscout 2026-10-18 ([source](https://explorer.test.mezo.org/address/0xDF0ddaF1dA4e81f6E55284Ed8EBf58469EC219c2?tab=contract)) | contracts/src/MezherPay.sol (solc 0.8.28, london, optimizer 200) |

## Roles and keys (names only)
| Role | Address | Key storage |
| --- | --- | --- |
| Deployer | 0xf5C402e9eAf95f2d3f84Ed02bE7A453cc65A68Fb | Foundry encrypted keystore account `mezher-deployer` (burner). Its key was pasted in a chat session on 2026-10-18: treat as exposed, rotate before submission; it holds no role in MezherPay (no owner) |
| Admin / owner | None — `MezherPay` has no owner or admin functions | n/a |
| Relayer | TBD | Vercel server env `RELAYER_PRIVATE_KEY` (burner, ≤ 0.01 test BTC float) |
| Demo payer wallet | 0xe8167000c65634db91131c73c4221b361053786e (2026-10-19: Trove active, coll 0.05 BTC, debt 2,001.8 MUSD, ICR 202%, wallet 5 MUSD) | MetaMask on the demo laptop |
| Demo merchant wallet | 0x8a61973a5a76e598955a52210d34fbddc2aeaca6 (fresh, 0 MUSD on 2026-10-19) | Second browser profile |

## Demo state
- Pre-funded wallets: TBD — record test BTC / MUSD balances and the demo payer's Trove (collateral, debt, ICR) within the last hour before recording and submitting.
- Seed data already on-chain: TBD — demo payer Trove open with debt ≥ 2,000 MUSD and ICR ≥ 200%; wallet balance reduced to ~5 MUSD; 1–2 earlier `Paid` events for the demo merchant.
- Reference transactions for the demo script: TBD (tx hash links in click order).
- Fallback if RPC or chain is down: recorded 2-minute demo video + screenshots of each step; labeled as a recording.

## Frontend config
- Env var names (not values): `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL`, `NEXT_PUBLIC_MEZHER_PAY_ADDRESS`, `NEXT_PUBLIC_MEZHER_PAY_DEPLOY_BLOCK`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (if required), `RELAYER_PRIVATE_KEY` (server only).
- Network switch / add-network prompt tested with a fresh wallet: No (not built yet).
- ABI committed at: `web/lib/abi/MezherPay.ts` (typed `as const`, generated from `contracts/out/MezherPay.sol/MezherPay.json`).

## Known risks (honest list)
- Testnet only; AI-assisted audit only (x-ray / solidity-auditor), not a professional audit.
- ICR guard bypassable by submitting the raw Mezo borrow signature directly (funds still only reach the signed merchant; Mezo MCR still applies).
- Single relayer key with a small gas float; in-memory rate limit per serverless instance.
- Mezo MUSD contracts are upgradeable by Mezo; behaviour could change.
- Payers must use EVM (ECDSA) wallets; Mezo Passport BTC-wallet accounts cannot sign the required messages (pending owner decision).
