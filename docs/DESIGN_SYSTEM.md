# Design System

Status: **approved by the owner 2026-10-19** (crayon redesign). Spec and reasoning: `docs/superpowers/specs/2026-10-19-crayon-ui-design.md`. antislop audit: `anti-slop/audit-001-2026-10-19.md`.

## Design direction
- Owner brief: every screen looks sketched in MS Paint with crayons; comic-like handwriting that is not Comic Sans; "fun and fresh" because BTC/finance UIs feel stiff and institutional.
- Brand attributes: **playful** (crayon on paper, small tilts, a drawn check when you pay), **exact** (amounts, ratio and fee always readable and unambiguous), **honest** (testnet labelled, no claim without evidence).
- Design Read: Bitcoin checkout landing + payment app for Mezo users and hackathon judges, hand-drawn crayon-on-paper language, dial **ENERGY 3 / RHYTHM 2 / MOTION 2**.
- Identity motif: a wobbly crayon outline with waxy grain (SVG filter `#sketch` on `::before` drawings only, never on text) plus the yellow highlighter.
- Supported devices: desktop and mobile web; 390 px must work fully (44 px tap targets, no overflow).

## UI tokens
Implemented once as CSS variables in `web/app/globals.css`; components only consume variables. Contrast checked with the antislop contrast tool on paper.
| Token | Value | Usage | Why (one line) |
| --- | --- | --- | --- |
| color.paper | `#FFFDF7` | page and card fill | crayon needs paper; light only by decision |
| color.paper-2 | `#F7F0E1` | insets, footer | a second sheet, not a new colour |
| color.ink | `#1F1B16` | text, outlines | black crayon |
| color.muted | `#5F574C` (6.26:1 on paper-2) | labels, helper text | softer crayon, still AA |
| color.orange | `#F7931A` (ink on it 7.45:1) | Pay buttons, the "Keep" circle | the one accent, Bitcoin orange, only where you act |
| color.orange-ink | `#A84F00` (5.46:1) | ratio 150-200% text | orange that can be read as text |
| color.yellow | `#FFE44D` | highlighter: labels, section underlines, active step, result box | marks "look here" without a second accent |
| color.green / green-ink | `#8BD17C` / `#2E6B2F` (6.33:1) | healthy ratio fill / success text, checks | status only |
| color.red / red-ink | `#FF8A80` / `#B3261E` (6.43:1) | danger fill / errors | status only |
| color.blue-ink | `#1E4FD8` (6.52:1) | links, focus ring | links and focus only, never decoration |
| font.body | Shantell Sans (OFL, `next/font/google`), 17px / 1.55, axis INFM 40 | everything | owner asked for comic-like, not Comic Sans; Shantell was drawn as exactly that |
| numbers | Shantell Sans 700, INFM 0, `tabular-nums` (`.mono`) | amounts, addresses, ratios | same hand, steadier, digits aligned |
| radius.sketch | `255px 18px 225px 18px / 18px 225px 18px 255px` (+ mirrored) | cards, buttons, inputs | uneven radii read as a crayon loop |
| stroke | 3px | outlines | crayon line weight |
| shadow.sketch | `4px 5px 0 ink` | primary button, hero sum, demo devices, the three demo step cards | only things you press, the hero drawings, and the step cards (owner preferred that look) are raised |
| motion | `--ease: cubic-bezier(.22,1,.36,1)`, 180 / 320 / 700 / 800 ms | all transitions | fast start, soft landing |
| background | faint blue ruling every 32px | page | sketchbook paper, the one texture |

## Layout rules
- Full frame: header, then each page fills the screen (`min-height: 100dvh - header`), footer below the fold.
- Containers: 520px (`/pay`, centred vertically), 760px (`/merchant`, `/terms`), 1080px (landing). Gutter 16px mobile, 24px desktop.
- Landing rhythm (RHYTHM 2): hero split (text + drawn sum), animated demo with synced steps, a text-only safety band between dashed rules, FAQ, closing CTA card. Sections 96-160px apart.
- Mobile: single column; header keeps logo coin + two links + wallet button at 44px; the payments table becomes stacked rows.

