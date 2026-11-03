import { MIN_SPONSORED_WEI } from "./mezo";

const ONE = 10n ** 18n;

export type TryScenario = { kind: "open" | "balance" | "split" | "borrow"; title: string; amount: string; text: string };

/**
 * Which payment to try, from the wallet's state. A fixed 12 MUSD could never borrow right after
 * open-and-pay (the wallet then holds ~1788 MUSD), so the amount follows the balance.
 */
export function tryScenario(hasTrove: boolean, balanceWei: bigint): TryScenario {
  if (!hasTrove)
    return { kind: "open", title: "Open a Trove and pay", amount: "12", text: "You have no Trove yet. Checkout opens one from your test BTC and pays 12 MUSD in one go." };
  if (balanceWei >= 12n * ONE)
    return { kind: "balance", title: "Pay from balance", amount: "12", text: "Your MUSD balance covers 12 MUSD, so nothing is borrowed." };
  if (balanceWei > 0n) {
    const amount = ((balanceWei + ONE - 1n) / ONE + 5n).toString();
    return { kind: "split", title: "Part balance, part borrowed", amount, text: `Pays ${amount} MUSD: your balance first, the rest borrowed from your Trove.` };
  }
  return { kind: "borrow", title: "Fully borrowed", amount: "12", text: "Your balance is empty, so all 12 MUSD is borrowed from your Trove straight to the merchant." };
}

/** Payments under this pay their own gas; the relayer only sponsors larger ones. */
export const sponsored = (amount: string) => BigInt(amount) * ONE >= MIN_SPONSORED_WEI;
