import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { ADDRESSES, explorerAddress } from "@/lib/mezo";

export const metadata: Metadata = { title: "Mezher: testnet terms and privacy" };

export default function TermsPage() {
  return (
    <main className="page page-wide">
      <Card>
        <h1>Testnet terms</h1>
        <p>
          Mezher is a hackathon project running on Mezo testnet. Test BTC and MUSD have no real value, and nothing here is
          financial advice.
        </p>
        <h2>What you agree to</h2>
        <ul>
          <li>
            Mezher is provided as is, without any warranty. The MezherPay contract has had an AI-assisted review only,
            not a professional audit.
          </li>
          <li>
            When you sign a borrow, you allow that exact amount to be borrowed from your Trove and paid to the merchant
            named in the link. Watch your Trove ratio: Mezo can liquidate a Trove that drops too low.
          </li>
          <li>MUSD, Troves and the borrow itself are Mezo&apos;s contracts. Mezo can upgrade them, and their rules apply.</li>
          <li>
            MezherPay has no owner and holds no funds between payments
            {ADDRESSES.mezherPay && (
              <>
                {" "}
                (
                <a href={explorerAddress(ADDRESSES.mezherPay)} target="_blank" rel="noreferrer">
                  contract source
                </a>
                )
              </>
            )}
            .
          </li>
        </ul>
      </Card>

      <Card>
        <h2>Privacy</h2>
        <ul>
          <li>
            No accounts, no sign-up, and Mezher sets no cookies. Your wallet library remembers the connection in your
            browser.
          </li>
          <li>
            Payments are public on the Mezo testnet blockchain, including your address, the merchant&apos;s address, the
            amounts and the order id. Link labels are not stored on-chain, but anyone with the link can read them.
          </li>
          <li>
            Our gas relay logs only the route, the response status, the first 6 characters of your address and the
            transaction hash. To limit abuse it keeps your address and IP in server memory (never on disk) while that
            server instance runs.
          </li>
          <li>Your browser talks to the Mezo testnet RPC directly to read balances and Troves.</li>
        </ul>
      </Card>
    </main>
  );
}
