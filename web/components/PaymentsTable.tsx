import { ExternalLink } from "lucide-react";
import { formatMusd } from "@/lib/format";
import { explorerTx } from "@/lib/mezo";
import type { PaidLog } from "@/lib/paid-logs";
import styles from "./ui.module.css";

const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);

export function PaymentsTable({ logs }: { logs: PaidLog[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Amount</th>
          <th scope="col">Order</th>
          <th scope="col">Payer</th>
          <th scope="col">Split</th>
          <th scope="col">
            <span className={styles.srOnly}>Transaction</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {logs.map((l) => (
          <tr key={l.txHash + l.orderId}>
            <td className="mono">{formatMusd(l.amountWei)} MUSD</td>
            <td className="mono">{l.orderId.replace(/^0x0*/, "").slice(0, 8)}</td>
            <td className="mono">{short(l.payer)}</td>
            <td className="mono">
              {formatMusd(l.fromBalanceWei)} bal / {formatMusd(l.borrowedWei)} borrow
            </td>
            <td>
              <a href={explorerTx(l.txHash)} target="_blank" rel="noreferrer" aria-label="View on explorer">
                <ExternalLink size={14} aria-hidden />
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
