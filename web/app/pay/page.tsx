"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { zeroAddress, type Address, type Hex } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { Card } from "@/components/Card";
import { Doodle } from "@/components/Doodle";
import { Field } from "@/components/Field";
import { OpenTroveCard, type OpenRequest } from "@/components/OpenTroveCard";
import { WalletButton } from "@/components/WalletButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RatioMeter } from "@/components/RatioMeter";
import { ReceiptLine } from "@/components/ReceiptLine";
import { SecondaryButton } from "@/components/SecondaryButton";
import { RedemptionLine } from "@/components/RedemptionLine";
import { StatusLine } from "@/components/StatusLine";
import ui from "@/components/ui.module.css";
import { useMerchantActivation } from "@/components/useMerchantActivation";
import { checkoutReducer, isSmartAccount, permitPlan, receiptEvent, type BorrowSig, type OpenSig, type Order, type PermitSig } from "@/lib/checkout";
import { formatMusd, formatRatio, toJson } from "@/lib/format";
import { getBorrowHints } from "@/lib/hints";
import { linkQuery, parseLink, type PayLink } from "@/lib/link";
import {
  ADDRESSES,
  MEZHER_PAY_DEPLOY_BLOCK,
  MEZO_TESTNET,
  borrowerOpsSignaturesAbi,
  explorerAddress,
  explorerTx,
  MIN_SPONSORED_WEI,
  mezherPayAbi,
  mezherPayCallAbi,
  musdAbi,
} from "@/lib/mezo";
import { errorCode } from "@/lib/errors";
import { readQuoteInputs } from "@/lib/quote-read";
import { fetchPaidLogs, settledKey } from "@/lib/paid-logs";
import { UI_ICR_FLOOR_E18, icrE18, quote } from "@/lib/quote";
import { openTroveTypedData, orderTypedData, permitTypedData, splitSig, withdrawTypedData } from "@/lib/signatures";
import p from "./pay.module.css";

const SIG_TTL_S = 15n * 60n; // client signature deadline: now + 15 minutes
// The payer's minimum Trove ratio after the payment, signed into the order. The first is the UI floor.
const MIN_ICR_CHOICES: { value: bigint; label: string }[] = [
  { value: UI_ICR_FLOOR_E18, label: "150.5% (lowest)" },
  { value: 1_750_000_000_000_000_000n, label: "175%" },
  { value: 2_000_000_000_000_000_000n, label: "200%" },
];
const ZERO_32 = ("0x" + "0".repeat(64)) as Hex;
const NO_PERMIT: PermitSig = { deadline: 0n, v: 27, r: ZERO_32, s: ZERO_32 };
const NO_BORROW: BorrowSig = { upperHint: zeroAddress, lowerHint: zeroAddress, deadline: 0n, signature: "0x" };
// Error codes (see lib/errors.ts) for a quote that stopped being payable between render and signing.
const STALE_CODE = {
  needs_trove: "quote_changed",
  blocked_ratio: "below_min_ratio",
  blocked_recovery: "Recovery Mode",
  blocked_capacity: "exceeds maxBorrowingCapacity",
} as const;
const OPEN_TROVE_URL = "https://testnet.mezo.org";

type Signed = { order: Order; orderSig: Hex; permit: PermitSig; borrow: BorrowSig };

const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);