## Components
States for every interactive component: default, hover (slight tilt), focus-visible (3px dashed blue-ink ring), disabled (dashed outline, muted label, reason text), loading (spinning crayon scribble + verb label), success, error.
- **Primary button**: orange hatch fill, ink outline, hard shadow; tilts on hover, presses down on click. One per screen.
- **Secondary button**: paper fill, ink outline, no shadow.
- **Field**: label above, hand-drawn box, yellow wash on focus, error text with a crayon warning mark.
- **Receipt line**: label, dotted crayon leader, value in `.mono`.
- **Ratio meter**: hand-drawn bar 0-300%, hatch fill by band (red < 150, orange 150-200, green >= 200), ticks "110 danger" and "150 safe line", `role="meter"`.
- **Card**: crayon outline on paper, slight tilt, no shadow (sits flat on the page).
- **Status line**: crayon doodle icon (spinner, check, warning) + text, explorer link with a crayon "external" mark.
- **Wallet button**: RainbowKit `ConnectButton.Custom` in the crayon button style; modal on RainbowKit `lightTheme` with orange accent and Shantell Sans.
- **Doodles** (`components/Doodle.tsx`) and **illustrations** (`components/Illustration.tsx`): inline SVG drawn for Mezher (BTC coin, shop + link, signed receipt, BTC lock + merchant bag). No icon library.
- **Demo mockup** (`components/DemoMockup.tsx`): payer phone + merchant laptop + the three steps, one 8s timeline played once on scroll, then a Replay button.

## Accessibility
- Keyboard: every control reachable in visual order; Enter submits forms; Escape closes the wallet modal. Focus always visible (dashed blue-ink ring; inputs draw it on their wrapper).
- Contrast: every text token >= 4.5:1 on paper (values in the token table).
- Semantic labels: decorative drawings are `aria-hidden`; the hero sum and demo carry text alternatives; amounts carry the unit; ratio meter has `role="meter"`.
- Motion: nothing loops forever (the demo plays once with Replay; the loading scribble spins only while loading). `prefers-reduced-motion`: every animation off, final frames shown.

## Screen states
| Screen | Empty | Loading | Error | Populated |
| --- | --- | --- | --- | --- |
| `/pay` checkout (J1, F-02/F-03) | no link → "Pay a link" paste form; invalid link → "This payment link is incomplete" + paste form | skeleton receipt lines while reading the chain | RPC down → "Can't reach Mezo testnet. Retry"; no Trove → CTA | order + split + ratio + Pay |
| `/pay` receipt (J1, F-07) | — | "Waiting for confirmation…" with tx link | reverted → reason + Retry | "Paid 12 MUSD" + tx link + new ratio |
| `/merchant` (J2, F-06/F-07) | no payments yet → "No payments yet. Share a link to get paid." | skeleton list | invalid input inline; RPC down banner | link builder + payments list |
| Landing `/` (J3) | n/a | n/a | n/a | hero + drawn sum, animated demo with steps, safety band, FAQ, closing CTA |
| `/terms` | n/a | n/a | n/a | testnet terms and privacy |

## Approval
Design owner: repo owner. Source of truth: this file (ASCII wireframes below). No Figma file.

---

## Hackathon UI addendum

### 1. Screen inventory
| Screen | PRD journey / feature | Purpose | Key components | States | Wireframe |
| --- | --- | --- | --- | --- | --- |
| `/` Landing | J3 | Explain and route to the demo | Hero + drawn sum, DemoMockup, safety band, FAQ, CTA | populated | W0 |
| `/pay` Checkout | J1, F-01, F-02, F-03, F-04, F-05 | Review and pay | Order card, Trove card, ratio meter, receipt lines, primary button, secondary fallback | empty, loading, error, no-trove, ratio-blocked, already-paid, populated, signing, sending | W1 |
| `/pay` Receipt | J1, F-07 | Prove the payment happened | Status line, receipt lines, tx link, new ratio | pending, failed, success | W2 |
| `/merchant` | J2, F-06, F-07 | Create a link, see payments | Form, link output + copy, payments table | empty, loading, error, populated | W3 |

### 2. Flow
Golden path: `/` → "Try the Demo" → `/pay?to=…&amount=12&order=…&label=Coffee` → Connect wallet → (switch network if needed) → review split (5 balance + 7 borrow) → **Pay** → sign permit → sign borrow → relayer sends → Receipt "Paid 12 MUSD" → (second tab) `/merchant` shows the payment at the top.
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
W0 Landing: "Pay with your Bitcoin. Keep your Bitcoin." with "Keep" circled in orange crayon, the lead "Short on MUSD? Mezher borrows only the missing part against your BTC, straight to the merchant, in one transaction. No selling, and no gas for the part you borrow.", buttons "Try the Demo" / "I'm a merchant", and a drawn sum 5 + 7 = 12.

