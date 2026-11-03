"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { isAddress, isAddressEqual, parseUnits, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useSignTypedData, useSwitchChain } from "wagmi";
import { Card } from "@/components/Card";
import { Doodle } from "@/components/Doodle";
import { Field } from "@/components/Field";
import { LinkQr } from "@/components/LinkQr";
import { PaymentsTable } from "@/components/PaymentsTable";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusLine } from "@/components/StatusLine";
import styles from "@/components/ui.module.css";
import { useMerchantActivation } from "@/components/useMerchantActivation";
import { errorCopy } from "@/lib/errors";
import { formatBps, formatMusd, toJson } from "@/lib/format";
import { buildLink, embedSnippet, randomOrder } from "@/lib/link";
import { ACTIVATION_BUDGET_WEI, ADDRESSES, MEZHER_PAY_DEPLOY_BLOCK, MEZO_TESTNET, mezherPayAbi, musdAbi } from "@/lib/mezo";
import { fetchPaidLogs } from "@/lib/paid-logs";
import { permitTypedData, splitSig } from "@/lib/signatures";

const POLL_MS = 5_000;
const COPIED_MS = 2_000;
const COPY_TIMEOUT_MS = 2_000;
const SIG_TTL_S = 15n * 60n;

type Errors = Partial<Record<"to" | "amount" | "order" | "label", string>>;

