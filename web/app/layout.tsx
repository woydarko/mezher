import type { Metadata } from "next";
import { Shantell_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { ClientProviders } from "./client-providers";
import "./globals.css";

const shantell = Shantell_Sans({ subsets: ["latin"], variable: "--font-shantell", axes: ["INFM"] });

export const metadata: Metadata = {
  title: "Mezher — pay with your Bitcoin, keep your Bitcoin",
  description:
    "Pay a merchant in MUSD. What your balance doesn't cover is borrowed against your BTC on Mezo, straight to the merchant. No gas.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={shantell.variable}>
      <body>
        {/* Crayon filters, referenced by CSS as url(#sketch) etc. Applied to drawn outlines and fills, never to text. */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
          <defs>
            <filter id="sketch" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp" />
              <feDisplacementMap in="SourceGraphic" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" result="wobbly" />
              <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="9" result="grain" />
              <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.75" result="mask" />
              <feComposite in="wobbly" in2="mask" operator="in" />
            </filter>
            <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="2" result="warp" />
              <feDisplacementMap in="SourceGraphic" in2="warp" scale="3" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
