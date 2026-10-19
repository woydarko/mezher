"use client";

import Link from "next/link";
import { useState } from "react";
import { Doodle } from "@/components/Doodle";
import { Reveal } from "@/components/Reveal";
import styles from "@/components/ui.module.css";
import { buildLink, randomOrder } from "@/lib/link";
import l from "./landing.module.css";

const DEMO_MERCHANT = process.env.NEXT_PUBLIC_DEMO_MERCHANT;

const STEPS = [
  {
    title: "Shop sends a link",
    body: "The merchant types an amount on Mezher and shares the link. No account, no setup.",
  },
  {
    title: "You sign, that's it",
    body: "Open the link, see exactly what comes from your balance and what gets borrowed. Sign once or twice.",
  },
  {
    title: "Shop gets paid, you keep your BTC",
    body: "The merchant receives the full amount in MUSD in one transaction. Your Bitcoin stays locked in your Trove.",
  },
];

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
    a: "Mezo's 0.1% borrowing fee on the part you borrow, plus your Trove's usual interest. Mezher adds nothing on top.",
  },
  {
    q: "Do I need MUSD in my wallet?",
    a: "No. Whatever your balance covers is used first; the rest is borrowed. With 0 MUSD the whole payment is borrowed.",
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
    const built = buildLink("", {
      to: DEMO_MERCHANT,
      amount: "12",
      order: randomOrder(),
      label: "Coffee",
    });
    return built.ok ? built.url : "/merchant";
  });

  return (
    <main className="page page-landing">
      <section className={l.hero}>
        <Reveal className={l.heroText}>
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
            Short on MUSD? Mezher borrows only the missing part against your
            BTC, straight to the merchant, in one transaction. No selling, no
            gas.
          </p>
          <div className={l.ctas}>
            <Link href={demoHref} className={styles.primary}>
              Try the Demo
            </Link>
            <Link href="/merchant" className={styles.secondary}>
              I&apos;m a merchant
            </Link>
          </div>
        </Reveal>

        <Reveal delayMs={180}>
          <figure
            className={l.sketch}
            aria-label="Example: 5 MUSD from your wallet plus 7 MUSD borrowed against your BTC makes 12 MUSD for the merchant"
          >
            <div className={l.part}>
              <span className={l.amount + " mono"}>5 MUSD</span>
              <span>from your wallet</span>
            </div>
            <span className={l.op} aria-hidden>
              +
            </span>
            <div className={l.part + " " + l.partBorrow}>
              <Doodle name="coin" className={l.partCoin} />
              <span className={l.amount + " mono"}>7 MUSD</span>
              <span>borrowed against your BTC</span>
            </div>
            <Doodle name="arrow" className={l.arrow} />
            <div className={l.part + " " + l.partTotal}>
              <Doodle name="star" className={l.partStar} />
              <span className={l.amount + " mono"}>12 MUSD</span>
              <span>lands with the merchant</span>
            </div>
            <figcaption className={l.caption}>
              Your BTC never leaves your Trove.
            </figcaption>
          </figure>
        </Reveal>
      </section>

      <section className={l.section} aria-labelledby="how">
        <Reveal as="h2" id="how" className={l.sectionTitle}>
          How it works
          <Doodle name="underline" className={l.underline} />
        </Reveal>
        <ol className={l.steps}>
          {STEPS.map((s, i) => (
            <Reveal
              as="li"
              key={s.title}
              className={styles.card}
              delayMs={i * 140}
            >
              <span className={l.stepNo} aria-hidden>
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className={l.section} aria-labelledby="safe">
        <Reveal as="h2" id="safe" className={l.sectionTitle}>
          Why it won&apos;t bite you
          <Doodle name="underline" className={l.underline} />
        </Reveal>
        <ul className={l.safety}>
          {SAFETY.map((s, i) => (
            <Reveal as="li" key={s.title} delayMs={i * 140}>
              <Doodle name="check" className={l.check} />
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className={l.section} aria-labelledby="faq">
        <Reveal as="h2" id="faq" className={l.sectionTitle}>
          Questions people ask
          <Doodle name="underline" className={l.underline} />
        </Reveal>
        <div className={l.faq}>
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delayMs={i * 90}>
              <details className={l.qa}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" className={styles.card + " " + l.final}>
        <h2>Got a Trove? Pay something in 30 seconds.</h2>
        <p>
          Connect a wallet on Mezo testnet and run the 12 MUSD coffee checkout.
        </p>
        <Link href={demoHref} className={styles.primary + " " + l.finalCta}>
          Try the Demo
        </Link>
      </Reveal>
    </main>
  );
}
