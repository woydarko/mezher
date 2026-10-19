"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { BaseError, ContractFunctionRevertedError, zeroAddress, type Address, type Hex } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSignTypedData,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { Card } from "@/components/Card";
import { Doodle } from "@/components/Doodle";
import { Field } from "@/components/Field";
import { OpenTroveCard } from "@/components/OpenTroveCard";
import { WalletButton } from "@/components/WalletButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RatioMeter } from "@/components/RatioMeter";
import { ReceiptLine } from "@/components/ReceiptLine";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusLine } from "@/components/StatusLine";
import { checkoutReducer, type BorrowSig, type PermitSig } from "@/lib/checkout";
import { formatMusd, formatRatio } from "@/lib/format";
import { getBorrowHints } from "@/lib/hints";
import { linkQuery, parseLink, type PayLink } from "@/lib/link";
import {
  ADDRESSES,
  MEZHER_PAY_DEPLOY_BLOCK,
  MEZO_TESTNET,
  borrowerOperationsAbi,
  borrowerOpsSignaturesAbi,
  explorerAddress,
  explorerTx,
  mezherPayAbi,
  musdAbi,
  priceFeedAbi,
  troveManagerAbi,
} from "@/lib/mezo";
import { fetchPaidLogs, isOrderPaid } from "@/lib/paid-logs";
import { icrE18, quote, type TroveState } from "@/lib/quote";
import { permitTypedData, splitSig, withdrawTypedData } from "@/lib/signatures";
import p from "./pay.module.css";

const SIG_TTL_S = 15n * 60n; // client signature deadline: now + 15 minutes
const ALREADY_PAID_CHECK = true;
const ZERO_32 = ("0x" + "0".repeat(64)) as Hex;
const NO_PERMIT: PermitSig = { deadline: 0n, v: 27, r: ZERO_32, s: ZERO_32 };
const NO_BORROW: BorrowSig = { upperHint: zeroAddress, lowerHint: zeroAddress, deadline: 0n, signature: "0x" };
const OPEN_TROVE_URL = "https://testnet.mezo.org";

type Payment = { payer: Address; merchant: Address; amount: bigint; fromBalance: bigint; orderId: Hex };
type Signed = { payment: Payment; permit: PermitSig; borrow: BorrowSig };

const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
const toJson = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

