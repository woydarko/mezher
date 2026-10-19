"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConfig, mezoTestnet } from "@mezo-org/passport";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { ConnectGate } from "@/components/ConnectGate";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

// Wallet modal in the crayon palette (globals.css tokens) and the same handwriting font.
const walletTheme = {
  ...lightTheme({ accentColor: "#F7931A", accentColorForeground: "#1F1B16", borderRadius: "large" }),
  fonts: { body: "var(--font-shantell), system-ui, sans-serif" },
};

const wagmiConfig = getConfig({
  appName: "Mezher",
  mezoNetwork: "testnet",
  // RainbowKit throws on an empty id. Injected wallets (MetaMask) never use it; WalletConnect QR wallets
  // need a real id from cloud.reown.com.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "mezher-no-walletconnect",
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={mezoTestnet} theme={walletTheme}>
          <Header />
          <ConnectGate>{children}</ConnectGate>
          <Footer />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
