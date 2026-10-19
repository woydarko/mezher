"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { zeroAddress, type Address } from "viem";
import { useAccount, usePublicClient, useReadContracts } from "wagmi";
import { Card } from "@/components/Card";
import { CrayonBarChart, SplitBar, StatGrid, StatTile } from "@/components/Charts";
import { PaymentsTable } from "@/components/PaymentsTable";
import { RatioMeter } from "@/components/RatioMeter";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusLine } from "@/components/StatusLine";
import styles from "@/components/ui.module.css";
import { WalletButton } from "@/components/WalletButton";
import { formatMusd } from "@/lib/format";
import { ADDRESSES, MEZHER_PAY_DEPLOY_BLOCK, MEZO_TESTNET, musdAbi, priceFeedAbi, troveManagerAbi } from "@/lib/mezo";
import { fetchBlockTimes, fetchPaidLogs, type PaidLog } from "@/lib/paid-logs";
import { icrE18, maxBorrowWei, UI_ICR_FLOOR_E18 } from "@/lib/quote";
import { dailyTotals, liquidationPriceE18, summarize } from "@/lib/stats";
import d from "./dashboard.module.css";

const DAYS = 14;
const POLL_MS = 15_000;
const FEE_RATE_E18 = 10n ** 15n; // Mezo's 0.1% borrowing fee
const RECENT = 5;

type Filter = { merchant?: Address; payer?: Address };

/** Paid events for a filter plus the block times the daily chart needs, refreshed every 15 s. */
function usePayments(key: string, filter: Filter, enabled: boolean) {
  const publicClient = usePublicClient({ chainId: MEZO_TESTNET.id });
  return useQuery({
    queryKey: ["dashboard", key, filter.merchant, filter.payer],
    enabled: enabled && Boolean(publicClient && ADDRESSES.mezherPay),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const logs = await fetchPaidLogs(publicClient!, { ...filter, fromBlock: MEZHER_PAY_DEPLOY_BLOCK });
      const times = await fetchBlockTimes(
        publicClient!,
        logs.map((l) => l.blockNumber),
      );
      return { logs, times };
    },
  });
}

function days(logs: PaidLog[], times: Map<bigint, number>) {
  const points = logs.map((l) => ({ timestampSec: times.get(l.blockNumber) ?? 0, amountWei: l.amountWei }));
  return dailyTotals(points, DAYS, Math.floor(Date.now() / 1000));
}

function Loading({ q }: { q: { isLoading: boolean; isError: boolean } }) {
  if (q.isLoading) return <StatusLine tone="info">Reading payments from Mezo testnet…</StatusLine>;
  if (q.isError) return <StatusLine tone="error">Can&apos;t reach Mezo testnet. Retrying every 15 seconds.</StatusLine>;
  return null;
}

