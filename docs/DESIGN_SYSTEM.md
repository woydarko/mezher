# Design System

Status: every value below is **Proposal - needs approval** until the owner approves Phase 2.

## Design direction
- Brand attributes: **calm** (money moves, nothing flashes), **exact** (every number shown to the cent with its source), **warm Bitcoin** (orange used only for the one action that matters).
- Concept: a checkout receipt. One narrow column, numbers in monospace, the split "from balance / borrowed" reads like receipt lines.
- Supported devices: desktop web first (demo laptop, 1280×800 and up). Mobile web 390px must not break (merchant may open links on a phone), but it is not polished beyond that.
- References (borrow, do not copy):
  - Stripe Checkout: single-column payment summary, clear primary button, receipt after pay.
  - Mezo app (testnet.mezo.org): Trove vocabulary (collateral, debt, ratio), so payers recognise the numbers.
  - Paper thermal receipts: monospace amounts, dotted leaders between label and value.

## UI tokens
Implemented once as CSS variables in `web/app/globals.css`; components only consume variables.
| Token | Value | Usage |
| --- | --- | --- |
| color.background | `#0F0D0B` | Main canvas (dark only) |
| color.surface | `#1A1714` | Cards, receipt panel |
| color.border | `#2E2924` | Card borders, dividers, dotted leaders |
| color.text | `#F4EFE6` | Primary copy |
| color.muted | `#A39A8C` | Labels, helper text |
| color.primary | `#F7931A` | Pay / Create buttons, focus ring |
| color.on-primary | `#0F0D0B` | Text on primary buttons |
| color.success | `#4CC38A` | Paid state, healthy ratio |
| color.warning | `#E5B84B` | Ratio 150–200% |
| color.error | `#FF6B5B` | Errors (always with a text label) |
| font.body | `"Instrument Sans", system-ui, sans-serif` — 16px / 400 / 1.5 | Body copy |
| font.mono | `"JetBrains Mono", ui-monospace, monospace` — 15px / 500 / 1.4 | Amounts, addresses, ratios |
| space.unit | 4px (scale 4, 8, 12, 16, 24, 32, 48) | Spacing |
| radius.control | 10px | Inputs and buttons |
| radius.card | 16px | Cards |

## Layout rules
- Container: single column, max width 480px for `/pay`, 720px for `/merchant`; 16px side gutter on mobile, 24px on desktop.
- Breakpoints: `sm` 390px (baseline), `md` 768px, `lg` 1280px.
- Grid/spacing: vertical stack, 16px between rows inside a card, 24px between cards. Labels left, values right (receipt lines) with a dotted leader in `color.border`.
- Mobile behaviour: same single column; the header wallet button collapses to an icon + short address.

## Components
State set for every interactive component: default, hover, focus-visible (2px `color.primary` ring, 2px offset), disabled (40% opacity + `cursor: not-allowed` + reason text nearby), loading (spinner + verb label, e.g. "Signing…"), success, error.
- **Primary button**: full width in cards, 48px tall, `color.primary` background, `color.on-primary` text, 600 weight. Loading keeps width and swaps the label to the current step ("Sign permit…", "Sign borrow…", "Sending…"). Never two primary buttons on one screen.
- **Secondary button**: transparent, 1px `color.border` border, `color.text` label (e.g. "Pay with my own gas", "Copy link").
- **Form field**: label above (14px muted), input 44px tall with `color.surface` background and a 1px border; helper text below; the error replaces the helper text in `color.error` with an icon and text; `aria-describedby` links them.
- **Receipt line**: `label ……… value` with the value in `font.mono`; an optional sub-line in muted text (e.g. "fee 0.1%").
- **Ratio meter**: horizontal bar 0–300% with markers at 110% (liquidation) and 150% (safety floor); "now" and "after" values as text; colour by band (error < 150, warning 150–200, success ≥ 200).
- **Card**: `color.surface`, 1px `color.border`, `radius.card`, 24px padding.
- **Toast/inline status**: inline under the button (no floating toasts) for tx status, with an explorer link when a hash exists.
- **Navigation**: top bar with the logo text "Mezher" (left), links "Pay" / "Merchant", and the wallet button (right).

## Accessibility
- Keyboard: every control reachable in visual order; Enter submits forms; Escape closes the wallet modal (RainbowKit default). Focus is always visible (token ring).
- Contrast: body text and muted text checked ≥ 4.5:1 on `color.background` and `color.surface`; button text ≥ 4.5:1 on `color.primary`. Verified in Phase 5 with a contrast checker; results recorded in TESTING.md.
- Semantic labels: buttons have text labels; amounts carry `aria-label` with the unit ("12 MUSD"); the ratio meter has `role="meter"` with `aria-valuenow`.
- Motion: respects `prefers-reduced-motion` (all transitions off).

