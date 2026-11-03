"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusLine } from "@/components/StatusLine";
import styles from "@/components/ui.module.css";
import { WalletButton } from "@/components/WalletButton";
import { buildLink, randomOrder } from "@/lib/link";
import { ADDRESSES, explorerTx, MEZO_TESTNET, musdAbi, troveManagerAbi } from "@/lib/mezo";
import { sponsored, tryScenario } from "@/lib/try";

const DEMO_MERCHANT = process.env.NEXT_PUBLIC_DEMO_MERCHANT;
const MEZO_FAUCET = "https://faucet.test.mezo.org/";

const FAUCET_ERRORS: Record<string, string> = {
  already_claimed: "This wallet already claimed from our faucet.",
  already_funded: "This wallet already has enough test BTC, so you can skip this step.",
  rate_limited: "Too many tries from your network. Wait a minute and try again.",
  invalid_input: "That wallet address was not accepted.",
};

function Faucet({ address }: { address: string }) {
  const [state, setState] = useState<{ busy: boolean; hash?: string; error?: string; empty?: boolean }>({ busy: false });

  async function claim() {
    setState({ busy: true });
    try {
      const res = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
      const body = (await res.json()) as { hash?: string; error?: string };
      if (res.ok && body.hash) setState({ busy: false, hash: body.hash });
      else if (body.error === "faucet_empty") setState({ busy: false, empty: true });
      else setState({ busy: false, error: FAUCET_ERRORS[body.error ?? ""] ?? "The faucet could not send right now." });
    } catch {
      setState({ busy: false, error: "Can't reach the faucet. Try again." });
    }
  }

  return (
    <Card title="1. Get test BTC">
      <p>
        Opening a Trove needs about 0.05 test BTC as collateral, plus a little for gas. Testnet only: it has no real
        value.
      </p>
      <PrimaryButton onClick={claim} loading={state.busy} loadingLabel="Sending…">
        Get test BTC
      </PrimaryButton>
      {state.hash && (
        <StatusLine tone="success" href={explorerTx(state.hash as `0x${string}`)}>
          Test BTC sent.
        </StatusLine>
      )}
      {state.error && <StatusLine tone="error">{state.error}</StatusLine>}
      {state.empty && (
        <>
          <StatusLine tone="error">Our faucet is empty right now.</StatusLine>
          <p>Request test BTC (about 0.06) from the Mezo faucet instead, then come back.</p>
          <SecondaryButton href={MEZO_FAUCET}>Open the Mezo faucet</SecondaryButton>
        </>
      )}
    </Card>
  );
}

function Scenario({ address }: { address: `0x${string}` }) {
  const reads = useReadContracts({
    allowFailure: false,
    query: { refetchInterval: 15_000 },
    contracts: [
      { chainId: MEZO_TESTNET.id, address: ADDRESSES.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [address] },
      { chainId: MEZO_TESTNET.id, address: ADDRESSES.musd, abi: musdAbi, functionName: "balanceOf", args: [address] },
    ],
  });
  const s = reads.data ? tryScenario(Number(reads.data[0]) === 1, reads.data[1]) : null;
  // a fresh order id per scenario, so every try is a new payment
  const link = useMemo(
    () => (s && DEMO_MERCHANT ? buildLink(window.location.origin, { to: DEMO_MERCHANT, amount: s.amount, order: randomOrder(), label: "Mezher try" }) : null),
    [s?.kind, s?.amount], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <Card title="2. Make a payment">
      {reads.isLoading && <StatusLine tone="info">Reading your wallet from Mezo testnet…</StatusLine>}
      {reads.isError && <StatusLine tone="error">Can&apos;t reach Mezo testnet. Retrying every 15 seconds.</StatusLine>}
      {s && (
        <>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
          {!sponsored(s.amount) && <p>Payments under 10 MUSD use your own gas instead of ours.</p>}
          {!DEMO_MERCHANT && <StatusLine tone="error">Demo merchant not configured.</StatusLine>}
          {link && !link.ok && <StatusLine tone="error">{link.message}</StatusLine>}
          {link?.ok && (
            <div>
              <a href={link.url} className={styles.primary}>
                Pay {s.amount} MUSD
              </a>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function TryPage() {
  const { address, isConnected } = useAccount();

  return (
    <main className="page page-wide">
      <h1>Try Mezher in two minutes</h1>
      <p>
        This is Mezo testnet: test BTC and test MUSD with no real value. You pay a demo merchant, and whatever your MUSD
        balance does not cover is borrowed against your BTC, straight to the merchant. You can read everything here
        without a wallet; connect one to get steps made for it.
      </p>

      {isConnected && address ? (
        <>
          <Faucet address={address} />
          <Scenario address={address} />
        </>
      ) : (
        <Card title="What you will do">
          <ol>
            <li>Get test BTC from our faucet (or the Mezo faucet).</li>
            <li>
              Pay 12 MUSD to a demo merchant. With no Trove, checkout opens one for you. With a Trove and enough MUSD,
              it pays from your balance. With a little MUSD, it uses that first and borrows the rest. With none, it
              borrows all of it.
            </li>
            <li>
              See the payment on <Link href="/proof">the live proof page</Link>.
            </li>
          </ol>
          <WalletButton wide />
        </Card>
      )}

      <p>
        <Link href="/proof">See every payment read live from the chain</Link>
      </p>
    </main>
  );
}
