"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useAccount, usePublicClient, useReadContracts } from "wagmi";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { StatusLine } from "@/components/StatusLine";
import { WalletButton } from "@/components/WalletButton";
import { isSmartAccount } from "@/lib/checkout";
import { buildLink, randomOrder } from "@/lib/link";
import { ADDRESSES, explorerTx, MEZO_TESTNET, musdAbi, troveManagerAbi } from "@/lib/mezo";
import { sponsored, tryScenario } from "@/lib/try";

const DEMO_MERCHANT = process.env.NEXT_PUBLIC_DEMO_MERCHANT;
const MEZO_FAUCET = "https://faucet.test.mezo.org/";

const FAUCET_ERRORS: Record<string, string> = {
  already_claimed: "This wallet already claimed from our faucet. If it has no test BTC, use the Mezo faucet below.",
  already_funded: "This wallet already has enough test BTC, so you can skip this step.",
  rate_limited: "Too many tries from your network. Wait a minute and try again.",
  invalid_input: "That wallet address was not accepted.",
};

function Faucet({ address }: { address: string }) {
  const [state, setState] = useState<{ busy: boolean; hash?: string; error?: string; fallback?: boolean }>({ busy: false });

  async function claim() {
    setState({ busy: true });
    try {
      const res = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
      const body = (await res.json()) as { hash?: string; error?: string };
      if (res.ok && body.hash) setState({ busy: false, hash: body.hash });
      else if (body.error === "faucet_empty") setState({ busy: false, error: "Our faucet is empty right now.", fallback: true });
      else if (body.error === "faucet_unavailable")
        setState({ busy: false, error: "The faucet could not send right now. Try again in a minute.", fallback: true });
      else
        setState({
          busy: false,
          error: FAUCET_ERRORS[body.error ?? ""] ?? "The faucet could not send right now.",
          fallback: body.error === "already_claimed",
        });
    } catch {
      setState({ busy: false, error: "Can't reach the faucet. Try again." });
    }
  }

  return (
    <Card title="1. Get test BTC">
      <p>
        Opening a Trove needs test BTC as collateral, plus a little for gas. Testnet only: it has no real value.
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
      {state.fallback && (
        <>
          <p>Request test BTC from the Mezo faucet instead, then come back.</p>
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
  const [linkError, setLinkError] = useState<string>();

  // the order id is made on click, so going back to this page never reuses a settled order
  function pay() {
    if (!s || !DEMO_MERCHANT) return;
    const link = buildLink(window.location.origin, { to: DEMO_MERCHANT, amount: s.amount, order: randomOrder(), label: "Mezher try" });
    if (link.ok) window.location.assign(link.url);
    else setLinkError(link.message);
  }

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
          {linkError && <StatusLine tone="error">{linkError}</StatusLine>}
          {DEMO_MERCHANT && <PrimaryButton onClick={pay}>Pay {s.amount} MUSD</PrimaryButton>}
        </>
      )}
    </Card>
  );
}

export default function TryPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: MEZO_TESTNET.id });
  const smartAccount = useQuery({
    queryKey: ["smart-account", address],
    enabled: Boolean(address && publicClient),
    queryFn: () => isSmartAccount(publicClient!, address!),
  });

  return (
    <main className="page page-wide">
      <h1>Try Mezher in two minutes</h1>
      <p>
        This is Mezo testnet: test BTC and test MUSD with no real value. You pay a demo merchant, and whatever your MUSD
        balance does not cover is borrowed against your BTC, straight to the merchant. You can read everything here
        without a wallet; connect one to get steps made for it.
      </p>

      {isConnected && smartAccount.data === true ? (
        <Card title="Switch to a regular wallet">
          <p>
            This wallet is a smart account, and it can&apos;t sign Mezher payments. Switch to a regular EVM wallet
            account, then come back here.
          </p>
        </Card>
      ) : isConnected && address && smartAccount.data === false ? (
        <>
          <Faucet address={address} />
          <Scenario address={address} />
        </>
      ) : isConnected ? (
        smartAccount.isError ? (
          <StatusLine tone="error">Can&apos;t check your wallet on Mezo testnet. Reload to retry.</StatusLine>
        ) : (
          <StatusLine tone="info">Checking your wallet…</StatusLine>
        )
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