## Screen states
| Screen | Empty | Loading | Error | Populated |
| --- | --- | --- | --- | --- |
| `/pay` checkout (J1, F-02/F-03) | missing/invalid link params → "This payment link is incomplete" | skeleton receipt lines while reading the chain | RPC down → "Can't reach Mezo testnet. Retry"; no Trove → CTA | order + split + ratio + Pay |
| `/pay` receipt (J1, F-07) | — | "Waiting for confirmation…" with tx link | reverted → reason + Retry | "Paid 12 MUSD" + tx link + new ratio |
| `/merchant` (J2, F-06/F-07) | no payments yet → "No payments yet. Share a link to get paid." | skeleton list | invalid input inline; RPC down banner | link builder + payments list |
| Landing `/` (J3) | — | — | — | one-line pitch, "Try the demo checkout" and "I'm a merchant" |

## Approval
Design owner: repo owner. Source of truth: this file (ASCII wireframes below). No Figma file.

---

## Hackathon UI addendum

### 1. Screen inventory
| Screen | PRD journey / feature | Purpose | Key components | States | Wireframe |
| --- | --- | --- | --- | --- | --- |
| `/` Landing | J3 | Explain in one line, route to demo | Hero line, 2 buttons | populated | W0 |
| `/pay` Checkout | J1, F-01, F-02, F-03, F-04, F-05 | Review and pay | Order card, Trove card, ratio meter, receipt lines, primary button, secondary fallback | empty, loading, error, no-trove, ratio-blocked, already-paid, populated, signing, sending | W1 |
| `/pay` Receipt | J1, F-07 | Prove the payment happened | Status line, receipt lines, tx link, new ratio | pending, failed, success | W2 |
| `/merchant` | J2, F-06, F-07 | Create a link, see payments | Form, link output + copy, payments table | empty, loading, error, populated | W3 |

### 2. Flow
Golden path: `/` → "Try the demo checkout" → `/pay?to=…&amount=12&order=…&label=Coffee` → Connect wallet → (switch network if needed) → review split (5 balance + 7 borrow) → **Pay** → sign permit → sign borrow → relayer sends → Receipt "Paid 12 MUSD" → (second tab) `/merchant` shows the payment at the top.
Main failure branch: the ratio after borrowing is below 150% → Pay disabled with the reason and a link "Add collateral on Mezo". Relayer error → "Pay with my own gas" → wallet tx prompt → Receipt.

### 3. Wireframes (ASCII)
W1 `/pay` Checkout
```
┌──────────────────────────────────────────────┐
│ Mezher                Pay  Merchant  [0x12…ab]│
├──────────────────────────────────────────────┤
│  Coffee                                       │
│  to 0x9f…31                       12.00 MUSD  │
├──────────────────────────────────────────────┤
│  YOUR BITCOIN CREDIT                          │
│  Collateral ............... 0.0400 BTC       │
│  Debt ..................... 2,000.00 MUSD     │
│  Ratio  now 162%  →  after 161%               │
│  [■■■■■■■■■■■|····|·········]  110  150       │
├──────────────────────────────────────────────┤
│  From your balance ......... 5.00 MUSD        │
│  Borrowed from Trove ....... 7.00 MUSD        │
│    fee 0.1% ................ 0.007 MUSD       │
│  Merchant receives ........ 12.00 MUSD        │
│  Gas you pay ............... 0                │
│                                               │
│  [            Pay 12.00 MUSD             ]    │
│   Pay with my own gas                         │
└──────────────────────────────────────────────┘
```
W2 Receipt
```
┌──────────────────────────────────────────────┐
│  ✓ Paid 12.00 MUSD                            │
│  Coffee · order 3f9a…                         │
│  From balance 5.00 · Borrowed 7.00            │
│  Ratio now 161%                               │
│  View on explorer ↗                           │
└──────────────────────────────────────────────┘
```
W3 `/merchant`
```
┌──────────────────────────────────────────────┐
│  Get paid in MUSD                             │
│  Pay to   [0x9f…31 (connected)        ]       │
│  Amount   [12.00        ] MUSD                │
│  Label    [Coffee                     ]       │
│  Order id [3f9a1c…      ] (auto)              │
│  [          Create payment link          ]    │
│  https://…/pay?to=…&amount=12…   [Copy link]  │
├──────────────────────────────────────────────┤
│  PAYMENTS                                     │
│  12.00  Coffee  0x12…ab  5 bal / 7 borrow  ↗  │
└──────────────────────────────────────────────┘
```
W0 Landing: logo, the line "Pay with your Bitcoin. Keep your Bitcoin.", a sub-line "Borrow only what your MUSD balance doesn't cover, straight to the merchant. No gas, one click.", and two buttons.

