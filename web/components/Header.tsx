"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { Doodle } from "./Doodle";
import styles from "./ui.module.css";
import { WalletButton } from "./WalletButton";

export function Header() {
  const path = usePathname();
  const { isConnected } = useAccount();
  const link = (href: string, label: string) => (
    <Link href={href} className={styles.navLink} aria-current={path === href ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <header className={styles.header}>
      <div className={styles.navRow}>
        <Link href="/" className={styles.logo} aria-label="Mezher home">
          <Doodle name="coin" />
          <span>Mezher</span>
        </Link>
        {/* the app pages need a wallet (ConnectGate), so their links appear once one is connected */}
        {isConnected ? (
          <nav className={styles.nav} aria-label="Main">
            {link("/pay", "Pay")}
            {link("/merchant", "Get paid")}
            {link("/dashboard", "Dashboard")}
          </nav>
        ) : (
          <span className={styles.navSpacer} />
        )}
        <WalletButton />
      </div>
    </header>
  );
}
