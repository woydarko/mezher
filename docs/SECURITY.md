# Security

**Testnet only. One AI agent did a manual review, plus a Slither run; this is not a professional audit.** The multi-agent passes of the audit skill did not run. Do not use MezherPay with real funds.

The review covers `MezherPay` v2 and the relay, activation and faucet routes. It read Mezo's `MUSD`, `BorrowerOperations` and `BorrowerOperationsSignatures` from the [`mezo-org/musd`](https://github.com/mezo-org/musd/tree/main/solidity/contracts) `main` branch, which was not compared to the deployed bytecode. The fork tests cover the paths they exercise on the deployed contracts. A borrow signature used alone, a permit used alone, an expired signature, a tampered debt, an active Trove and a value mismatch run only against the mock.

## Properties

Enforced by [`MezherPay.sol`](../contracts/src/MezherPay.sol) and checked by the [unit](../contracts/test/MezherPay.t.sol) and [invariant](../contracts/test/MezherPay.invariant.t.sol) tests:

| Property | How |
| --- | --- |
| Money moves only as the payer signed | Every move through MezherPay needs an EIP-712 `Order` binding payer, merchant, amount, split, ratio floor, order id and deadline (`BadOrderSignature`); a Mezo signature used on its own skips it, see Known limits |
| An order settles once | `settled[keccak256(payer, merchant, orderId)]` is set before any external call (`OrderAlreadySettled`) |
| An order does not work on another chain or deployment | The domain binds chain id and contract address. Mezo's and MUSD's domains bind their chain and their nonces stop replay; a Mezo signature names no MezherPay deployment |
| Borrowed MUSD only reaches the merchant the payer signed for | Mezo's `WithdrawMUSD` signature binds amount, borrower, recipient, nonce and deadline |
| A payment through MezherPay never leaves the Trove under the order's floor | `minIcrAfter` is at least 150% (`MinIcrBelowFloor`); ICR is read after the move and a lower value reverts everything (`IcrBelowFloor`). A borrow signature used on its own skips this, see Known limits |
| The merchant fee is at most 1% of what the same call delivered | The fee is `amount * feeBps / 10000`, `feeBps <= 100`, pulled after delivery |
| All or nothing | One call; any failure reverts every part and returns the BTC |
| No custody | No owner, no upgrades, no `receive`. Borrowed MUSD goes straight to the merchant, BTC straight into the Trove, balance MUSD from payer to merchant |
| A front-run permit does not block the payment | `permit` is wrapped in `try/catch`; the transfer then uses the allowance already set |

## Findings

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1 | After a used borrow signature, the checkout said "Press Pay again". The shop already had the borrowed part, so a retry paid it twice | Medium | Fixed in the checkout copy only: `5c1b4a8` for a failed simulation, `ffa4876` for a mined revert, the path a mempool front-run takes, which said "Nothing changed". Both now say to check first, and a mined revert links the wallet on the explorer. Tests: `maps BorrowerOperationsSignatures: Invalid signature`, `a mined revert tells the payer to check before paying again, since a front-run borrow reverts this way`. The page wiring was not run in a browser. The chain side stays a known limit |
| 2 | Relay, activation and faucet routes read the whole body into memory before checking its size | Low | Fixed in `220c986`. Test: `stops reading a body without content-length once it is over the limit` |
| 3 | Rate limits took the first `x-forwarded-for` hop, which the client controls behind an appending proxy | Low | Fixed in `220c986` (last hop). Test: `does not let a client pick its rate-limit IP with an extra x-forwarded-for hop` |
| 4 | Six bad requests naming a victim locked that payer or merchant out of the relay for a minute, since the limit counted before any signature check | Low | Fixed in `220c986` (counted after simulation). Tests: `does not let requests with bad signatures lock a payer out`, `... lock a merchant out` |
| 5 | Two parallel copies of one order both passed the dedupe check, so the relayer sent a transaction bound to revert | Low | Fixed in `220c986` (reserved before any await). Test: `sends once when the same order arrives twice at the same time` |
| 6 | Parallel faucet requests from one IP each passed the one-claim-per-day check | Low | Fixed in `220c986`. Test: `keeps the one claim per IP when requests arrive at the same time` |
| 7 | A borrow signature works alone, without fee, `Paid` or the floor | Medium, by design | Accepted, see Known limits. Test: `test_borrowSigAlone_deliversWithoutFeeOrSettlement` |
| 8 | A merchant can avoid the fee on the borrowed part by submitting the borrow signature itself | Low | Accepted: routing the borrow through the contract lets anyone strand the MUSD there, which is worse. The merchant still receives only what the payer signed |
| 9 | A payment that reverts leaves its signatures public and unspent until their deadline, and an order cannot be cancelled | Low | Accepted: they can only execute as signed. The checkout signs for 15 minutes and the relay refuses more than 1 hour. A payer can end them early only by spending the nonces: any Mezo signed action for a borrow signature; submitting the permit, then `approve(MezherPay, 0)`, for the balance part |
| 10 | Anyone can send a payment to any merchant: `Paid` is not merchant-approved, and the order id is unique only per (payer, merchant) | Low | Accepted: the merchant only gains. An integrator must compare `amount` and not trust an order id alone. `/proof` and dashboard totals count such payments, including self-payments that cost only the fee and gas |
| 11 | Burning a merchant's fee allowance to block its payments costs the attacker 200 times the allowance at 50 bps, all delivered to that merchant | Info | Accepted |
| 12 | A permit overwrites allowance, so a merchant paying more than its fee budget from balance loses that budget, as does a stale unspent permit submitted later | Low | Accepted: only a re-activation is lost. The checkout skips the permit when the allowance already covers the payment (`permitPlan`) |
| 13 | Trove hints are not signed, so a submitter or relay caller can choose them, which can raise the gas of a payment | Low | Accepted. From Mezo's source, the signature excludes hints and they are passed on to the Trove list; `SortedTroves` itself was not read and bad hints were not tested, because the mock ignores them. The gas figures behind sponsorship are in [BUSINESS.md](BUSINESS.md) |
| 14 | A payer can make a simulated relay transaction revert by moving first, costing the relayer gas | Low | Accepted: the attacker pays gas too, and the limits apply per payer and IP |
| 15 | A treasury set to the MUSD address would revert every fee, as MUSD refuses transfers to itself | Info | Accepted: deploy-time mistake, seen on the first payment, fixed by redeploying |

