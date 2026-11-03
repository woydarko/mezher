"use client";

import { useState } from "react";
import { parseUnits, type Address } from "viem";
import { useBalance, useReadContract } from "wagmi";
import { formatMusd, formatRatio } from "@/lib/format";
import { ADDRESSES, MEZO_TESTNET, borrowerOperationsAbi } from "@/lib/mezo";
import { MIN_NET_DEBT_WEI, openTroveQuote, roundUpCents, suggestedCollWei } from "@/lib/trove";
import { Card } from "./Card";
import { Field } from "./Field";
import { PrimaryButton } from "./PrimaryButton";
import { ReceiptLine } from "./ReceiptLine";
import { SecondaryButton } from "./SecondaryButton";
import { StatusLine } from "./StatusLine";

const DECIMAL_RE = /^\d+(\.\d{1,18})?$/;
const OPEN_ON_MEZO = "https://testnet.mezo.org";

const toWei = (s: string) => (DECIMAL_RE.test(s) ? parseUnits(s, 18) : null);
/** Rounded up to 4 decimals so the suggestion never lands under its own ratio. */
const btcUp = (wei: bigint) => {
  const step = 10n ** 14n;
  return formatMusd(((wei + step - 1n) / step) * step, 4).replace(/,/g, "");
};

export type OpenRequest = { collWei: bigint; debtWei: bigint; totalDebtWei: bigint };

/**
 * Collects the Trove terms when the payer has none; the checkout then signs the order, the permit and Mezo's
 * OpenTrove message and the payer sends one `openAndPay` with the BTC as msg.value (a relayer cannot lock
 * someone else's BTC). `busyLabel` carries the "Step n of m" text while signing.
 */
export function OpenTroveCard({
  payer,
  shortfallWei,
  priceE18,
  busy,
  busyLabel,
  error,
  onOpen,
}: {
  payer: Address;
  shortfallWei: bigint;
  priceE18: bigint;
  busy: boolean;
  busyLabel: string;
  error?: string;
  onOpen: (a: OpenRequest) => void;
}) {
  const btc = useBalance({ address: payer, chainId: MEZO_TESTNET.id });

  // Rounded up to the 2 decimals the field shows, so the pre-filled borrow always covers the shortfall.
  const needWei = roundUpCents(shortfallWei);
  const firstDebt = needWei > MIN_NET_DEBT_WEI ? needWei : MIN_NET_DEBT_WEI;
  const [debt, setDebt] = useState(() => formatMusd(firstDebt, 2).replace(/,/g, ""));
  const [coll, setColl] = useState(() => btcUp(suggestedCollWei(firstDebt, priceE18)));

  const debtWei = toWei(debt);
  const collWei = toWei(coll);
  const fee = useReadContract({
    chainId: MEZO_TESTNET.id,
    address: ADDRESSES.borrowerOperations,
    abi: borrowerOperationsAbi,
    functionName: "getBorrowingFee",
    args: [debtWei ?? 0n],
    query: { enabled: debtWei !== null },
  });

  const q =
    debtWei !== null && collWei !== null && fee.data !== undefined && btc.data
      ? openTroveQuote({ collWei, debtWei, feeWei: fee.data, priceE18, btcBalanceWei: btc.data.value })
      : null;

  let blocker: string | undefined;
  if (debtWei === null || collWei === null) blocker = "Enter amounts as plain numbers, like 1800 or 0.05.";
  else if (debtWei < shortfallWei) blocker = "Borrow at least " + formatMusd(needWei) + " MUSD to cover this payment.";
  else if (q?.state === "debt_too_small") blocker = "Mezo's minimum borrow is 1,800 MUSD.";
  else if (q?.state === "not_enough_btc")
    blocker = "You can lock at most " + formatMusd(q.maxCollWei, 4) + " BTC and keep enough for the network fee.";
  else if (q?.state === "ratio_too_low")
    blocker = "Lock at least " + btcUp(q.minCollWei) + " BTC so the Trove starts above the 150% safe line.";

  return (
    <Card title="Your Bitcoin credit">
      <p>
        Your MUSD balance is {formatMusd(shortfallWei)} MUSD short and you have no Trove yet. Open one here: lock BTC,
        borrow MUSD, and pay, all in one transaction. You sign three messages first, then pay the network fee in BTC.
      </p>
      <Field
        label="BTC to lock"
        value={coll}
        onChange={(e) => setColl(e.target.value.trim())}
        inputMode="decimal"
        helper={btc.data ? "In your wallet: " + formatMusd(btc.data.value, 4) + " BTC" : undefined}
      />
      <Field
        label="MUSD to borrow"
        value={debt}
        onChange={(e) => setDebt(e.target.value.trim())}
        inputMode="decimal"
        helper="At least 1,800 MUSD. It lands in your wallet."
      />
      {q?.state === "ok" && (
        <>
          <ReceiptLine
            label="Trove debt"
            value={formatMusd(q.totalDebtWei) + " MUSD"}
            sub={"incl. fee " + formatMusd(fee.data ?? 0n, 2) + " + 200.00 refundable gas deposit"}
          />
          <ReceiptLine label="Ratio" value={formatRatio(q.icrE18)} />
        </>
      )}
      <PrimaryButton
        loading={busy}
        loadingLabel={busyLabel}
        disabled={!q || q.state !== "ok" || debtWei === null || collWei === null || debtWei < shortfallWei}
        disabledReason={blocker}
        onClick={() => {
          if (q?.state === "ok" && debtWei !== null && collWei !== null)
            onOpen({ collWei, debtWei, totalDebtWei: q.totalDebtWei });
        }}
      >
        Lock {coll || "0"} BTC, borrow {debt || "0"} MUSD, pay
      </PrimaryButton>
      {error && <StatusLine tone="error">{error}</StatusLine>}
      <SecondaryButton href={OPEN_ON_MEZO}>Or open it on Mezo</SecondaryButton>
    </Card>
  );
}
