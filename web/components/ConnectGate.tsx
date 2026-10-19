"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { Card } from "./Card";
import { Doodle } from "./Doodle";
import { StatusLine } from "./StatusLine";
import g from "./gate.module.css";
import { WalletButton } from "./WalletButton";

/** Pages anyone can open without a wallet: the landing page and the terms. */
export const PUBLIC_PATHS = ["/", "/terms"];

export function useIsPublicPath(): boolean {
  return PUBLIC_PATHS.includes(usePathname());
}

/** Everything except the public pages asks for a connected wallet first. */
export function ConnectGate({ children }: { children: ReactNode }) {
  const isPublic = useIsPublicPath();
  const { status } = useAccount();

  if (isPublic || status === "connected") return <>{children}</>;

  return (
    <main className="page page-center">
      <Card>
        <Doodle name="coin" className={g.coin} />
        {status === "reconnecting" || status === "connecting" ? (
          <StatusLine tone="info">Checking your wallet…</StatusLine>
        ) : (
          <>
            <h1>Connect your wallet first</h1>
            <p>
              Mezher works with your wallet on Mezo testnet: paying, creating payment links and your dashboard all need
              it.
            </p>
            <WalletButton wide />
          </>
        )}
      </Card>
    </main>
  );
}