Checked with no finding:

- **Merchant allowance:** an order naming a merchant as payer needs that merchant's signature (`test_feeAllowance_notSpendableAsPayerWithoutMerchantSignature`); an unasked payment leaves it better off and spends only the fee (`test_feeAllowance_unaskedOrderNeverCostsMerchant_fuzz`).
- **`openAndPay` BTC:** wrong value, expired signature, tampered debt, active Trove and an order already settled through `pay` all revert, and a revert returns the BTC (`test_openAndPay_revertsOnExpiredOpenSig`, `test_openAndPay_revertsOnTamperedDebt`, `test_openAndPay_revertsWhenPayerHasActiveTrove`, `test_openAndPay_revertsAfterSameOrderSettledByPay`, `test_openAndPay_revertsWhenValueDiffersFromSigned`, all against the mock). The contract ends with no BTC (`invariant_holdsNoFunds`). From its source, Mezo puts all of `msg.value` into the Trove and sends nothing back. A third party opening the Trove from the signature pays the collateral itself, which stays the payer's (`test_openTroveSigAlone_observerGiftsTheCollateral`).
- **Reentrancy:** MUSD is OpenZeppelin `ERC20Permit` with no hooks, and only refuses transfers to zero and to itself. Mezo's open and borrow paths make no call to MezherPay, the merchant or the payer. `settled` is written before any external call anyway.
- **Logging:** routes log route, status, payer prefix, hash and a short error, never bodies or signatures. Validation errors return field paths and messages, not values.

## Known limits

- **A front-run borrow delivers money without a fee or `Paid` event.** Anyone who sees a `WithdrawMUSD` signature can submit it straight to Mezo. The money reaches only the signed merchant and only the signed amount, but MezherPay collects no fee, emits no `Paid` and does not check the payer's floor, so only Mezo's own rules apply (110%, and its Recovery Mode rules). The `pay` then reverts and its balance part does not move. The order stays open, so paying again would pay the borrowed part twice. An `OpenTrove` signature used on its own also skips the order, but the submitter must supply the collateral, which stays the payer's (`test_openTroveSigAlone_observerGiftsTheCollateral`).
- **EOA signers only.** All three signatures are ECDSA with no ERC-1271. An EIP-7702 delegated EOA works; the checkout sends deployed smart accounts to an EVM wallet. Bitcoin wallets (Unisat, OKX, Xverse through OrangeKit) cannot pay: OrangeKit's `signTypedData` throws "Unsupported method", and a fresh one is an undeployed account, so the smart-account check alone does not catch it. `/pay`, `/try` and `/merchant` check the connector type `orangekit` and say to use an EVM wallet such as MetaMask. They stay in the connect list.
- **Rate limits live in memory per server instance.** A cold start or a second instance resets them, entries are not evicted until the instance ends, and on a server with no proxy in front `x-forwarded-for` is still the client's to set. [Vercel's docs](https://vercel.com/docs/headers/request-headers#x-forwarded-for) say it overwrites the header; this was not tested on the live deployment. Anyone with many IPs can use up the faucet's hourly cap and block other claims until it resets.
- **A relay request can get a passing `already_relayed` 409.** While one request for an order is simulating, a second for the same order gets the 409, even if the first then fails and the order was never sent. Sending it again after that works.
- **An order does not commit to an entry point.** An order signed for `openAndPay` can settle through `pay` if the payer already holds the MUSD and the permit is valid. The merchant is paid as signed and `openAndPay` reverts with the BTC returned (`test_openAndPay_revertsAfterSameOrderSettledByPay`).
- **Mezo is trusted.** MezherPay's Mezo addresses are immutable, but those contracts are upgradeable by Mezo governance, and a change there could break these conclusions.

## Slither

`slither . --filter-paths "lib|test|script"` (run from `contracts/`): 102 detectors, 6 results, none needing a code change.

| Detector | Where | Disposition |
| --- | --- | --- |
| `arbitrary-send-erc20` | `_collectFee` pulls from `o.merchant` | Accepted: intended fee pull, see findings 10 and 11 and the allowance check above |
| `arbitrary-send-erc20-permit` | `_takeBalance` pulls from `o.payer` | Accepted: `o.payer` signed the order, checked first |
| `unused-return` | `tryRecover`'s third value | Accepted: the error code and signer are checked; the third value only adds detail about the error |
| `reentrancy-events` (2) | `Paid`, `OpenedAtCheckout` after external calls | Accepted: fixed Mezo and MUSD targets, no callback, `settled` already written |
| `timestamp` | `block.timestamp > o.deadline` | Accepted: deadlines are minutes long, so a validator's small drift does not matter |
