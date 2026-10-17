"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { PaymentsTable } from "@/components/PaymentsTable";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusLine } from "@/components/StatusLine";
import styles from "@/components/ui.module.css";
import { buildLink, randomOrder } from "@/lib/link";
import { ADDRESSES, MEZHER_PAY_DEPLOY_BLOCK, MEZO_TESTNET } from "@/lib/mezo";
import { fetchPaidLogs } from "@/lib/paid-logs";

const POLL_MS = 5_000;
const COPIED_MS = 2_000;

type Errors = Partial<Record<"to" | "amount" | "order" | "label", string>>;

export default function MerchantPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: MEZO_TESTNET.id });
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [order, setOrder] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrder(randomOrder()), []);
  useEffect(() => {
    if (address) setTo((current) => current || address);
  }, [address]);

  const merchant = isAddress(to) ? (to as Address) : undefined;
  const payments = useQuery({
    queryKey: ["paid", merchant],
    enabled: Boolean(merchant && publicClient && ADDRESSES.mezherPay),
    refetchInterval: POLL_MS,
    queryFn: () => fetchPaidLogs(publicClient!, { merchant: merchant!, fromBlock: MEZHER_PAY_DEPLOY_BLOCK }),
  });

  function create() {
    const result = buildLink(window.location.origin, { to, amount, order, label: label || undefined });
    if (!result.ok) {
      setErrors({ [result.field]: result.message });
      setUrl(null);
      return;
    }
    setErrors({});
    setUrl(result.url);
    setCopied(false);
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <main className="page page-wide">
      <Card>
        <h1>Get paid in MUSD</h1>
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
        {url && (
          <div className={styles.linkOut}>
            <span className={styles.linkText + " mono"}>{url}</span>
            <div>
              <SecondaryButton onClick={copy}>
                {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                {copied ? "Copied" : "Copy link"}
              </SecondaryButton>
            </div>
          </div>
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
