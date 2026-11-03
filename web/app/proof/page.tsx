"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { Card } from "@/components/Card";
import { StatGrid, StatTile } from "@/components/Charts";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusLine } from "@/components/StatusLine";
import styles from "@/components/ui.module.css";
import { formatMusd } from "@/lib/format";
import { ADDRESSES, explorerTx, MEZHER_PAY_DEPLOY_BLOCK, MEZO_TESTNET } from "@/lib/mezo";
import { fetchPaidLogs } from "@/lib/paid-logs";
import { fetchOpenedTxs, isTeam, summarizeProof, TEAM_WALLETS } from "@/lib/proof";

// The first Mezher contract (v1) payments, kept as evidence in docs/evidence.md.
const V1_TXS = [
  { label: "13 MUSD, all borrowed, from the live site", hash: "0x51e6aaf5e6795cb9804735c9bfbfa44567aa93566e48a8847f29594bb9527dd0" },
  { label: "11 MUSD, borrowed, local run", hash: "0xdb3bc15e4e65c0756eb81c49f91ee1490a568d2fbfc2601a9b5b6b86c2607eb5" },
] as const;

const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
const who = (a: Address) => (
  <>
    {short(a)} <strong>{isTeam(a) ? "team" : "outside"}</strong>
  </>
);

export default function ProofPage() {
  const client = usePublicClient({ chainId: MEZO_TESTNET.id });
  const q = useQuery({
    queryKey: ["proof"],
    enabled: Boolean(client && ADDRESSES.mezherPay),
    queryFn: async () => {
      const [logs, opened] = await Promise.all([
        fetchPaidLogs(client!, { fromBlock: MEZHER_PAY_DEPLOY_BLOCK }),
        fetchOpenedTxs(client!, MEZHER_PAY_DEPLOY_BLOCK),
      ]);
      return { logs, opened };
    },
  });
  const s = q.data && summarizeProof(q.data.logs, TEAM_WALLETS);

  return (
    <main className="page page-wide">
      <h1>Proof, live from the chain</h1>
      <p>
        Every payment through the MezherPay contract on Mezo testnet, read straight from the chain. Test BTC and MUSD
        only. &quot;Team&quot; means a wallet we control; anyone else is &quot;outside&quot;.
      </p>

      {!ADDRESSES.mezherPay && <StatusLine tone="error">MezherPay is not configured on this site yet.</StatusLine>}
      {q.isLoading && <StatusLine tone="info">Reading payments from Mezo testnet…</StatusLine>}
      {q.isError && (
        <>
          <StatusLine tone="error">Can&apos;t reach Mezo testnet.</StatusLine>
          <SecondaryButton onClick={() => void q.refetch()}>Retry</SecondaryButton>
        </>
      )}

      {s && q.data && (
        <>
          <StatGrid>
            <StatTile label="Payments" value={s.payments} />
            <StatTile label="Outside payers" value={s.outsidePayers.length} />
            <StatTile label="Outside merchants" value={s.outsideMerchants.length} />
            <StatTile label="Volume" value={formatMusd(s.volumeWei)} unit="MUSD" />
          </StatGrid>
          <Card title="Payments on Mezo testnet">
            {q.data.logs.length === 0 ? (
              <p>No payments yet.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Amount</th>
                    <th scope="col">Payer</th>
                    <th scope="col">Merchant</th>
                    <th scope="col">Split</th>
                    <th scope="col">Fee</th>
                    <th scope="col">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.logs.map((l) => (
                    <tr key={l.txHash + l.orderId}>
                      <td className="mono" data-label="Amount">
                        {formatMusd(l.amountWei)} MUSD
                      </td>
                      <td className="mono" data-label="Payer">
                        {who(l.payer)}
                      </td>
                      <td className="mono" data-label="Merchant">
                        {who(l.merchant)}
                      </td>
                      <td className="mono" data-label="Split">
                        {formatMusd(l.fromBalanceWei)} bal / {formatMusd(l.borrowedWei)} borrow
                        {q.data.opened.has(l.txHash) && " (opened a Trove)"}
                      </td>
                      <td className="mono" data-label="Fee">
                        {formatMusd(l.feeWei)} MUSD
                      </td>
                      <td data-label="Tx">
                        <a href={explorerTx(l.txHash)} target="_blank" rel="noreferrer">
                          {short(l.txHash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      <Card title="First version (v1) proof transactions">
        <p>Made with the earlier contract, so they are not in the list above.</p>
        <ul>
          {V1_TXS.map((t) => (
            <li key={t.hash}>
              <a href={explorerTx(t.hash)} target="_blank" rel="noreferrer">
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
