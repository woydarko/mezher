# Mezher crayon UI — design

Date: 2026-10-19. Owner request: "frontend masih basic banget ... harus bagus seakan mau launch mainnet ... temanya kayak rough sketch yang di gambar di mspaint pake crayon ... font yg kayak comic sans tapi jangan pake comic sans." Why (owner): BTC/finance products feel stiff and institutional; Mezher takes a fun, fresh angle.

## Intent
Every screen looks like it was sketched in MS Paint with crayons: white paper canvas, wobbly black crayon outlines, scribble-filled shapes, the MS Paint colour palette as a wink. The tone is playful; the money stays exact. A judge or first-time user should smile in the first five seconds and still trust every number.

## Goals
- One visual language across `/`, `/pay` (checkout + receipt + every state), `/merchant`, header, footer and the wallet button.
- Launch-quality landing: hero that explains the split, "how it works", "why it's safe", FAQ, footer.
- Mobile 390px polished, not just "not broken".
- No new dependencies; behaviour and copy meaning unchanged (only styling, layout and the landing content).

## Non-goals
- No change to contract, relay, quote, signature or link logic.
- No dark mode (paper only, decision).
- No raster illustrations or stock art; doodles are inline SVG drawn for this project.

## Anti-goals (failure even if it "works")
- A number that is hard to read or could be misread (amounts, ratio, fee, addresses).
- So childish that it reads as a scam or a toy; it must still feel deliberate.
- Text contrast below 4.5:1, invisible focus, motion that ignores `prefers-reduced-motion`.
- Janky scrolling from heavy SVG filters.

## Decided (owner)
- Theme: crayon sketch drawn in MS Paint, for all UI/UX.
- Font: comic-like handwriting, not Comic Sans.

## Builder's calls (Claude, owner may override)
- **Font:** Shantell Sans (Google Fonts, OFL; designed as a Comic Sans alternative, variable weight 300–800 with an "informal" axis). Headings 800, body 400, amounts 700 with `tabular-nums`. Loaded with `next/font/google`. Replaces Instrument Sans and JetBrains Mono.
- **Palette** (crayon on paper; text colours meet 4.5:1 on paper):
  | Token | Value | Use |
  | --- | --- | --- |
  | paper | `#FFFDF7` | page background |
  | paper-2 | `#F7F0E1` | inset areas, table stripes |
  | ink | `#1F1B16` | text, crayon outlines |
  | muted | `#5F574C` | labels, helper text |
  | orange | `#F7931A` | primary fills (ink text on top) |
  | orange-ink | `#A84F00` | orange text on paper |
  | green / green-ink | `#8BD17C` / `#2E6B2F` | healthy ratio fill / success text |
  | yellow | `#FFE44D` | highlighter behind focus and key words |
  | red / red-ink | `#FF8A80` / `#B3261E` | danger fill / error text |
  | blue-ink | `#1E4FD8` | links, focus ring |
- **Crayon technique:** two SVG filters defined once in the layout: `wobble` (turbulence + displacement, makes lines hand-drawn) and `crayon` (fractal noise punched into the stroke, gives the waxy grain). They are applied to `::before` pseudo-elements that draw borders and fills, never to text, so text stays crisp. Hand-drawn corners use the asymmetric `border-radius` trick (`255px 15px 225px 15px / 15px 225px 15px 255px`). Cards tilt slightly (±0.4°). Scribble fills are diagonal `repeating-linear-gradient` hatching under the crayon filter.
- **MS Paint nods:** the header reads like a Paint title bar ("untitled - Mezher"), the footer carries the Paint colour palette strip (decorative, `aria-hidden`).
- **Components:** Card (wobbly outline, paper fill), PrimaryButton (orange scribble fill, ink outline, hard offset shadow, wiggle on hover, squash on press), SecondaryButton (outline only), Field (hand-drawn box, yellow highlighter on focus), ReceiptLine (dotted crayon leader), RatioMeter (hand-drawn bar, hatch fill by band, tick marks labelled "110 danger" and "150 safe line"), StatusLine (icon + text), PaymentsTable (rows become stacked cards under 600px), wallet button via `ConnectButton.Custom` in the same crayon style, RainbowKit modal on `lightTheme` with orange accent and the same font.
- **Doodles** (`components/Doodle.tsx`, inline SVG, `aria-hidden`): bitcoin coin, arrow, checkmark that draws itself, star, circle scribble, underline scribble.
- **Landing content:** hero headline with "Keep" circled in crayon; a drawn split card "5 from your wallet + 7 borrowed against your BTC = 12 to the merchant"; three "how it works" steps (merchant sends a link → you sign twice, no gas → merchant is paid, your BTC stays put); "why it's safe" (ratio never below 150%, enforced by the contract; money only goes to the merchant you signed for; no gas needed); FAQ (`<details>`): What's a Trove? What does it cost? Is this mainnet?; footer with testnet badge, contract link, "built on Mezo".
- **Receipt moment:** big crayon checkmark draws itself, a few star doodles pop, amount shown large. Reduced motion: final state, no animation.
- **Motion:** wiggle 150 ms, draw 500 ms; all off under `prefers-reduced-motion`.
- **Favicon:** crayon "M" coin as `app/icon.svg`.

## Constraints
- CSS variables only in components (update `globals.css` tokens; DESIGN_SYSTEM.md updated to match).
- Keep every existing state: empty, loading, error, no-trove, ratio-blocked, already-paid, signing, sending, confirming, paid, own-gas fallback.
- `pnpm vitest run`, `tsc`, `pnpm build` stay green.

## Acceptance
- Screenshots of `/`, `/pay` (ok, blocked, receipt), `/merchant` at 1280px and 390px reviewed by the owner.
- Contrast of every text token on paper ≥ 4.5:1 (checked with a contrast tool, recorded in DESIGN_SYSTEM.md).
- Keyboard: all controls reachable, focus visible.
