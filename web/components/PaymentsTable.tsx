import { formatMusd } from "@/lib/format";
import { explorerTx } from "@/lib/mezo";
import type { PaidLog } from "@/lib/paid-logs";
import { Doodle } from "./Doodle";
import styles from "./ui.module.css";

const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);

/** `show` picks the other party: a merchant wants to see payers, a payer wants to see merchants. */
export function PaymentsTable({ logs, show = "payer" }: { logs: PaidLog[]; show?: "payer" | "merchant" }) {
  const party = show === "payer" ? "Payer" : "Merchant";
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Amount</th>
          <th scope="col">Order</th>
          <th scope="col">{party}</th>
          <th scope="col">Split</th>
          <th scope="col">
            <span className={styles.srOnly}>Transaction</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {/* data-label feeds the stacked mobile layout */}
        {logs.map((l) => (
          <tr key={l.txHash + l.orderId}>
            <td className="mono" data-label="Amount">
              {formatMusd(l.amountWei)} MUSD
            </td>
            <td className="mono" data-label="Order">
              {/* links carry ≥ 16 hex chars, so keep 16 after stripping the bytes32 padding */}
              {l.orderId.slice(2).replace(/^0+/, "").padStart(16, "0").slice(0, 8)}
            </td>
            <td className="mono" data-label={party}>
              {short(show === "payer" ? l.payer : l.merchant)}
            </td>
            <td className="mono" data-label="Split">
              {formatMusd(l.fromBalanceWei)} bal / {formatMusd(l.borrowedWei)} borrow
            </td>
            <td data-label="Tx">
              <a href={explorerTx(l.txHash)} target="_blank" rel="noreferrer" aria-label="View on explorer">
                <Doodle name="external" className={styles.icon} />
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
