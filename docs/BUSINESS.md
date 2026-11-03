# Mezher fee model

Mezher charges the merchant 50 basis points (0.5%) per payment. This page prices that fee against the gas the relayer pays, using measured numbers. Everything labelled "estimate" is a projection, not a result.

## What the fee is and who pays it

- The fee is 0.5% of the payment amount, set on-chain (`feeBps`) and read with `feeOf(amount)`.
- The merchant pays it, not the customer. The customer pays the full amount; the merchant receives the amount minus the fee. On a 12 MUSD order the fee is 0.06 MUSD and the merchant receives 11.94 MUSD. `/merchant` shows both numbers.
- The merchant allows the fee once with a signed permit ("Activate payments"). The contract then pulls the fee from the merchant's MUSD after each payment. The merchant needs no BTC for gas.
- For payments of at least `MIN_SPONSORED_WEI` (16 MUSD) the relayer pays the gas for `pay`. Below that, the payer pays their own gas and the merchant still pays the fee. A payment that opens a Trove (`openAndPay`) is never sponsored: the payer pays the gas.

## Cost per payment

Gas measured on a Mezo testnet fork. These runs used `address(0)` for the sorted-list hints, which makes gas higher than a real hinted call, so the `pay` numbers are a conservative estimate. Each rests on one fork run.

Reproduce the fork figures (needs Foundry; the run forks testnet and takes about a minute):

```
cd contracts
MEZO_TESTNET_RPC_URL=https://rpc.test.mezo.org forge test --match-path test/MezherPay.fork.t.sol --match-test test_fork_split_5plus7 --gas-report
```

Read the `pay` row. Without `--match-test` the `pay` row also counts reverting tests and is not usable. A rerun on 2026-11-03 gave 719,712 for the split case, against the 679,312 used below: fork gas moves with chain state. At 719,712 gas the break-even is about $16.10, which would round up to 17 MUSD.

