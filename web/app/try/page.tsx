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
import { BITCOIN_WALLET_MESSAGE, isBitcoinConnector, isSmartAccount } from "@/lib/checkout";
import { buildLink, randomOrder } from "@/lib/link";
import { formatMusd } from "@/lib/format";
import { ADDRESSES, MEZO_TESTNET, MIN_SPONSORED_WEI, musdAbi, troveManagerAbi } from "@/lib/mezo";
import { isDemoMerchant, tryNote, tryScenarios } from "@/lib/try";

const DEMO_MERCHANT = process.env.NEXT_PUBLIC_DEMO_MERCHANT;
const MEZO_FAUCET = "https://faucet.test.mezo.org/";

function GetBtc() {
  return (
    <Card title="1. Get test BTC">
      <p>
        Opening a Trove needs test BTC as collateral, plus a little for gas. The smallest Trove carries about 2,000 MUSD
        of debt and must stay above a 150% ratio, so request enough to cover that. Testnet only: it has no real value.
      </p>
      <SecondaryButton href={MEZO_FAUCET}>Open the Mezo faucet</SecondaryButton>
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
  const troveStatus = reads.data ? Number(reads.data[0]) : 0;
  const isMerchant = isDemoMerchant(address, DEMO_MERCHANT);
  const scenarios = reads.data && !isMerchant ? tryScenarios(troveStatus, reads.data[1]) : [];
  const note = reads.data && !isMerchant ? tryNote(troveStatus, reads.data[1]) : undefined;
  const [linkError, setLinkError] = useState<string>();

  // the order id is made on click, so going back to this page never reuses a settled order
  function pay(amount: string) {
    if (!DEMO_MERCHANT) return;
    const link = buildLink(window.location.origin, { to: DEMO_MERCHANT, amount, order: randomOrder(), label: "Mezher try" });
    if (link.ok) window.location.assign(link.url);
    else setLinkError(link.message);
  }

  return (
    <Card title="2. Make a payment">
      {reads.isLoading && <StatusLine tone="info">Reading your wallet from Mezo testnet…</StatusLine>}
      {reads.isError && <StatusLine tone="error">Can&apos;t reach Mezo testnet. Retrying every 15 seconds.</StatusLine>}
      {isMerchant && (
        <StatusLine tone="info">
          This wallet is the demo merchant. Paying yourself proves nothing and only loses the fee, so use another wallet to try a payment.
        </StatusLine>
      )}
      {scenarios.map((s) => (
        <div key={s.kind}>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
          {BigInt(s.amount) * 10n ** 18n < MIN_SPONSORED_WEI && (
            <p>Payments under {formatMusd(MIN_SPONSORED_WEI)} MUSD use your own gas instead of ours.</p>
          )}
          {DEMO_MERCHANT && <PrimaryButton onClick={() => pay(s.amount)}>Pay {s.amount} MUSD</PrimaryButton>}
        </div>
      ))}
      {note && <p>{note}</p>}
      {reads.data && !DEMO_MERCHANT && <StatusLine tone="error">Demo merchant not configured.</StatusLine>}
      {linkError && <StatusLine tone="error">{linkError}</StatusLine>}
    </Card>
  );
}

export default function TryPage() {
  const { address, isConnected, connector } = useAccount();
  const publicClient = usePublicClient({ chainId: MEZO_TESTNET.id });
  const smartAccount = useQuery({
    queryKey: ["smart-account", address],
    enabled: Boolean(address && publicClient),
    queryFn: () => isSmartAccount(publicClient!, address!),
  });

  return (
    <main className="page page-wide">
      <h1>Try Mezher with test BTC</h1>
      <p>
        This is Mezo testnet: test BTC and test MUSD with no real value. You pay a demo merchant, and whatever your MUSD
        balance does not cover is borrowed against your BTC, straight to the merchant. You can read everything here
        without a wallet; connect one to get steps made for it.
      </p>

      {isConnected && isBitcoinConnector(connector?.type) ? (
        <Card title="Switch to an EVM wallet">
          <p>{BITCOIN_WALLET_MESSAGE}</p>
        </Card>
      ) : isConnected && smartAccount.data === true ? (
        <Card title="Switch to a regular wallet">
          <p>
            This wallet is a smart account, and it can&apos;t sign Mezher payments. Switch to a regular EVM wallet
            account, then come back here.
          </p>
        </Card>
      ) : isConnected && address && smartAccount.data === false ? (
        <>
          <GetBtc />
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
            <li>Get test BTC from the Mezo faucet.</li>
            <li>
              Pay 20 MUSD to a demo merchant. With no Trove, checkout opens one for you. With a Trove and enough MUSD,
              it pays from your balance, or part balance and part borrowed. With a little MUSD, it uses that first and borrows the rest. With none, it
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
