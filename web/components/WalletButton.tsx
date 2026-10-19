"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import styles from "./ui.module.css";

/** RainbowKit's connect flow with a crayon button; the modal itself stays RainbowKit's. */
export function WalletButton({ wide = false }: { wide?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        const cls = (primary: boolean) =>
          (primary ? styles.primary : styles.secondary) + (wide ? "" : " " + styles.wallet);
        if (!mounted) return <span className={styles.srOnly}>Loading wallet</span>;
        if (!account || !chain) {
          return (
            <button type="button" className={cls(true)} onClick={openConnectModal}>
              Connect wallet
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button type="button" className={cls(true)} onClick={openChainModal}>
              Wrong network
            </button>
          );
        }
        return (
          <button type="button" className={cls(false) + " mono"} onClick={openAccountModal}>
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
