"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/components/ui.module.css";
import { buildLink, randomOrder } from "@/lib/link";

const DEMO_MERCHANT = process.env.NEXT_PUBLIC_DEMO_MERCHANT;

export default function Home() {
  // Fresh order id per visit so the demo never lands on "Already paid".
  const [demoHref] = useState(() => {
    if (!DEMO_MERCHANT) return "/merchant";
    const built = buildLink("", { to: DEMO_MERCHANT, amount: "12", order: randomOrder(), label: "Coffee" });
    return built.ok ? built.url : "/merchant";
  });

  return (
    <main className="page">
      <h1>Pay with your Bitcoin. Keep your Bitcoin.</h1>
      <p>Borrow only what your MUSD balance doesn&apos;t cover, straight to the merchant. No gas, one click.</p>
      <Link href={demoHref} className={styles.primary}>
        Try the demo checkout
      </Link>
      <Link href="/merchant" className={styles.secondary}>
        I&apos;m a merchant
      </Link>
    </main>
  );
}