export default function PayPage() {
  return (
    <Suspense fallback={<main className="page" />}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const params = useSearchParams();
  const parsed = useMemo(() => parseLink(new URLSearchParams(params.toString())), [params]);
  if (!parsed.ok) {
    const empty = !params.has("to") && !params.has("amount") && !params.has("order");
    return (
      <main className="page page-center">
        <PasteLink incomplete={!empty} />
      </main>
    );
  }
  return <CheckoutFor link={parsed.link} />;
}

/** /pay without a valid link: paste one. Unpaid orders exist only inside their link, so an id alone can't be looked up. */
function PasteLink({ incomplete }: { incomplete: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  function open() {
    const query = linkQuery(value);
    if (!query) {
      setError("That isn't a full Mezher payment link. It needs to=, amount= and order=.");
      return;
    }
    router.push("/pay?" + query);
  }

  return (
    <Card>
      <Doodle name="coin" className={p.pasteCoin} />
      <h1>{incomplete ? "This payment link is incomplete" : "Pay a link"}</h1>
      <p>
        {incomplete
          ? "Something in it is missing or mistyped. Paste the link again, or ask the shop for a new one."
          : "Got a payment link from a shop? Paste it here to see exactly what you'd pay."}
      </p>
      <form
        className={p.pasteForm}
        onSubmit={(e) => {
          e.preventDefault();
          open();
        }}
      >
        <Field
          label="Payment link"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          placeholder="https://…/pay?to=0x…&amount=12&order=…"
          error={error}
          spellCheck={false}
          autoComplete="off"
        />
        <PrimaryButton onClick={open}>Open payment</PrimaryButton>
      </form>
    </Card>
  );
}

function OrderCard({ link }: { link: PayLink }) {
  return (
    <Card>
      <h1>{link.label ?? "Payment"}</h1>
      <ReceiptLine
        label={"to " + short(link.to)}
        value={<span aria-label={formatMusd(link.amountWei) + " MUSD"}>{formatMusd(link.amountWei)} MUSD</span>}
      />
    </Card>
  );
}

function CheckoutFor({ link }: { link: PayLink }) {
  const { address, chainId, isConnected } = useAccount();
  const [state, dispatch] = useReducer(checkoutReducer, { step: "idle" });
  const [fallback, setFallback] = useState<Signed | null>(null);
  const publicClient = usePublicClient({ chainId: MEZO_TESTNET.id });
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const { switchChain } = useSwitchChain();
  const mezherPay = ADDRESSES.mezherPay;
  const [minIcr, setMinIcr] = useState(UI_ICR_FLOOR_E18);
  // Which signatures this run needs, for the "Step n of m" text.
  const [plan, setPlan] = useState({ permit: false, third: false });

  useEffect(() => {
    dispatch({ type: "ADDRESS_CHANGED", address });
    setFallback(null);
  }, [address]);

  const payer = address ?? zeroAddress;
  const reads = useQuery({
    queryKey: ["quote-inputs", address, link.amountWei.toString()],
    enabled: Boolean(address && publicClient),
    refetchInterval: 15_000,
    queryFn: () => readQuoteInputs(publicClient!, address!, link.amountWei),
  });
  const { balanceWei, trove, priceE18 } = reads.data ?? {};
  const borrowWei =
    balanceWei === undefined ? 0n : link.amountWei - (balanceWei < link.amountWei ? balanceWei : link.amountWei);
  const q = reads.data ? quote({ ...reads.data, amountWei: link.amountWei, minIcrE18: minIcr }) : undefined;
  // Snapshot of the split shown on the receipt; the live quote moves once the balance updates.
  const [paidSplit, setPaidSplit] = useState<{ fromBalanceWei: bigint; borrowWei: bigint } | null>(null);

  const activation = useMerchantActivation(link.to, link.amountWei);
  // The payer's own allowance: a merchant paying from balance must not have its fee budget overwritten.
  const payerBudget = useMerchantActivation(address, link.amountWei);
  const smartAccount = useQuery({
    queryKey: ["smart-account", address],
    enabled: Boolean(address && publicClient),
    queryFn: () => isSmartAccount(publicClient!, address!),
  });
  const settled = useReadContract({
    chainId: MEZO_TESTNET.id,
    address: mezherPay,
    abi: mezherPayAbi,
    functionName: "settled",
    args: [settledKey(payer, link.to, link.orderId)],
    query: { enabled: Boolean(address && mezherPay) },
  });
  const alreadyPaid = settled.data === true;
  // Only the receipt link; "already paid" itself comes from `settled`.
  const paidLog = useQuery({
    queryKey: ["paid", link.to, link.orderId, address],
    enabled: alreadyPaid && Boolean(publicClient),
    queryFn: async () =>
      (await fetchPaidLogs(publicClient!, { merchant: link.to, payer: address, orderId: link.orderId, fromBlock: MEZHER_PAY_DEPLOY_BLOCK }))[0],
  });

  const { refetch } = reads;
  const confirm = useCallback(
    async (hash: Hex) => {
      dispatch({ type: "SENT", hash });
      const receipt = await publicClient!
        .waitForTransactionReceipt({ hash, timeout: 60_000 })
        // shortcut: Mezo RPC sometimes stalls this poll; one direct read after the timeout, then the error shows
        .catch(() => publicClient!.getTransactionReceipt({ hash }));
      dispatch(receiptEvent(receipt.status));
      if (receipt.status === "success") refetch();
    },
    [publicClient, refetch],
  );

  /** Signs the order, then the permit the contract spends (the MUSD nonce is read fresh). */
  async function signOrderAndPermit(order: Order, deadline: bigint, withPermit: boolean) {
    const orderSig = await signTypedDataAsync(orderTypedData(order, MEZO_TESTNET.id, mezherPay!));
    dispatch({ type: "ORDER_SIGNED", orderSig });
    let permit = NO_PERMIT;
    if (withPermit) {
      const nonce = await publicClient!.readContract({
        address: ADDRESSES.musd,
        abi: musdAbi,
        functionName: "nonces",
        args: [order.payer],
      });
      const sig = await signTypedDataAsync(
        permitTypedData({ owner: order.payer, spender: mezherPay!, valueWei: order.fromBalance, nonce, deadline }),
      );
      permit = { deadline, ...splitSig(sig) };
    }
    dispatch({ type: "PERMIT_SIGNED", permit });
    return { orderSig, permit };
  }

  /** False when the payer's existing MUSD allowance already covers the balance part (permit would overwrite it). */
  async function permitNeeded(owner: Address, fromBalance: bigint): Promise<boolean> {
    if (fromBalance === 0n) return false;
    const allowance = await publicClient!.readContract({
      address: ADDRESSES.musd,
      abi: musdAbi,
      functionName: "allowance",
      args: [owner, mezherPay!],
    });
    return permitPlan(allowance, fromBalance).needed;
  }

  const newOrder = (payerAddr: Address, fromBalance: bigint, deadline: bigint): Order => ({
    payer: payerAddr,
    merchant: link.to,
    amount: link.amountWei,
    fromBalance,
    minIcrAfter: minIcr,
    orderId: link.orderId,
    deadline,
  });

  async function pay() {
    if (!address || !publicClient || !mezherPay || q?.state !== "ok") return;
    setFallback(null);
    dispatch({ type: "START" });
    try {
      const live = await readQuoteInputs(publicClient, address, link.amountWei);
      const { trove } = live;
      const q = quote({ ...live, amountWei: link.amountWei, minIcrE18: minIcr });
      if (q.state !== "ok") {
        // The screen was stale: show the new state instead of asking for signatures.
        dispatch({ type: "FAILED", code: STALE_CODE[q.state] });
        refetch();
        return;
      }
      setPaidSplit({ fromBalanceWei: q.fromBalanceWei, borrowWei: q.borrowWei });
      const withPermit = await permitNeeded(address, q.fromBalanceWei);
      setPlan({ permit: withPermit, third: q.borrowWei > 0n });
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + SIG_TTL_S;
      const order = newOrder(address, q.fromBalanceWei, deadline);
      const { orderSig, permit } = await signOrderAndPermit(order, deadline, withPermit);

      let borrow = NO_BORROW;
      if (q.borrowWei > 0n) {
        const hints = await getBorrowHints(publicClient, {
          collWei: trove.collWei,
          debtAfterWei: trove.debtWei + q.borrowWei + q.feeWei,
        });
        const nonce = await publicClient.readContract({
          address: ADDRESSES.borrowerOpsSignatures,
          abi: borrowerOpsSignaturesAbi,
          functionName: "getNonce",
          args: [address],
        });
        const signature = await signTypedDataAsync(
          withdrawTypedData({ amountWei: q.borrowWei, borrower: address, recipient: link.to, nonce, deadline }),
        );
        borrow = { ...hints, deadline, signature };
      }
      dispatch({ type: "BORROW_SIGNED", borrow });

      const signed: Signed = { order, orderSig, permit, borrow };
      if (link.amountWei < MIN_SPONSORED_WEI) {
        // Too small to sponsor: skip the relay and send the same signatures from the payer's wallet.
        await confirm(await submitOwnGas(signed));
        return;
      }
      const res = await fetch("/api/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: toJson(signed),
      }).catch(() => null);
      const data: { hash?: Hex; error?: string; reason?: string } = res ? await res.json().catch(() => ({})) : {};
      if (!res || res.status >= 500) {
        setFallback(signed);
        dispatch({ type: "FAILED", code: "relayer_unavailable" });
        return;
      }
      if (!res.ok || !data.hash) {
        dispatch({ type: "FAILED", code: data.reason ?? data.error ?? "relay_" + res.status });
        return;
      }
      await confirm(data.hash);
    } catch (err) {
      dispatch({ type: "FAILED", code: errorCode(err) });
    }
  }

  /** No Trove yet: sign order, permit and Mezo's OpenTrove, then the payer sends one openAndPay with the BTC. */
  async function openAndPay(a: OpenRequest) {
    if (!address || !publicClient || !mezherPay) return;
    setFallback(null);
    setPaidSplit({ fromBalanceWei: link.amountWei, borrowWei: 0n });
    dispatch({ type: "START" });
    try {
      const withPermit = await permitNeeded(address, link.amountWei);
      setPlan({ permit: withPermit, third: true });
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + SIG_TTL_S;
      const order = newOrder(address, link.amountWei, deadline);
      const { orderSig, permit } = await signOrderAndPermit(order, deadline, withPermit);

      const hints = await getBorrowHints(publicClient, { collWei: a.collWei, debtAfterWei: a.totalDebtWei });
      const nonce = await publicClient.readContract({
        address: ADDRESSES.borrowerOpsSignatures,
        abi: borrowerOpsSignaturesAbi,
        functionName: "getNonce",
        args: [address],
      });
      const signature = await signTypedDataAsync(
        openTroveTypedData({
          assetAmountWei: a.collWei,
          debtAmountWei: a.debtWei,
          borrower: address,
          recipient: address,
          nonce,
          deadline,
        }),
      );
      const open: OpenSig = { ...hints, deadline, signature, debtAmount: a.debtWei };
      dispatch({ type: "OPEN_SIGNED", open });

      const hash = await writeContractAsync({
        chainId: MEZO_TESTNET.id,
        address: mezherPay,
        abi: mezherPayCallAbi,
        functionName: "openAndPay",
        args: [order, orderSig, permit, open],
        value: a.collWei,
      });
      await confirm(hash);
    } catch (err) {
      dispatch({ type: "FAILED", code: errorCode(err) });
    }
  }

  function submitOwnGas(s: Signed): Promise<Hex> {
    return writeContractAsync({
      chainId: MEZO_TESTNET.id,
      address: mezherPay!,
      abi: mezherPayCallAbi,
      functionName: "pay",
      args: [s.order, s.orderSig, s.permit, s.borrow],
    });
  }

  async function payWithOwnGas() {
    if (!fallback || !mezherPay) return;
    dispatch({ type: "RESET" });
    try {
      const hash = await submitOwnGas(fallback);
      setFallback(null);
      await confirm(hash);
    } catch (err) {
      dispatch({ type: "FAILED", code: errorCode(err) });
    }
  }

  if (state.step === "paid" || state.step === "confirming") {
    const icrNow = trove?.status === 1 && priceE18 !== undefined ? icrE18(trove.collWei, priceE18, trove.debtWei) : null;
    return (
      <main className="page page-center">
        <Card>
          {state.step === "paid" && (
            <div className={p.celebrate} aria-hidden>
              <Doodle name="star" className={p.star1} />
              <Doodle name="check" className={p.bigCheck} />
              <Doodle name="star" className={p.star2} />
            </div>
          )}
          {state.step === "paid" && (
            <p className={p.paidAmount + " mono"}>
              {formatMusd(link.amountWei)} <span>MUSD</span>
            </p>
          )}
          {state.step === "paid" ? (
            <StatusLine tone="success" href={state.hash && explorerTx(state.hash)}>
              Paid {formatMusd(link.amountWei)} MUSD
            </StatusLine>
          ) : (
            <StatusLine tone="info" href={state.hash && explorerTx(state.hash)}>
              Waiting for confirmation…
            </StatusLine>
          )}
          <p>
            {link.label ?? "Payment"} · order {link.orderRaw.slice(0, 8)}…
          </p>
          {paidSplit && (
            <p className="mono">
              From balance {formatMusd(paidSplit.fromBalanceWei)} · Borrowed {formatMusd(paidSplit.borrowWei)}
            </p>
          )}
          {state.step === "paid" && icrNow !== null && <p className="mono">Ratio now {formatRatio(icrNow)}</p>}
        </Card>
      </main>
    );
  }

  if (alreadyPaid) {
    return (
      <main className="page page-center">
        <OrderCard link={link} />
        <Card>
          <StatusLine tone="success" href={paidLog.data && explorerTx(paidLog.data.txHash)}>
            Already paid
          </StatusLine>
          <p>You already paid this order. Nothing more to do.</p>
        </Card>
      </main>
    );
  }

  const busy =
    state.step === "signing_order" ||
    state.step === "signing_permit" ||
    state.step === "signing_borrow" ||
    state.step === "sending";
  const steps = 1 + (plan.permit ? 1 : 0) + (plan.third ? 1 : 0);
  const stepOf = (n: number, what: string) => "Step " + n + " of " + steps + ": " + what;
  let loadingLabel = "Sending…";
  if (state.step === "signing_order") loadingLabel = stepOf(1, "sign this payment");
  if (state.step === "signing_permit") loadingLabel = stepOf(2, "sign the MUSD move");
  if (state.step === "signing_borrow")
    loadingLabel = stepOf(steps, trove?.status === 1 ? "sign the borrow to this merchant" : "sign opening your Trove");

  // Nothing is signed until the wallet is a regular account and the shop can pay its fee.
  let gate: ReactNode = null;
  if (smartAccount.data === true)
    gate = (
      <StatusLine tone="error">
        This wallet is a smart account, and it can&apos;t sign Mezher payments. Switch to a regular EVM wallet account
        (a plain 0x address) and reload.
      </StatusLine>
    );
  else if (activation.activated === false)
    gate = (
      <StatusLine tone="error">
        This shop hasn&apos;t turned on payments yet, so you can&apos;t pay it. Ask the shop to activate payments in
        Mezher.
      </StatusLine>
    );
  else if (activation.isError || smartAccount.isError)
    gate = <StatusLine tone="error">Can&apos;t reach Mezo testnet.</StatusLine>;
  else if (activation.activated === undefined || smartAccount.data === undefined)
    gate = <StatusLine tone="info">Checking the shop and your wallet…</StatusLine>;

  // A hash here means a tx was mined and reverted: link the wallet so the payer can check before paying again.
  const staleLine =
    state.step === "failed" && state.error ? (
      <StatusLine tone="error" href={state.hash && address && explorerAddress(address)}>
        {state.error}
      </StatusLine>
    ) : null;
  // Shown whenever a borrow is needed, including when it is blocked, so the payer can lower a too-strict choice.
  const minIcrField =
    borrowWei > 0n ? (
      <div className={ui.field}>
        <label htmlFor="min-icr" className={ui.fieldLabel}>
          Keep my ratio above
        </label>
        <span className={ui.inputWrap}>
          <select id="min-icr" className={ui.input} value={minIcr.toString()} onChange={(e) => setMinIcr(BigInt(e.target.value))}>
            {MIN_ICR_CHOICES.map((c) => (
              <option key={c.label} value={c.value.toString()}>
                {c.label}
              </option>
            ))}
          </select>
        </span>
      </div>
    ) : null;
  const onMezo = isConnected && chainId === MEZO_TESTNET.id;

  return (
    <main className="page page-center">
      <OrderCard link={link} />

      {!isConnected && (
        <Card>
          <p>Connect your wallet to see how you&apos;d pay.</p>
          <WalletButton wide />
        </Card>
      )}

      {isConnected && !onMezo && (
        <Card>
          <p>Your wallet is on another network.</p>
          <PrimaryButton onClick={() => switchChain({ chainId: MEZO_TESTNET.id })}>Switch to Mezo testnet</PrimaryButton>
        </Card>
      )}

      {onMezo && !mezherPay && <StatusLine tone="error">Payments are not live yet: MezherPay is not deployed.</StatusLine>}

      {onMezo && mezherPay && gate && <Card>{gate}</Card>}

      {onMezo && mezherPay && !gate && (
        <>
          {reads.isLoading && (
            <Card>
              <StatusLine tone="info">Reading your balance and Trove…</StatusLine>
            </Card>
          )}

          {reads.isError && (
            <Card>
              <StatusLine tone="error">Can&apos;t reach Mezo testnet.</StatusLine>
              <SecondaryButton
                onClick={() => {
                  reads.refetch();
                }}
              >
                Retry
              </SecondaryButton>
            </Card>
          )}

          {q?.state === "needs_trove" && address && priceE18 !== undefined && (
            <OpenTroveCard
              payer={address}
              shortfallWei={q.shortfallWei}
              priceE18={priceE18}
              busy={busy}
              busyLabel={loadingLabel}
              error={state.step === "failed" ? state.error : undefined}
              onOpen={openAndPay}
            />
          )}

          {q && q.state !== "needs_trove" && trove?.status === 1 && priceE18 !== undefined && (
            <Card title="Your Bitcoin credit">
              <ReceiptLine label="Collateral" value={formatMusd(trove.collWei, 4) + " BTC"} />
              <ReceiptLine label="Debt" value={formatMusd(trove.debtWei) + " MUSD"} />
              <RatioMeter
                nowE18={icrE18(trove.collWei, priceE18, trove.debtWei)}
                afterE18={("icrAfterE18" in q ? q.icrAfterE18 : null) ?? icrE18(trove.collWei, priceE18, trove.debtWei)}
              />
            </Card>
          )}

          <RedemptionLine payer={payer} enabled={trove?.status === 1 && borrowWei > 0n} />

          {q?.state === "ok" && (
            <Card>
              <ReceiptLine label="From your balance" value={formatMusd(q.fromBalanceWei) + " MUSD"} />
              <ReceiptLine
                label="Borrowed from Trove"
                value={formatMusd(q.borrowWei) + " MUSD"}
                sub={q.borrowWei > 0n ? "fee 0.1% · " + formatMusd(q.feeWei, 4) + " MUSD" : undefined}
              />
              <ReceiptLine
                label="Merchant receives"
                value={formatMusd(link.amountWei - (activation.feeWei ?? 0n)) + " MUSD"}
                sub="after the shop's fee"
              />
              <ReceiptLine
                label="Gas you pay"
                value={link.amountWei >= MIN_SPONSORED_WEI ? "0" : "Network fee, under 0.000001 BTC"}
              />
              {payerBudget.allowanceWei !== undefined &&
                payerBudget.allowanceWei > 0n &&
                q.fromBalanceWei > 0n &&
                permitPlan(payerBudget.allowanceWei, q.fromBalanceWei).remainingWei < (payerBudget.feeWei ?? 0n) && (
                  <StatusLine tone="error">
                    You are also a shop on Mezher. Paying from your balance uses up your fee budget, so your own
                    customers can&apos;t pay you until you activate payments again on the Merchant page.
                  </StatusLine>
                )}
              {minIcrField}
              <PrimaryButton loading={busy} loadingLabel={loadingLabel} onClick={pay}>
                Pay {formatMusd(link.amountWei)} MUSD
              </PrimaryButton>
              {state.step === "failed" && state.error && <StatusLine tone="error">{state.error}</StatusLine>}
              {fallback && <SecondaryButton onClick={payWithOwnGas}>Pay with my own gas</SecondaryButton>}
            </Card>
          )}

          {q?.state === "blocked_ratio" && (
            <Card>
              <ReceiptLine label="You can borrow at most" value={formatMusd(q.maxBorrowWei) + " MUSD"} />
              {minIcrField}
              <PrimaryButton
                disabled
                disabledReason={"Your Trove would drop below " + formatRatio(minIcr) + ". Pay less, lower the ratio, or add collateral on Mezo."}
                onClick={() => undefined}
              >
                Pay {formatMusd(link.amountWei)} MUSD
              </PrimaryButton>
              <SecondaryButton href={OPEN_TROVE_URL}>Add collateral on Mezo</SecondaryButton>
              {staleLine}
            </Card>
          )}

          {q?.state === "blocked_capacity" && (
            <Card>
              <p>Your Trove&apos;s borrow limit was set when it was opened, and this payment is above it.</p>
              <ReceiptLine label="You can borrow at most" value={formatMusd(q.maxBorrowWei) + " MUSD"} />
              {q.canRefinance && <p>Refinance your Trove to raise it.</p>}
              <PrimaryButton disabled disabledReason="This is above your Trove's borrow limit." onClick={() => undefined}>
                Pay {formatMusd(link.amountWei)} MUSD
              </PrimaryButton>
              {staleLine}
            </Card>
          )}

          {q?.state === "blocked_recovery" && (
            <Card>
              <p>Mezo is in Recovery Mode, so borrowing is paused.</p>
              <ReceiptLine label="You can still pay from balance" value={formatMusd(q.fromBalanceWei) + " MUSD"} />
              <PrimaryButton disabled disabledReason="Borrowing is paused. Try again later." onClick={() => undefined}>
                Pay {formatMusd(link.amountWei)} MUSD
              </PrimaryButton>
              {staleLine}
            </Card>
          )}

          <p className="section-label">
            Merchant <a href={explorerAddress(link.to)}>{short(link.to)}</a>
          </p>
        </>
      )}
    </main>
  );
}