| Call | Gas | Case |
|---|---|---|
| `openAndPay` | 986,926 | 0.1 BTC, 2,000 MUSD Trove, 12 MUSD paid. Payer pays the gas. |
| `pay`, split | 679,312 | 5 MUSD from balance and 7 MUSD borrowed. Used for the fee model. |
| `pay`, borrow only | 657,095 | Whole amount borrowed. |
| `pay`, live v1 with real hints | 430,852 | Live testnet tx [`0x51e6aaf5e6795cb9804735c9bfbfa44567aa93566e48a8847f29594bb9527dd0`](https://explorer.test.mezo.org/tx/0x51e6aaf5e6795cb9804735c9bfbfa44567aa93566e48a8847f29594bb9527dd0) (v1 contract). |

Measured on the live v2 contract (testnet, real hints, team wallets, gas from the receipts via `eth_getTransactionReceipt`):

| Call | Gas | Case |
|---|---|---|
| `openAndPay` | 770,738 | [`0xbd5855f0…`](https://explorer.test.mezo.org/tx/0xbd5855f0d7c0a322c584597f81296e0be3a56c434c50c378879ef6b17336dfd0): 1,800 MUSD Trove, 20 MUSD paid. Payer paid the gas. |
| `pay`, split, relayer | 501,364 | [`0x82dc5bd3…`](https://explorer.test.mezo.org/tx/0x82dc5bd34e8a0b0a28aef153dc254d734293ede829c061ced1310904847c831d): 1,785 MUSD, 1,780 from balance and 5 borrowed, fee 8.925. |
| `pay`, borrow only, relayer | 462,947 | [`0xbb14adf9…`](https://explorer.test.mezo.org/tx/0xbb14adf9d23f25d1bf5b1b9d9d1fb816c1d1a42bd2ae51b96efd090a6a77518c): 20 MUSD borrowed, fee 0.1. |
| `pay`, balance only, relayer | 104,605 | [`0x0b1cbd3b…`](https://explorer.test.mezo.org/tx/0x0b1cbd3b070911af42a36f4a45a9336cb11d3163186f134239ef769045fb9948): 20 MUSD, fee 0.1. A self-payment by the demo merchant wallet. |

Each live figure rests on one transaction. The real-hints split costs 26% less gas than the fork run (501,364 against 679,312), so the fork figures above are conservative.

Price inputs come from Mezo mainnet and move all the time. Rerun them:

```
cd web
node scripts/pay-cost.mjs            # default: 679,312 gas
node scripts/pay-cost.mjs 430852     # any other gas figure
```

The script reads the mainnet gas price (`eth_gasPrice`) and the BTC price from the PriceFeed `0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88` `fetchPrice()` over `https://mainnet.mezo.public.validationcloud.io`. It is read-only and needs no key. Run on 2026-11-03:

- Gas price 1,462,500 wei (BTC is the gas token), BTC about $76,507.
- `pay` at 679,312 gas: 993,493,800,000 wei, about $0.0760.
- `pay` at 430,852 gas (real hints): about $0.0482.
- `openAndPay` at 986,926 gas: about $0.1104, paid by the payer.

At the same gas price and BTC price ($76,507), the live v2 figures cost: split `pay` 501,364 gas about $0.0561; borrow-only `pay` 462,947 gas about $0.0518; balance-only `pay` 104,605 gas about $0.0117; `openAndPay` 770,738 gas about $0.0862, paid by the payer. These are computed from the numbers above, not re-read; `node scripts/pay-cost.mjs 501364` on 2026-11-03 later gave $0.0567 at BTC $77,270.

## Break-even size

A payment covers its own gas when 0.5% of it is at least the gas cost. With the conservative fork figure: $0.0760 / 0.005 = $15.20, which rounds up to 16 MUSD, the value of `MIN_SPONSORED_WEI` in `web/lib/mezo.ts`.

With the real-hints measurements on live v2:

| `pay` case | Gas | Cost at the prices above | Break-even | Rounded up |
|---|---|---|---|---|
| Split (501,364) | 501,364 | about $0.0561 | about $11.2 | 12 MUSD |
| Borrow only (462,947) | 462,947 | about $0.0518 | about $10.4 | 11 MUSD |
| Balance only (104,605) | 104,605 | about $0.0117 | about $2.3 | 3 MUSD |

So the 16 MUSD floor is conservative: real hints would cover the gas of a split payment from about 12 MUSD. **`MIN_SPONSORED_WEI` stays 16 MUSD.** Reasons: each live figure is one transaction, the mainnet gas price and BTC price move, and gas also depends on the hints and the Trove list, which the relay chooses at send time. The mainnet gas price is the input most likely to move, so rerun `pay-cost.mjs` before changing the constant.

## Scenarios (all estimates)

Assumptions, not measurements: every payment is sponsored `pay` at 679,312 gas and $0.0760; the average payment and monthly volume are guesses; hosting is a flat assumed cost per month. No merchant has agreed to any of this.

| Scenario (estimate) | Payments / month | Avg payment (MUSD) | Volume (MUSD) | Fee revenue (USD) | Relayer gas (USD) | Hosting (USD, assumed) | Net (USD) | Break-even size (MUSD) |
|---|---|---|---|---|---|---|---|---|
| Pilot | 200 | 20 MUSD | 4,000 MUSD | 20.00 | 15.20 | 20 | -15.20 | 16 |
| Early mainnet | 2,000 | 50 MUSD | 100,000 MUSD | 500.00 | 152.00 | 20 | 328.00 | 16 |
| Growth | 20,000 | 50 MUSD | 1,000,000 MUSD | 5,000.00 | 1,520.00 | 100 | 3,380.00 | 16 |

MUSD treated as $1. Break-even size is per payment (gas only, see above). Each payment nets fee minus gas: 0.024 at 20 MUSD, 0.174 at 50 MUSD. To cover a 20 per month host, that takes roughly 830 payments a month at 20 MUSD, or 115 at 50 MUSD. The pilot row loses money.

## Limits

- Testnet only. Nothing here has run on mainnet.
- No revenue yet, and no merchant has accepted this pricing.
- A Trove needs 2,000 MUSD total debt. A payer without a Trove cannot borrow 12 MUSD for coffee. Mezher is therefore positioned as a credit line: open a Trove once, then spend the MUSD over later payments, borrowing only the gap each time.
- The payer carries the Trove's interest and the redemption risk. The fee model does not change that.
- At low volume the fee does not cover hosting (see the pilot row). Until volume is higher, the operator pays the difference.
- The merchant must activate with a permit before it can be charged. Without it, payments to that merchant do not go through.
- A front-run borrow can deliver the money without the fee being charged.
- Gas cost scales with the mainnet gas price and the BTC price. A rise in either raises the break-even size.
