import Link from "next/link";
import { ADDRESSES, explorerAddress } from "@/lib/mezo";
import { Doodle } from "./Doodle";
import styles from "./ui.module.css";

const SWATCHES = Array.from({ length: 16 }, (_, i) => "var(--paint-" + (i + 1) + ")");

export function Footer() {
  return (
    <footer className={styles.footer}>
      {/* MS Paint colour box, decorative */}
      <div className={styles.palette} aria-hidden>
        {SWATCHES.map((c) => (
          <span key={c} className={styles.swatch} style={{ background: c }} />
        ))}
      </div>
      <div className={styles.footerGrid}>
        <div className={styles.footerBrand}>
          <Link href="/" className={styles.logo} aria-label="Mezher home">
            <Doodle name="coin" />
            <span>Mezher</span>
          </Link>
          <p>Pay with your Bitcoin. Keep your Bitcoin.</p>
        </div>

        <nav className={styles.footerLinks} aria-label="Footer">
          <span className={styles.footerHeading}>Use it</span>
          <Link href="/pay">Pay</Link>
          <Link href="/merchant">Get paid</Link>
        </nav>

        <nav className={styles.footerLinks} aria-label="On-chain">
          <span className={styles.footerHeading}>On-chain</span>
          {ADDRESSES.mezherPay && (
            <a href={explorerAddress(ADDRESSES.mezherPay)} target="_blank" rel="noreferrer">
              MezherPay contract ↗
            </a>
          )}
          <a href="https://mezo.org" target="_blank" rel="noreferrer">
            Built on Mezo ↗
          </a>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span className={styles.badge}>Testnet</span>
        <span>Test BTC and MUSD only. No real money moves here.</span>
      </div>
    </footer>
  );
}
