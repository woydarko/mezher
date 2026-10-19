"use client";

import { useEffect, useState } from "react";
import { qrSvg } from "@/lib/qr";
import styles from "./ui.module.css";

/** QR of the payment link for a payer standing at the counter. The code itself stays crisp (no crayon filter). */
export function LinkQr({ url }: { url: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    qrSvg(url).then(
      (s) => live && setSvg(s),
      () => live && setSvg(null),
    );
    return () => {
      live = false;
    };
  }, [url]);

  if (!svg) return null;
  return (
    <figure className={styles.qr}>
      {/* markup comes from the qrcode library for our own URL, not from user HTML */}
      <div
        className={styles.qrCode}
        role="img"
        aria-label="QR code of this payment link"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption>Scan to pay</figcaption>
    </figure>
  );
}
