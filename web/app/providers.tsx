"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConfig, mezoTestnet } from "@mezo-org/passport";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { Header } from "@/components/Header";

const wagmiConfig = getConfig({
  appName: "Mezher",
  mezoNetwork: "testnet",
  // Passport's type requires it; injected wallets (MetaMask) work without a real WalletConnect id.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={mezoTestnet} theme={darkTheme({ accentColor: "#F7931A" })}>
          <Header />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
