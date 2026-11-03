"use client";

import Link from "next/link";
import { DemoMockup } from "@/components/DemoMockup";
import { Doodle } from "@/components/Doodle";
import { FaqItem } from "@/components/FaqItem";
import { HeroScenery } from "@/components/HeroScenery";
import { Reveal } from "@/components/Reveal";
import styles from "@/components/ui.module.css";
import l from "./landing.module.css";

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
    title: "Gas covered from 16 MUSD",
    body: "On payments of 16 MUSD and up, our relayer sends the payment and pays the network fee. You just sign. Smaller ones, and opening a Trove at checkout, use your own gas.",
  },
];

const FAQ = [
  {
    q: "What's a Trove?",
    a: "Your loan on Mezo: you lock BTC and borrow MUSD (a dollar stablecoin) against it. Mezher borrows a little more from it, straight to the shop, only when your wallet balance is short.",
  },
  {
    q: "What does it cost?",
    a: "Mezo's 0.1% borrowing fee on the part you borrow, plus your Trove's usual interest. Mezher adds nothing on top. If your balance covers the whole payment, nothing is borrowed. Gas is covered from 16 MUSD up; below that you pay the small network fee yourself.",
  },
  {
    q: "Do I need MUSD in my wallet?",
    a: "No. Whatever your balance covers is used first; the rest is borrowed from your Trove. With 0 MUSD the whole payment is borrowed. No Trove yet? Checkout can open one from your BTC in the same payment.",
  },
  {
    q: "Is this on mainnet?",
    a: "Not yet. Mezher runs on Mezo testnet, so test BTC and MUSD have no real value. Try it without worrying.",
  },
];

export default function Home() {
  // /try reads the wallet and builds a fresh order for it.
  const demoHref = "/try";

  return (
    <main className="page page-landing">
      <section className={l.hero}>
        <div className={l.heroText}>
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
            transaction. No selling. We cover the gas on payments of 16 MUSD and up.
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
            <FaqItem key={f.q} q={f.q} a={f.a} className={l.qa} />
          ))}
        </div>
      </section>

      <Reveal as="section" className={styles.card + " " + l.final}>
        <h2>Got test BTC? Pay for a test coffee.</h2>
        <p>Connect a wallet on Mezo testnet and run the 20 MUSD coffee checkout.</p>
        <Link href={demoHref} className={styles.primary + " " + l.finalCta}>
          Try the Demo
        </Link>
      </Reveal>
    </main>
  );
}
