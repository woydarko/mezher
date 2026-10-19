"use client";

import { useState } from "react";
import { parseUnits, type Address } from "viem";
import { useBalance, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { formatMusd, formatRatio } from "@/lib/format";
import { getBorrowHints } from "@/lib/hints";
import { ADDRESSES, MEZO_TESTNET, borrowerOperationsAbi, explorerTx } from "@/lib/mezo";
import { GAS_COMPENSATION_WEI, MIN_NET_DEBT_WEI, collateralFor, openTroveQuote } from "@/lib/trove";
import { Card } from "./Card";
import { Field } from "./Field";
import { PrimaryButton } from "./PrimaryButton";
import { ReceiptLine } from "./ReceiptLine";
import { SecondaryButton } from "./SecondaryButton";
import { StatusLine } from "./StatusLine";

const DECIMAL_RE = /^\d+(\.\d{1,18})?$/;
const SUGGESTED_RATIO_E18 = 25n * 10n ** 17n; // 250%: room for a few payments before the 150% floor
const FEE_ESTIMATE_E18 = 10n ** 15n; // 0.1%, only to pre-fill the collateral field; the real fee is read on-chain
const OPEN_ON_MEZO = "https://testnet.mezo.org";

const toWei = (s: string) => (DECIMAL_RE.test(s) ? parseUnits(s, 18) : null);
/** Rounded up to 4 decimals so the suggestion never lands under its own ratio. */
const btcUp = (wei: bigint) => {
  const step = 10n ** 14n;
  return formatMusd(((wei + step - 1n) / step) * step, 4).replace(/,/g, "");
};

/**
 * Opens a Mezo Trove from the checkout when the payer has none. Collateral is native BTC sent as msg.value,
 * so the payer sends this transaction (a relayer cannot lock someone else's BTC).
 */
export function OpenTroveCard({
  payer,
  shortfallWei,
  priceE18,
  onOpened,
}: {
  payer: Address;
  shortfallWei: bigint;
  priceE18: bigint;
  onOpened: () => void;
}) {
  const publicClient = usePublicClient({ chainId: MEZO_TESTNET.id });
  const { writeContractAsync } = useWriteContract();
  const btc = useBalance({ address: payer, chainId: MEZO_TESTNET.id });

  const firstDebt = shortfallWei > MIN_NET_DEBT_WEI ? shortfallWei : MIN_NET_DEBT_WEI;
  const [debt, setDebt] = useState(() => formatMusd(firstDebt, 2).replace(/,/g, ""));
  const [coll, setColl] = useState(() => {
    const total = firstDebt + (firstDebt * FEE_ESTIMATE_E18) / 10n ** 18n + GAS_COMPENSATION_WEI;
    return btcUp(collateralFor(total, priceE18, SUGGESTED_RATIO_E18));
  });
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string; hash?: `0x${string}` } | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function open() {
    if (!publicClient || !q || q.state !== "ok" || debtWei === null || collWei === null) return;
    setBusy(true);
    setStatus({ tone: "info", text: "Confirm in your wallet…" });
    try {
      const hints = await getBorrowHints(publicClient, { collWei, debtAfterWei: q.totalDebtWei });
      const hash = await writeContractAsync({
        chainId: MEZO_TESTNET.id,
        address: ADDRESSES.borrowerOperations,
        abi: borrowerOperationsAbi,
        functionName: "openTrove",
        args: [debtWei, hints.upperHint, hints.lowerHint],
        value: collWei,
      });
      setStatus({ tone: "info", text: "Opening your Trove…", hash });
      const receipt = await publicClient
        .waitForTransactionReceipt({ hash, timeout: 60_000 })
        // same stall guard as the checkout: one direct read after the timeout
        .catch(() => publicClient.getTransactionReceipt({ hash }));
      if (receipt.status !== "success") throw new Error("The transaction reverted.");
      setStatus(null);
      onOpened();
    } catch (err) {
      const short = (err as { shortMessage?: string })?.shortMessage ?? (err as Error)?.message ?? "unknown";
      setStatus({ tone: "error", text: "Couldn't open the Trove: " + short });
    } finally {
      setBusy(false);
    }
  }

  let blocker: string | undefined;
  if (debtWei === null || collWei === null) blocker = "Enter amounts as plain numbers, like 1800 or 0.05.";
  else if (q?.state === "debt_too_small") blocker = "Mezo's minimum borrow is 1,800 MUSD.";
  else if (q?.state === "not_enough_btc")
    blocker = "You can lock at most " + formatMusd(q.maxCollWei, 4) + " BTC and keep enough for the network fee.";
  else if (q?.state === "ratio_too_low")
    blocker = "Lock at least " + btcUp(q.minCollWei) + " BTC so the Trove starts above the 150% safe line.";

  return (
    <Card title="Your Bitcoin credit">
      <p>
        Your MUSD balance is {formatMusd(shortfallWei)} MUSD short and you have no Trove yet. Open one here: lock BTC,
        borrow MUSD into your wallet, then pay.
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
        loadingLabel="Opening…"
        disabled={!q || q.state !== "ok"}
        disabledReason={blocker}
        onClick={open}
      >
        Lock {coll || "0"} BTC, borrow {debt || "0"} MUSD
      </PrimaryButton>
      {status && (
        <StatusLine tone={status.tone} href={status.hash && explorerTx(status.hash)}>
          {status.text}
        </StatusLine>
      )}
      <SecondaryButton href={OPEN_ON_MEZO}>Or open it on Mezo</SecondaryButton>
    </Card>
  );
}