### 4. Type scale
Family: Shantell Sans (OFL, Google Fonts) for everything, self-hosted by `next/font`; fallbacks Segoe Print, Bradley Hand, cursive.
| Style | Size / line height | Weight / informal axis |
| --- | --- | --- |
| h1 | clamp(32px, 6vw, 56px) / 1.08 | 800 / 80 |
| h2 | clamp(24px, 3.6vw, 34px) / 1.15 | 800 / 80 |
| h3 | 20 / 1.3 | 800 / 80 |
| label (`.section-label`) | 17 / 1.2, sentence case on the yellow highlighter | 800 |
| body | 17 / 1.55 | 400 / 40 |
| small | 15 / 1.4 | 400 |
| amount (`.mono`) | inherits size, tabular numbers | 700 / 0 |
Max line length 62ch.

### 5. Color roles
Light only (decision: crayon is drawn on paper). Core: paper + ink (neutral), orange (the one accent), yellow (highlighter). Status: green, red. Links and focus: blue-ink. Contrast values are in the token table.

### 6. Spacing and grid
4px base; scale 4/8/12/16/24/32/48/64; landing sections 96-160px apart. Containers 520 / 760 / 1080. Mobile-first CSS.

### 7. Icons and imagery
No icon library. Crayon doodles and illustrations drawn for Mezher, inline SVG through the `#wobble` filter. Logo: crayon BTC coin + the word "Mezher"; favicon: crayon coin with an "M" (owner approved 2026-10-19).

### 8. Motion (MOTION 2)
Purposeful only: buttons tilt on hover and press on click (feedback); the demo mockup plays the golden path once when it scrolls into view and the matching step lights up (explains the product), then rests on the paid frame with a Replay button; the demo and the closing CTA fade in as they enter (owner asked for smooth scroll motion; kept to these two); the receipt check draws itself and two stars pop once (the real success moment). Smooth scrolling. Reduced motion: none of it.

### 9. Voice and copy
Plain, short, numbers first, a little playful in headings ("Why it won't bite you"). Buttons are verbs with the amount ("Pay 12.00 MUSD", "Create payment link", "Copy link", "Try the Demo"). Errors say what happened and what to do. No em dash, no claim without evidence ("no gas" only for the borrowed part).

### 10. Demo conditions
Laptop, Chrome, 1280x800; MetaMask with the pre-funded demo payer; a second browser profile as the merchant. Live Mezo testnet; recorded fallback video if the RPC is slow.

### 11. Component inventory
UI library: **none besides RainbowKit** (required by Mezo Passport). Plain CSS modules + CSS variables. `web/components/`: `Header`, `Footer`, `Card`, `ReceiptLine`, `RatioMeter`, `PrimaryButton`, `SecondaryButton`, `Field`, `StatusLine`, `PaymentsTable`, `WalletButton`, `Doodle`, `Illustration`, `DemoMockup`, `Reveal`.

### 12. Do / Don't
- Do use only the CSS variables above; no hex values in components.
- Do apply `url(#sketch)` to `::before` drawings, never to text.
- Do show the unit "MUSD" or "BTC" next to every number.
- Do keep orange for the Pay action and the "Keep" circle; use the yellow highlighter for emphasis.
- Do ship empty, loading, error and success states for every screen.
- Don't add an icon library, UI kit or extra font.
- Don't put a shadow on cards or inputs; only on things you press or the hero drawings.
- Don't loop an animation forever; give long motion a Replay instead.
- Don't hide the borrowed amount or the fee anywhere.

### 13. Design decisions log
| Date | Decision | Reason |
| --- | --- | --- |
| 2026-10-18 | Dark-only receipt layout, Bitcoin orange as the single accent | Calm money UI (superseded 2026-10-19) |
| 2026-10-18 | No UI kit besides RainbowKit | Mezo Passport requires RainbowKit; fewer deps |
| 2026-10-19 | Crayon MS Paint redesign, Shantell Sans, light only | Owner: finance UIs feel stiff; Mezher should be fun and fresh |
| 2026-10-19 | Lucide removed, crayon doodles instead | One machine-drawn icon set clashed with the crayon UI (antislop R-04) |
| 2026-10-19 | Demo plays once + Replay, reveal only on demo and closing CTA | No endless motion (WCAG 2.2.2), no template fade-up on every section (antislop R-19) |
| 2026-10-19 | "How it works" folded into the demo as synced steps | Same story was told twice (antislop C-3) |
| 2026-10-19 | Logo: crayon BTC coin; favicon crayon coin with "M" | Drawn by Claude, approved by the owner ("nice banget", audit approval) |
| 2026-10-19 | Demo step cards back to the crayon card look (outline, tilt, shadow, yellow number), fill lights in sync | Owner preferred the earlier card design but liked the link to the illustrations (antislop R-12 override noted) |
