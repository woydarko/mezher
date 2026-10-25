# Security

MezherPay is testnet software. It has had an AI-assisted review, an invariant suite and a Slither run; it has **not** had a professional audit. Do not use it with real funds.

## Properties

Enforced by [`MezherPay.sol`](../contracts/src/MezherPay.sol) and checked by the [invariant suite](../contracts/test/MezherPay.invariant.t.sol):

| Property | How |
| --- | --- |
| Borrowed MUSD only reaches the merchant the payer signed for | Mezo's `WithdrawMUSD` signature binds amount, borrower, recipient, nonce and deadline |
| A balance-only payment cannot be redirected | `pay()` requires `msg.sender == payer` when nothing is borrowed (`BalanceOnlyNeedsPayer`) |
| A payment never leaves the Trove under 150% | ICR read from TroveManager at the PriceFeed price after the borrow; below the floor the whole call reverts (`IcrBelowFloor`) |
| All or nothing | One call; any failure reverts both parts |
| No custody | No owner, no upgrades, no balance between calls |
| A front-run permit does not block the payment | `permit` is wrapped in `try/catch`; the transfer then uses the allowance already set |

## Slither

`python -m slither src/MezherPay.sol --filter-paths "lib|test|script"` (Slither 0.11.6, run from `contracts/`): 102 detectors, 2 results.

**1. `arbitrary-send-erc20-permit`: `transferFrom(p.payer, …)` after `permit`.**
Mostly expected: the payer's permit is the authority, and a relayer submits it. The redirect cases are blocked (see Properties) and covered by unit and invariant tests. One narrow case remains, below.

**2. `reentrancy-events`: `Paid` emitted after external calls.**
The only external calls go to MUSD and Mezo's BorrowerOperationsSignatures, TroveManager and PriceFeed, which are fixed at deploy time. MezherPay keeps no state that a reentrant call could corrupt. Accepted.

## Known issue: leftover allowance

The MUSD permit names MezherPay as spender but not the merchant. Normally the permit and the transfer happen in the same call, so no allowance outlives a payment. It can outlive one if someone submits the payer's permit on its own (front-running) and the payment then fails for another reason. Later, whoever holds a new borrow signature from the same payer (the relayer, or the merchant it names) could submit it with a larger `fromBalance`, and the leftover allowance goes to that merchant on top of the payment.

Impact: limited to the leftover amount, and it only reaches a merchant the payer signed a borrow for. It needs a front-run, a failed payment and a later borrow-to-pay from the same payer.

Planned fix (Wave 2, together with the redeploy): a Mezher EIP-712 order signature that binds payer, merchant, amount, `fromBalance` and order id, checked before any transfer. Until then the payer can clear the allowance with `approve(MezherPay, 0)`.