### 4. Type scale
Families: Instrument Sans (OFL, Google Fonts) for text; JetBrains Mono (OFL) for numbers; fallbacks `system-ui` / `ui-monospace`. Loaded with `next/font/google` (self-hosted at build).
| Style | Size / line height | Weight |
| --- | --- | --- |
| h1 | 32 / 40 | 600 |
| h2 | 24 / 32 | 600 |
| h3 | 18 / 26 | 600 |
| h4 / section label | 12 / 16, uppercase, 0.08em tracking | 600 |
| body | 16 / 24 | 400 |
| small | 14 / 20 | 400 |
| caption | 12 / 16 | 400 |
| amount (mono) | 15 / 21, big total 28 / 34 | 500 |
Max line length 60ch.

### 5. Color roles
Dark only (decision). Background `#0F0D0B`, surface `#1A1714`, border `#2E2924`, text `#F4EFE6`, muted `#A39A8C`, primary `#F7931A`, accent = primary (no second accent), success `#4CC38A`, warning `#E5B84B`, error `#FF6B5B`, focus ring `#F7931A`. Contrast ratios: to be measured in Phase 5 and written here (target ≥ 4.5:1 for text roles).

### 6. Spacing and grid
4px base; scale 4/8/12/16/24/32/48. Containers 480px (pay) / 720px (merchant). Breakpoints 390 / 768 / 1280. Mobile-first CSS.

### 7. Icons and imagery
One set: Lucide (ISC license) via `lucide-react`; icons used: Check, ExternalLink, Copy, AlertTriangle, Loader2, Wallet. No illustrations or stock photos. Logo: the word "Mezher" in Instrument Sans 600 with a small orange dot; no external brand marks except the official "Mezo" name in text.

### 8. Motion
Tokens: `--dur-fast: 120ms`, `--dur-base: 200ms`, `--ease: cubic-bezier(.2,.8,.2,1)`. Animate: button press, receipt lines appearing, the ratio bar moving from "now" to "after". Wow moment: after Pay, the receipt lines tick into place one by one and the merchant amount counts up to 12.00 (≤ 600ms total). `prefers-reduced-motion`: no animation, final values shown immediately.

### 9. Voice and copy
Tone: plain, short, numbers first. Buttons are verbs with the amount ("Pay 12.00 MUSD", "Create payment link", "Copy link"). Errors = what happened + what to do: "Your Trove would drop below 150%. Pay less or add collateral on Mezo." Empty state: "No payments yet. Share a link to get paid." Wallet microcopy: "Sign to move 5.00 MUSD from your balance", "Sign to borrow 7.00 MUSD to this merchant". Never say "transaction failed" without the reason.

### 10. Demo conditions
Laptop, Chrome, 1280×800, browser zoom 110% for screen recording; MetaMask with the pre-funded demo payer; a second browser profile as the merchant. Network: live Mezo testnet; recorded fallback video if the RPC is slow.

### 11. Component inventory
UI library: **none besides RainbowKit** (required by Mezo Passport). Plain CSS modules + CSS variables. Custom components in `web/components/`: `Header`, `Card`, `ReceiptLine`, `RatioMeter`, `PrimaryButton`, `SecondaryButton`, `Field`, `StatusLine`, `PaymentsTable`.

### 12. Do / Don't
- Do use only the CSS variables above; no hex values in components.
- Do show the unit "MUSD" or "BTC" next to every number.
- Do ship empty, loading, error and success states for every screen before moving on.
- Do keep one primary button per screen.
- Do format amounts with `formatUnits` and 2 decimals (fees up to 4).
- Don't add a UI kit (no Tailwind, MUI, shadcn).
- Don't add fonts, colours, or icon sets beyond this file.
- Don't use floating toasts or modals for errors; inline only.
- Don't hide the borrowed amount or the fee anywhere.
- Don't block the UI on animation; reduced motion = no motion.

### 13. Design decisions log
| Date | Decision | Reason |
| --- | --- | --- |
| 2026-10-18 | Dark-only receipt layout, Bitcoin orange as the single accent | Calm money UI; one obvious action; matches the BTC theme |
| 2026-10-18 | No UI kit besides RainbowKit | Mezo Passport requires RainbowKit; fewer deps, faster build |
| 2026-10-18 | Desktop-first, mobile not broken | Demo is on a laptop; merchants may open links on phones |
