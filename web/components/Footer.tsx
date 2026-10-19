import { ADDRESSES, explorerAddress } from "@/lib/mezo";
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
      <div className={styles.footerRow}>
        <span className={styles.badge}>Testnet</span>
        <span>Built on Mezo. MUSD, Troves and the borrow are Mezo&apos;s; Mezher just draws the line between them.</span>
        {ADDRESSES.mezherPay && (
          <a href={explorerAddress(ADDRESSES.mezherPay)} target="_blank" rel="noreferrer">
            MezherPay contract ↗
          </a>
        )}
      </div>
    </footer>
  );
}
