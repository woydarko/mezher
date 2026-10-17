"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import styles from "./ui.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        Mezher
        <span className={styles.logoDot} aria-hidden />
      </Link>
      <nav className={styles.nav}>
        <Link href="/pay">Pay</Link>
        <Link href="/merchant">Merchant</Link>
      </nav>
      <ConnectButton
        showBalance={false}
        chainStatus="icon"
        accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
      />
    </header>
  );
}
