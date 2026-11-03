import { MIN_SPONSORED_WEI } from "./mezo";

const ONE = 10n ** 18n;

export type TryScenario = { kind: "open" | "balance" | "split" | "borrow"; title: string; amount: string; text: string };

const PAY = 20n;
const AMOUNT = PAY.toString();

/**
 * Which payments to offer, from the wallet's state. 20 MUSD is above the sponsored minimum, so the gasless path shows.
 * A fixed amount could never borrow right after open-and-pay (the wallet then holds ~1788 MUSD), so a Trove with a
 * balance also gets a split sized from the balance.
 */
export function tryScenarios(troveStatus: number, balanceWei: bigint): TryScenario[] {
  const hasTrove = troveStatus === 1;
  const balance: TryScenario = { kind: "balance", title: "Pay from balance", amount: AMOUNT, text: `Your MUSD balance covers ${AMOUNT} MUSD, so nothing is borrowed.` };
  const splitAmount = ((balanceWei + ONE - 1n) / ONE + 5n).toString();
  const split: TryScenario = { kind: "split", title: "Part balance, part borrowed", amount: splitAmount, text: `Pays ${splitAmount} MUSD: your balance first, the rest borrowed from your Trove.` };
  if (!hasTrove) {
    if (balanceWei >= PAY * ONE) return [balance];
    return [{ kind: "open", title: "Open a Trove and pay", amount: AMOUNT, text: `${troveStatus === 0 ? "You have no Trove yet." : "Your last Trove is closed."} Checkout opens one from your test BTC and pays ${AMOUNT} MUSD in one go.` }];
  }
  if (balanceWei >= PAY * ONE) return [balance, split];
  if (balanceWei > 0n) return [split];
  return [{ kind: "borrow", title: "Fully borrowed", amount: AMOUNT, text: `Your balance is empty, so all ${AMOUNT} MUSD is borrowed from your Trove straight to the merchant.` }];
}

/** A self-payment by the demo merchant proves nothing and only loses the fee, so /try does not offer it. */
export const isDemoMerchant = (address: string | undefined, demo: string | undefined) =>
  Boolean(address && demo && address.toLowerCase() === demo.toLowerCase());

/** A fully borrowed payment needs an empty balance, which a wallet with MUSD cannot show. */
export function tryNote(troveStatus: number, balanceWei: bigint): string | undefined {
  return troveStatus === 1 && balanceWei > 0n ? "A fully borrowed payment needs an empty balance, so send your MUSD to another wallet first." : undefined;
}

/** Payments under this pay their own gas; the relayer only sponsors larger ones. */
export const sponsored = (amount: string) => BigInt(amount) * ONE >= MIN_SPONSORED_WEI;
