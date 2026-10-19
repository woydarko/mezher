"use client";

import Link from "next/link";
import { useState } from "react";
import { DemoMockup } from "@/components/DemoMockup";
import { Doodle } from "@/components/Doodle";
import { HeroScenery } from "@/components/HeroScenery";
import { Reveal } from "@/components/Reveal";
import styles from "@/components/ui.module.css";
import { buildLink, randomOrder } from "@/lib/link";
import l from "./landing.module.css";

const DEMO_MERCHANT = process.env.NEXT_PUBLIC_DEMO_MERCHANT;

const SAFETY = [
  {
    title: "Never below 150%",
    body: "If paying would push your Trove's ratio under 150%, the MezherPay contract refuses the whole payment.",
  },
  {
    title: "Only to the shop you signed for",
    body: "Your borrow signature names the merchant. Nobody can send it anywhere else, not even our relayer.",
  },
  {
    title: "No gas when you borrow",
    body: "When part of the payment is borrowed, our relayer sends it and pays the network fee. You just sign.",
  },
];

const FAQ = [
  {
    q: "What's a Trove?",
    a: "Your loan on Mezo: you lock BTC and borrow MUSD (a dollar stablecoin) against it. Mezher borrows a little more from it, straight to the shop, only when your wallet balance is short.",
  },
  {
    q: "What does it cost?",
    a: "Mezo's 0.1% borrowing fee on the part you borrow, plus your Trove's usual interest. Mezher adds nothing on top. If your balance covers the whole payment, nothing is borrowed and you pay the small network fee yourself.",
  },
  {
    q: "Do I need MUSD in my wallet?",
    a: "No, but you need a Trove on Mezo. Whatever your balance covers is used first; the rest is borrowed. With 0 MUSD the whole payment is borrowed.",
  },
  {
    q: "Is this on mainnet?",
    a: "Not yet. Mezher runs on Mezo testnet, so test BTC and MUSD have no real value. Try it without worrying.",
  },
];

export default function Home() {
  // Fresh order id per visit so the demo never lands on "Already paid".
  const [demoHref] = useState(() => {
    if (!DEMO_MERCHANT) return "/merchant";
    const built = buildLink("", { to: DEMO_MERCHANT, amount: "12", order: randomOrder(), label: "Coffee" });
    return built.ok ? built.url : "/merchant";
  });

  return (
    <main className="page page-landing">
      <section className={l.hero}>
        <div className={l.heroText}>
          <span className={l.kicker}>Bitcoin-backed checkout on Mezo</span>
          <h1>
            Pay with your Bitcoin.{" "}
            <span className={l.circled}>
              Keep
              <Doodle name="circle" className={l.circle} />
            </span>{" "}
            your Bitcoin.
          </h1>
          <p className={l.lead}>
            Short on MUSD? Mezher borrows only the missing part against your BTC, straight to the merchant, in one
            transaction. No selling, and no gas for the part you borrow.
          </p>
          <div className={l.ctas}>
            <Link href={demoHref} className={styles.primary}>
              Try the Demo
            </Link>
            <Link href="/merchant" className={styles.secondary}>
              I&apos;m a merchant
            </Link>
          </div>
        </div>
        <HeroScenery className={l.scenery} />
      </section>

      <section className={l.section} aria-labelledby="watch">
        <h2 id="watch" className={l.sectionTitle}>
          How a payment works
          <Doodle name="underline" className={l.underline} />
        </h2>
        {/* The only scroll-triggered reveal besides the final CTA: it is also what starts the demo. */}
        <Reveal>
          <DemoMockup />
        </Reveal>
      </section>

      <section className={l.section + " " + l.sectionSafety} aria-labelledby="safe">
        <h2 id="safe" className={l.sectionTitle}>
          Why it won&apos;t bite you
          <Doodle name="underline" className={l.underline} />
        </h2>
        <ul className={l.safety}>
          {SAFETY.map((s) => (
            <li key={s.title}>
              <Doodle name="check" className={l.check} />
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={l.section} aria-labelledby="faq">
        <h2 id="faq" className={l.sectionTitle}>
          Questions people ask
          <Doodle name="underline" className={l.underline} />
        </h2>
        <div className={l.faq}>
          {FAQ.map((f) => (
            <details key={f.q} className={l.qa}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Reveal as="section" className={styles.card + " " + l.final}>
        <h2>Got a Trove? Pay for a test coffee.</h2>
        <p>Connect a wallet on Mezo testnet and run the 12 MUSD coffee checkout.</p>
        <Link href={demoHref} className={styles.primary + " " + l.finalCta}>
          Try the Demo
        </Link>
      </Reveal>
    </main>
  );
}
