"use client";

import { useEffect, useRef, useState } from "react";
import { Doodle } from "./Doodle";
import { Illustration } from "./Illustration";
import styles from "./ui.module.css";
import d from "./demo.module.css";

const STEPS = [
  {
    art: "link",
    title: "Shop sends a link",
    body: "The merchant types an amount on Mezher and shares the link. No account, no setup.",
  },
  {
    art: "sign",
    title: "You sign, that's it",
    body: "You see what comes from your balance and what gets borrowed, then sign once or twice.",
  },
  {
    art: "paid",
    title: "Shop is paid, your BTC stays",
    body: "The merchant gets the full amount in MUSD in one transaction. Your Bitcoin stays in your Trove.",
  },
] as const;

/**
 * The golden path as a crayon mockup: the payer's phone pays 12 MUSD (5 balance + 7 borrowed) and the row
 * lands on the merchant's laptop, with the three steps lighting up in sync. It plays once when it scrolls
 * into view and rests on the paid frame; "Replay" runs it again (no endless loop, WCAG 2.2.2).
 * Under reduced motion every piece shows its final state.
 */
export function DemoMockup() {
  const ref = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPlaying(true);
          io.disconnect();
        }
      },
      // top edge in the upper two thirds of the screen; a ratio threshold never fires on phones,
      // where the stacked devices + steps are taller than the viewport
      { rootMargin: "0px 0px -35% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure ref={ref} className={d.stage + (playing ? " " + d.playing : "")}>
      <div key={run} className={d.run}>
        <div className={d.devices} aria-hidden>
          <div className={d.phone}>
            <div className={d.notch} />
            <div className={d.screen}>
              <p className={d.title}>Coffee</p>
              <p className={d.small}>to 0x0491…11AA</p>
              <p className={d.total + " mono"}>12.00 MUSD</p>
              <div className={d.line + " " + d.lineA}>
                <span>From your balance</span>
                <span className="mono">5.00</span>
              </div>
              <div className={d.line + " " + d.lineB}>
                <span>Borrowed vs BTC</span>
                <span className="mono">7.00</span>
              </div>
              <div className={d.line + " " + d.lineC}>
                <span>Gas you pay</span>
                <span className="mono">0</span>
              </div>
              <div className={d.button}>Pay 12.00 MUSD</div>
              <span className={d.tap} />
              <div className={d.receipt}>
                <svg viewBox="0 0 64 64" className={d.check}>
                  <path d="M9 35c4 4 9 9 13 14C30 35 41 22 56 11" pathLength={1} />
                </svg>
                <p className={d.paid + " mono"}>Paid 12.00</p>
                <p className={d.small}>Your BTC stayed put.</p>
              </div>
            </div>
          </div>

          <Doodle name="arrow" className={d.arrow} />

          <div className={d.laptop}>
            <div className={d.lid}>
              <p className={d.title}>Payments</p>
              <div className={d.row + " " + d.rowNew}>
                <span className="mono">12.00 MUSD</span>
                <span>0xe816…786e</span>
                <span className="mono">5 / 7</span>
              </div>
              <div className={d.row}>
                <span className="mono">4.00 MUSD</span>
                <span>0xe816…786e</span>
                <span className="mono">3 / 1</span>
              </div>
              <div className={d.row}>
                <span className="mono">11.00 MUSD</span>
                <span>0xe816…786e</span>
                <span className="mono">0 / 11</span>
              </div>
            </div>
            <div className={d.base} />
          </div>
        </div>

        <ol className={d.steps}>
          {STEPS.map((s, i) => (
            <li key={s.title} className={d.step + " " + d["step" + (i + 1)]}>
              <div className={d.stepArt}>
                <Illustration name={s.art} />
                <span className={d.stepNo} aria-hidden>
                  {i + 1}
                </span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <figcaption className={d.caption}>
        <span>The payer taps once; the merchant&apos;s list shows the full 12 MUSD a moment later.</span>
        <button
          type="button"
          className={styles.secondary + " " + d.replay}
          onClick={() => {
            setPlaying(true);
            setRun((r) => r + 1);
          }}
        >
          Replay
        </button>
      </figcaption>
    </figure>
  );
}
