import { Doodle } from "./Doodle";
import d from "./demo.module.css";

/**
 * A looping crayon mockup of the golden path: the payer's phone pays 12 MUSD (5 balance + 7 borrowed),
 * and the row lands on the merchant's laptop. Pure CSS animation on one 7 s timeline; under reduced
 * motion every piece rests in its final state. Decorative: the figcaption carries the meaning.
 */
export function DemoMockup() {
  return (
    <figure className={d.stage}>
      <div className={d.phone} aria-hidden>
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

      <div className={d.laptop} aria-hidden>
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

      <figcaption className={d.caption}>
        The payer taps once. The merchant&apos;s list updates a moment later with the full 12 MUSD.
      </figcaption>
    </figure>
  );
}