/** Custom error name or revert string when the wallet surfaces one, else viem's short message. */
function errorCode(err: unknown): string {
  if (!(err instanceof BaseError)) return err instanceof Error ? err.message : "unknown";
  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError) return revert.data?.errorName ?? revert.reason ?? err.shortMessage;
  return err.shortMessage;
}

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

  useEffect(() => {
    dispatch({ type: "ADDRESS_CHANGED", address });
    setFallback(null);
  }, [address]);

  const payer = address ?? zeroAddress;
  const reads = useReadContracts({
    allowFailure: false,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
    contracts: [
      { chainId: MEZO_TESTNET.id, address: ADDRESSES.musd, abi: musdAbi, functionName: "balanceOf", args: [payer] },
      { chainId: MEZO_TESTNET.id, address: ADDRESSES.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [payer] },
      {
        chainId: MEZO_TESTNET.id,
        address: ADDRESSES.troveManager,
        abi: troveManagerAbi,
        functionName: "getEntireDebtAndColl",
        args: [payer],
      },
      { chainId: MEZO_TESTNET.id, address: ADDRESSES.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
    ],
  });

  const balanceWei = reads.data?.[0];
  const borrowWei =
    balanceWei === undefined ? 0n : link.amountWei - (balanceWei < link.amountWei ? balanceWei : link.amountWei);
  const fee = useReadContract({
    chainId: MEZO_TESTNET.id,
    address: ADDRESSES.borrowerOperations,
    abi: borrowerOperationsAbi,
    functionName: "getBorrowingFee",
    args: [borrowWei],
    query: { enabled: borrowWei > 0n },
  });

  let trove: TroveState | undefined;
  if (reads.data) {
    const [coll, principal, interest, , pendingPrincipal, pendingInterest] = reads.data[2];
    trove = {
      status: Number(reads.data[1]),
      collWei: coll,
      debtWei: principal + interest + pendingPrincipal + pendingInterest,
    };
  }
  const priceE18 = reads.data?.[3];
  const feeWei = borrowWei > 0n ? fee.data : 0n;
  const q =
    balanceWei !== undefined && trove && priceE18 !== undefined && feeWei !== undefined
      ? quote({ amountWei: link.amountWei, balanceWei, trove, priceE18, feeWei })
      : undefined;
  // Snapshot of the split shown on the receipt; the live quote moves once the balance updates.
  const [paidSplit, setPaidSplit] = useState<{ fromBalanceWei: bigint; borrowWei: bigint } | null>(null);

  const paidLogs = useQuery({
    queryKey: ["paid", link.to, link.orderId],
    enabled: ALREADY_PAID_CHECK && Boolean(publicClient && mezherPay),
    queryFn: () =>
      fetchPaidLogs(publicClient!, { merchant: link.to, orderId: link.orderId, fromBlock: MEZHER_PAY_DEPLOY_BLOCK }),
  });
  const alreadyPaid = paidLogs.data?.find((l) => isOrderPaid([l], link.orderId, link.amountWei));

  const { refetch } = reads;
  const confirm = useCallback(
    async (hash: Hex) => {
      dispatch({ type: "SENT", hash });
      const receipt = await publicClient!
        .waitForTransactionReceipt({ hash, timeout: 60_000 })
        // shortcut: Mezo RPC sometimes stalls this poll; one direct read after the timeout, then the error shows
        .catch(() => publicClient!.getTransactionReceipt({ hash }));
      if (receipt.status === "success") {
        dispatch({ type: "CONFIRMED" });
        refetch();
      } else {
        dispatch({ type: "FAILED", code: "reverted" });
      }
    },
    [publicClient, refetch],
  );

  async function pay() {
    if (!address || !publicClient || !mezherPay || !trove || q?.state !== "ok") return;
    setFallback(null);
    setPaidSplit({ fromBalanceWei: q.fromBalanceWei, borrowWei: q.borrowWei });
    dispatch({ type: "START" });
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + SIG_TTL_S;

      let permit = NO_PERMIT;
      if (q.fromBalanceWei > 0n) {
        const nonce = await publicClient.readContract({
          address: ADDRESSES.musd,
          abi: musdAbi,
          functionName: "nonces",
          args: [address],
        });
        const sig = await signTypedDataAsync(
          permitTypedData({ owner: address, spender: mezherPay, valueWei: q.fromBalanceWei, nonce, deadline }),
        );
        permit = { deadline, ...splitSig(sig) };
      }
      dispatch({ type: "PERMIT_SIGNED", permit });

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

      const signed: Signed = {
        payment: {
          payer: address,
          merchant: link.to,
          amount: link.amountWei,
          fromBalance: q.fromBalanceWei,
          orderId: link.orderId,
        },
        permit,
        borrow,
      };
      // MezherPay accepts a payment without a borrow only from the payer (BalanceOnlyNeedsPayer).
      if (q.borrowWei === 0n) {
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

  function submitOwnGas(s: Signed): Promise<Hex> {
    return writeContractAsync({
      chainId: MEZO_TESTNET.id,
      address: mezherPay!,
      abi: mezherPayAbi,
      functionName: "pay",
      args: [s.payment, s.permit, s.borrow],
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
          <StatusLine tone="success" href={explorerTx(alreadyPaid.txHash)}>
            Already paid
          </StatusLine>
          <p>This order was paid by {short(alreadyPaid.payer)}. Nothing more to do.</p>
        </Card>
      </main>
    );
  }

  const busy = state.step === "signing_permit" || state.step === "signing_borrow" || state.step === "sending";
  let loadingLabel = "Sending…";
  if (q?.state === "ok" && state.step === "signing_permit")
    loadingLabel = "Sign to move " + formatMusd(q.fromBalanceWei) + " MUSD from your balance";
  if (q?.state === "ok" && state.step === "signing_borrow")
    loadingLabel = "Sign to borrow " + formatMusd(q.borrowWei) + " MUSD to this merchant";

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

      {onMezo && mezherPay && (
        <>
          {(reads.isLoading || (borrowWei > 0n && fee.isLoading)) && (
            <Card>
              <StatusLine tone="info">Reading your balance and Trove…</StatusLine>
            </Card>
          )}

          {(reads.isError || fee.isError) && (
            <Card>
              <StatusLine tone="error">Can&apos;t reach Mezo testnet.</StatusLine>
              <SecondaryButton
                onClick={() => {
                  reads.refetch();
                  fee.refetch();
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
              onOpened={() => reads.refetch()}
            />
          )}

          {q && q.state !== "needs_trove" && trove?.status === 1 && priceE18 !== undefined && (
            <Card title="Your Bitcoin credit">
              <ReceiptLine label="Collateral" value={formatMusd(trove.collWei, 4) + " BTC"} />
              <ReceiptLine label="Debt" value={formatMusd(trove.debtWei) + " MUSD"} />
              <RatioMeter
                nowE18={icrE18(trove.collWei, priceE18, trove.debtWei)}
                afterE18={q.icrAfterE18 ?? icrE18(trove.collWei, priceE18, trove.debtWei)}
              />
            </Card>
          )}

          {q?.state === "ok" && (
            <Card>
              <ReceiptLine label="From your balance" value={formatMusd(q.fromBalanceWei) + " MUSD"} />
              <ReceiptLine
                label="Borrowed from Trove"
                value={formatMusd(q.borrowWei) + " MUSD"}
                sub={q.borrowWei > 0n ? "fee 0.1% · " + formatMusd(q.feeWei, 4) + " MUSD" : undefined}
              />
              <ReceiptLine label="Merchant receives" value={formatMusd(link.amountWei) + " MUSD"} />
              <ReceiptLine label="Gas you pay" value={q.borrowWei > 0n ? "0" : "Network fee, under 0.000001 BTC"} />
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
              <PrimaryButton
                disabled
                disabledReason="Your Trove would drop below 150%. Pay less or add collateral on Mezo."
                onClick={() => undefined}
              >
                Pay {formatMusd(link.amountWei)} MUSD
              </PrimaryButton>
              <SecondaryButton href={OPEN_TROVE_URL}>Add collateral on Mezo</SecondaryButton>
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