function MerchantTab({ address }: { address: Address }) {
  const q = usePayments("merchant", { merchant: address }, true);
  const s = q.data && summarize(q.data.logs);
  return (
    <>
      <Loading q={q} />
      {s && q.data && (
        <>
          <StatGrid>
            <StatTile label="Received" value={formatMusd(s.totalWei)} unit="MUSD" />
            <StatTile label="Payments" value={s.count} />
            <StatTile label="Average payment" value={formatMusd(s.avgWei)} unit="MUSD" />
            <StatTile label="Customers" value={s.uniquePayers} sub="unique payer wallets" />
          </StatGrid>
          <Card title={"Received per day, last " + DAYS + " days"}>
            <CrayonBarChart days={days(q.data.logs, q.data.times)} label="MUSD received per day" />
          </Card>
          <Card title="Where the money came from">
            <p>The part your customers didn&apos;t have in MUSD was borrowed against their BTC, straight to you.</p>
            <SplitBar fromBalanceWei={s.fromBalanceWei} borrowedWei={s.borrowedWei} />
          </Card>
          <Card title="Latest payments">
            {q.data.logs.length === 0 ? (
              <p>No payments yet. Share a payment link to get paid.</p>
            ) : (
              <PaymentsTable logs={q.data.logs.slice(0, RECENT)} />
            )}
            <div className={d.actions}>
              <Link href="/merchant" className={styles.secondary}>
                Create a payment link
              </Link>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function PayerTab({ address }: { address: Address }) {
  const q = usePayments("payer", { payer: address }, true);
  const reads = useReadContracts({
    allowFailure: false,
    query: { refetchInterval: POLL_MS },
    contracts: [
      { chainId: MEZO_TESTNET.id, address: ADDRESSES.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [address] },
      { chainId: MEZO_TESTNET.id, address: ADDRESSES.troveManager, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: [address] },
      { chainId: MEZO_TESTNET.id, address: ADDRESSES.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
      { chainId: MEZO_TESTNET.id, address: ADDRESSES.musd, abi: musdAbi, functionName: "balanceOf", args: [address] },
    ],
  });

  let trove: { collWei: bigint; debtWei: bigint } | null = null;
  if (reads.data && Number(reads.data[0]) === 1) {
    const [coll, principal, interest, , pendingPrincipal, pendingInterest] = reads.data[1];
    trove = { collWei: coll, debtWei: principal + interest + pendingPrincipal + pendingInterest };
  }
  const price = reads.data?.[2];
  const s = q.data && summarize(q.data.logs);

  return (
    <>
      <Card title="Your Trove">
        {reads.isLoading && <StatusLine tone="info">Reading your Trove…</StatusLine>}
        {reads.isError && <StatusLine tone="error">Can&apos;t reach Mezo testnet. Retrying every 15 seconds.</StatusLine>}
        {reads.data && !trove && (
          <>
            <p>You don&apos;t have a Trove yet. Open one from any checkout, or on Mezo.</p>
            <SecondaryButton href="https://testnet.mezo.org">Open a Trove on Mezo</SecondaryButton>
          </>
        )}
        {trove && price !== undefined && (
          <>
            <StatGrid>
              <StatTile label="Collateral" value={formatMusd(trove.collWei, 4)} unit="BTC" />
              <StatTile label="Debt" value={formatMusd(trove.debtWei)} unit="MUSD" />
              <StatTile
                label="Liquidation price"
                value={"$" + formatMusd(liquidationPriceE18(trove.collWei, trove.debtWei), 0)}
                sub={"BTC now $" + formatMusd(price, 0)}
              />
              <StatTile
                label="Can still borrow"
                value={formatMusd(maxBorrowWei({ status: 1, ...trove }, price, UI_ICR_FLOOR_E18, FEE_RATE_E18))}
                unit="MUSD"
                sub="before the 150% safe line"
              />
            </StatGrid>
            <RatioMeter nowE18={icrE18(trove.collWei, price, trove.debtWei)} afterE18={icrE18(trove.collWei, price, trove.debtWei)} />
          </>
        )}
        {reads.data && <p className={d.note}>MUSD in your wallet: {formatMusd(reads.data[3])} MUSD</p>}
      </Card>

      <Loading q={q} />
      {s && q.data && (
        <>
          <StatGrid>
            <StatTile label="Paid with Mezher" value={formatMusd(s.totalWei)} unit="MUSD" sub={s.count === 1 ? "1 payment" : s.count + " payments"} />
            <StatTile label="Borrowed to pay" value={formatMusd(s.borrowedWei)} unit="MUSD" />
            <StatTile
              label="Borrowing fees"
              value={"about " + formatMusd((s.borrowedWei * FEE_RATE_E18) / 10n ** 18n)}
              unit="MUSD"
              sub="Mezo's 0.1% on the borrowed part"
            />
            <StatTile label="Shops paid" value={s.uniqueMerchants} />
          </StatGrid>
          <Card title="Your payments">
            {q.data.logs.length === 0 ? (
              <p>No payments yet. Open a payment link from a shop to pay with your Bitcoin.</p>
            ) : (
              <PaymentsTable logs={q.data.logs.slice(0, RECENT)} show="merchant" />
            )}
          </Card>
        </>
      )}
    </>
  );
}

function PublicStats() {
  const q = usePayments("all", {}, true);
  const s = q.data && summarize(q.data.logs);
  return (
    <section className={d.public} aria-labelledby="public">
      <h2 id="public">Mezher on Mezo testnet</h2>
      <p className={d.note}>Every payment made through the MezherPay contract, read live from the chain.</p>
      <Loading q={q} />
      {s && q.data && (
        <>
          <StatGrid>
            <StatTile label="Volume" value={formatMusd(s.totalWei)} unit="MUSD" />
            <StatTile label="Payments" value={s.count} />
            <StatTile label="Payers" value={s.uniquePayers} />
            <StatTile label="Merchants" value={s.uniqueMerchants} />
          </StatGrid>
          <CrayonBarChart days={days(q.data.logs, q.data.times)} label="MUSD paid through Mezher per day" />
          <SplitBar fromBalanceWei={s.fromBalanceWei} borrowedWei={s.borrowedWei} />
        </>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<"merchant" | "payer">("merchant");
  const who = address ?? zeroAddress;

  return (
    <main className="page page-wide">
      <div className={d.head}>
        <h1>Dashboard</h1>
        {isConnected && (
          <div className={d.tabs} role="tablist" aria-label="Dashboard view">
            {(["merchant", "payer"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={"tab-" + t}
                aria-selected={tab === t}
                aria-controls={"panel-" + t}
                className={d.tab}
                onClick={() => setTab(t)}
              >
                {t === "merchant" ? "As merchant" : "As payer"}
              </button>
            ))}
          </div>
        )}
      </div>

      {!ADDRESSES.mezherPay && <StatusLine tone="error">MezherPay is not deployed yet.</StatusLine>}

      {!isConnected ? (
        <Card>
          <p>Connect your wallet to see what you received as a merchant and how your Trove is doing as a payer.</p>
          <WalletButton wide />
        </Card>
      ) : (
        <div id={"panel-" + tab} role="tabpanel" aria-labelledby={"tab-" + tab} className={d.panel}>
          {tab === "merchant" ? <MerchantTab address={who} /> : <PayerTab address={who} />}
        </div>
      )}

      <PublicStats />
    </main>
  );
}