export default function MerchantPage() {
  const { address, chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: MEZO_TESTNET.id });
  const { signTypedDataAsync } = useSignTypedData();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [order, setOrder] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [url, setUrl] = useState<string | null>(null);
  const [embed, setEmbed] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => setOrder(randomOrder()), []);
  useEffect(() => {
    if (address) setTo((current) => current || address);
  }, [address]);

  const merchant = isAddress(to) ? (to as Address) : undefined;
  const amountWei = /^\d+(\.\d{1,18})?$/.test(amount) ? parseUnits(amount, 18) : 0n;
  const activation = useMerchantActivation(merchant, amountWei);
  const feeBps = useReadContract({
    chainId: MEZO_TESTNET.id,
    address: ADDRESSES.mezherPay,
    abi: mezherPayAbi,
    functionName: "feeBps",
    query: { enabled: Boolean(ADDRESSES.mezherPay) },
  });
  const [activating, setActivating] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const payments = useQuery({
    queryKey: ["paid", merchant],
    enabled: Boolean(merchant && publicClient && ADDRESSES.mezherPay),
    refetchInterval: POLL_MS,
    queryFn: () => fetchPaidLogs(publicClient!, { merchant: merchant!, fromBlock: MEZHER_PAY_DEPLOY_BLOCK }),
  });

  /** Signs a permit for the fee budget; the relay sends it, so the merchant needs no BTC for gas. */
  async function activate() {
    const mezherPay = ADDRESSES.mezherPay;
    if (!address || !publicClient || !mezherPay) return;
    setActivating({ tone: "info", text: "Sign the message in your wallet…" });
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + SIG_TTL_S;
      const nonce = await publicClient.readContract({
        address: ADDRESSES.musd,
        abi: musdAbi,
        functionName: "nonces",
        args: [address],
      });
      const sig = await signTypedDataAsync(
        permitTypedData({ owner: address, spender: mezherPay, valueWei: ACTIVATION_BUDGET_WEI, nonce, deadline }),
      );
      setActivating({ tone: "info", text: "Activating…" });
      const permit = { owner: address, spender: mezherPay, value: ACTIVATION_BUDGET_WEI, deadline, ...splitSig(sig) };
      const res = await fetch("/api/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: toJson({ permit }),
      }).catch(() => null);
      const data: { hash?: Hex; error?: string; reason?: string } = res ? await res.json().catch(() => ({})) : {};
      if (!res || res.status >= 500) throw new Error("activate_relay_down");
      if (!res.ok || !data.hash) throw new Error(data.reason ?? data.error ?? "relay_" + res.status);
      const receipt = await publicClient
        .waitForTransactionReceipt({ hash: data.hash, timeout: 60_000 })
        // same stall guard as the checkout: one direct read after the timeout
        .catch(() => publicClient.getTransactionReceipt({ hash: data.hash! }));
      if (receipt.status !== "success") throw new Error("reverted");
      await activation.refetch();
      setActivating(null);
    } catch (err) {
      const text = (err as { shortMessage?: string })?.shortMessage ?? (err as Error)?.message ?? "unknown";
      setActivating({ tone: "error", text: errorCopy(text) });
    }
  }

  function create() {
    const input = { to, amount, order, label: label || undefined };
    const result = buildLink(window.location.origin, input);
    if (!result.ok) {
      setErrors({ [result.field]: result.message });
      setUrl(null);
      setEmbed(null);
      return;
    }
    const snippet = embedSnippet(window.location.origin, input);
    setErrors({});
    setUrl(result.url);
    setEmbed(snippet.ok ? snippet.html : null);
    setCopied(null);
    setCopyFailed(false);
  }

  async function copy(which: "link" | "embed") {
    const text = which === "link" ? url : embed;
    if (!text) return;
    // A blocked or pending clipboard permission can reject or never settle; either way, say so.
    const ok = await Promise.race([
      navigator.clipboard.writeText(text).then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), COPY_TIMEOUT_MS)),
    ]);
    setCopyFailed(!ok);
    if (ok) {
      setCopied(which);
      setTimeout(() => setCopied(null), COPIED_MS);
    }
  }

  return (
    <main className="page page-wide">
      <Card title="Step 1: Activate payments">
        <h1>Get paid in MUSD</h1>
        <p>
          Mezher takes a small fee from each payment you receive, paid in MUSD from your wallet after the customer
          pays. Allow it once with a signed message. It costs you no gas.
        </p>
        {!ADDRESSES.mezherPay && <StatusLine tone="error">Payments are not live yet: MezherPay is not deployed.</StatusLine>}
        {activation.activated === true && <StatusLine tone="success">Payments are active for this address.</StatusLine>}
        {ADDRESSES.mezherPay && activation.activated !== true && isConnected && chainId !== MEZO_TESTNET.id && (
          <PrimaryButton onClick={() => switchChain({ chainId: MEZO_TESTNET.id })}>Switch to Mezo testnet</PrimaryButton>
        )}
        {ADDRESSES.mezherPay && activation.activated !== true && !(isConnected && chainId !== MEZO_TESTNET.id) && (
          <PrimaryButton
            loading={activating?.tone === "info"}
            loadingLabel={activating?.text}
            disabled={!address || !merchant || !isAddressEqual(address, merchant)}
            disabledReason="Connect the wallet you want to get paid at, and enter it as the Pay to address."
            onClick={activate}
          >
            Activate payments
          </PrimaryButton>
        )}
        {activating?.tone === "error" && <StatusLine tone="error">{activating.text}</StatusLine>}
      </Card>

      <Card title="Step 2: Create a link">
        <Field
          label="Pay to"
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          helper={address && to === address ? "Your connected wallet" : undefined}
          error={errors.to}
          spellCheck={false}
        />
        <Field
          label="Amount (MUSD)"
          value={amount}
          onChange={(e) => setAmount(e.target.value.trim())}
          inputMode="decimal"
          placeholder="12.00"
          error={errors.amount}
        />
        {amountWei > 0n && activation.feeWei !== undefined ? (
          <p>
            Fee {formatMusd(activation.feeWei)} MUSD, you receive {formatMusd(amountWei - activation.feeWei)} MUSD.
          </p>
        ) : (
          feeBps.data !== undefined && <p>{formatBps(feeBps.data)} fee per payment, taken from you, not the customer.</p>
        )}
        <Field
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Coffee"
          helper="Labels are visible to anyone with the link."
          error={errors.label}
          maxLength={60}
        />
        <Field
          label="Order id"
          value={order}
          onChange={(e) => setOrder(e.target.value.trim())}
          helper="Generated for you. Each link should have its own."
          error={errors.order}
          spellCheck={false}
        />
        <PrimaryButton onClick={create}>Create payment link</PrimaryButton>
        {url && activation.activated === false && (
          <StatusLine tone="error">
            Payments aren&apos;t active for this address yet, so customers can&apos;t pay this link. Activate above first.
          </StatusLine>
        )}
        {url && (
          <div className={styles.linkOut}>
            <span className={styles.linkText + " mono"}>{url}</span>
            <div>
              <SecondaryButton onClick={() => copy("link")}>
                <Doodle name={copied === "link" ? "check" : "copy"} className={styles.icon} />
                {copied === "link" ? "Copied" : "Copy link"}
              </SecondaryButton>
            </div>
          </div>
        )}
        {url && <LinkQr url={url} />}
        {embed && (
          <>
            <h2>Add it to your site</h2>
            <p>Paste this where the button should appear. It opens this checkout in a new tab.</p>
            <div className={styles.linkOut}>
              <span className={styles.linkText + " mono"}>{embed}</span>
              <div>
                <SecondaryButton onClick={() => copy("embed")}>
                  <Doodle name={copied === "embed" ? "check" : "copy"} className={styles.icon} />
                  {copied === "embed" ? "Copied" : "Copy code"}
                </SecondaryButton>
              </div>
            </div>
          </>
        )}
        {url && copyFailed && (
          <StatusLine tone="error">Your browser blocked copying. Select the text above and copy it.</StatusLine>
        )}
      </Card>

      <Card title="Payments">
        {!ADDRESSES.mezherPay && <StatusLine tone="error">Payments are not live yet: MezherPay is not deployed.</StatusLine>}
        {ADDRESSES.mezherPay && !merchant && <p>Enter your address above to see payments to it.</p>}
        {merchant && payments.isLoading && <StatusLine tone="info">Loading payments…</StatusLine>}
        {merchant && payments.isError && (
          <StatusLine tone="error">Can&apos;t reach Mezo testnet. Retrying every 5 seconds.</StatusLine>
        )}
        {merchant && payments.data?.length === 0 && <p>No payments yet. Share a link to get paid.</p>}
        {merchant && payments.data && payments.data.length > 0 && <PaymentsTable logs={payments.data} />}
      </Card>
    </main>
  );
}
