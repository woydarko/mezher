"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Doodle } from "./Doodle";
import styles from "./ui.module.css";
import { WalletButton } from "./WalletButton";

export function Header() {
  const path = usePathname();
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
        <nav className={styles.nav} aria-label="Main">
          {link("/pay", "Pay")}
          {link("/merchant", "Get paid")}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
