# HashX — Design System

**HashX · The Trust Layer for Agent Payments**

Visual direction: **quiet confidence for programmable payments.** HashX is payment-control
infrastructure — verification, authorization, settlement, evidence. The interface should read like
serious financial software: light, precise, calm, and inspectable. Never a crypto dashboard, never
a "control room", never a template.

One light-first system is shared by the marketing site (`src/app/(marketing)`) and the application
(`src/app/(application)`). The only dark surface is the **ink surface** for code and raw documents.

---

## 1. Principles

1. **Whitespace creates hierarchy.** Space separates groups before borders or color do.
2. **Typography carries the design.** Big, tight, medium-weight headings; muted supporting copy. No gradient text, no all-caps headings.
3. **One meaningful visual per section / screen.** Everything else is type and hairlines.
4. **Hairlines, not boxes.** Group related data inside one surface separated by `divide-y divide-border`. Don't nest cards in cards; don't build walls of identical tiles.
5. **Violet is a signal.** `primary` appears on the primary action, the active nav icon, focus rings, the active step of a flow, and one accent per illustration. Never as a page wash, card border, or heading color.
6. **Status is semantic and never color-only.** Every state pairs an icon or dot **and** a text label with its tone.
7. **Mono is for machine data only.** Hashes, addresses, IDs, chain IDs, raw integer units, JSON, code. Labels, headings, eyebrows, and badges are sans and sentence case.
8. **Evidence is first-class.** Digests and signatures are copyable (`CopyableValue`), findable, and laid out like an audit record. Simplify presentation, never the information.
9. **Never fabricate state.** Unfinalized settlement never looks successful; illustrative data is always labelled as such.

### Removed vocabulary

Do not reintroduce: uppercase mono labels (`font-mono uppercase tracking-wider`), `//` separators,
"01 // INTENT" counters, decorative version strings (`ENGINE 2.4`, `PROTOCOL REV`, `GATE 03`, `v2`
chips), pulsing badges, glow shadows, `carbon-*` / `signal-*` / `mineral` colors, raw hex colors in
components, `bg-black/60` overlays.

---

## 2. Color tokens

Defined in `src/app/globals.css` as RGB channels, exposed through Tailwind so opacity modifiers work
(`bg-danger/10`). Arbitrary opacity is fine (`bg-success/[0.06]`).

| Token | Value | Use |
|---|---|---|
| `background` | `#FAFAF8` | Page canvas (warm off-white) |
| `surface-1` | `#FFFFFF` | Panels, cards, inputs, tables |
| `surface-2` | `#F5F4F7` | Inset areas, segmented-control track, table header tint, read-only fields |
| `surface-3` | `#F0EEF4` | Hover, selected segment |
| `surface-hover` | `#EAE8EF` | Strong hover / pressed |
| `foreground` | `#19181D` | Primary text (16.9:1) |
| `foreground-secondary` | `#5F5C66` | Body copy, secondary values (6.3:1) |
| `foreground-muted` | `#716D79` | Labels, meta, captions (4.8:1 — AA for small text) |
| `border` / `border-strong` | `#E8E6EB` / `#DAD7E0` | Hairlines / inputs, hover, emphasis |
| `primary` | `#7546D3` | Brand violet — primary buttons, focus, active markers |
| `primary-hover` | `#6338BB` | Primary hover |
| `primary-light` | `#6338BB` | Violet **text** on light (links, accent badges). Re-mapped to a light violet inside `.surface-ink` |
| `primary-subtle` | `#F0EAFC` | Brand-soft surface (final CTA, accent badge fill) |
| `success` | `#136E53` | Passed, verified, confirmed, finalized |
| `warning` | `#865509` | Needs human action, pending, **safe-but-not-final**, expiring |
| `danger` | `#AD3448` | Failed, rejected, blocked |
| `info` | `#2A62A3` | In progress, submitted, waiting on the network |

The brief's proposed `--text-muted #898691`, `--success #188465`, `--warning #A76C14` and
`--danger #BE4054` were darkened because they measured below 4.5:1 — status tones must also pass on
their own 10% tint (badges), where every tone now measures ≥ 4.9:1.

Status fills: `bg-{tone}/10` with `text-{tone}` (badges), `bg-{tone}/[0.05]` + `border-{tone}/25`
(callouts). Use `toneStyles` from `StatusBadge` rather than hand-writing these.

**Ink surface.** Add `className="surface-ink"` to a container to re-scope every token to a dark ink
palette (`#16151A` canvas, `#ECEAF0` text). Use it for code panels and raw JSON only. `CodeViewer`
already does.

---

## 3. Typography

Fonts: **Geist** (`font-sans`, also aliased as `font-display`) and **Geist Mono** (`font-mono`),
self-hosted through `next/font`. No other families.

| Role | Class | Notes |
|---|---|---|
| Marketing hero | `text-display-xl font-medium` | `clamp(44px → 76px)`, lh 1.02, tracking −0.042em |
| Marketing section | `text-display-lg font-medium` | `clamp(32px → 52px)`, lh 1.06 |
| Marketing subsection | `text-display-md font-medium` | `clamp(26px → 34px)` |
| Marketing lede | `text-lede text-foreground-secondary` | 17–20px, max ~600px measure |
| App page title | `PageHeader` | 26 → 30px semibold, tracking −0.032em |
| App section title | `SectionHeading` | 17px semibold |
| Panel title | `PanelHeader` | 15px medium |
| Body | `text-[13px]` (app) / `text-[15px]`–`text-base` (marketing) | |
| Label / meta | `text-xs text-foreground-muted` | sentence case |
| Caption | `text-2xs` (11px) | sparingly |
| Machine data | `font-mono text-xs` | hashes, addresses, raw units |

Weights: 400 body, 500 headings/labels, 600 app titles only. Never `font-bold`.
Numbers in tables, metrics and amounts: `tabular-nums`.
`.eyebrow` is a 12px sentence-case muted label — at most one per section.

---

## 4. Layout & spacing

- 4px base grid; prefer Tailwind's scale (`gap-2/3/4/6/8`, `p-4/5/6`) over arbitrary values.
- **Marketing container:** `.site-container` → max content width 1240px with responsive gutters
  (20 / 24 / 32 / 40 / 56px at base / sm / md / lg / xl).
- **Marketing section rhythm:** `.section-y` → `clamp(64px → 136px)` vertical padding.
- **App content:** `max-w-[1280px]`, `px-4 sm:px-6 lg:px-8`, `pt-6 sm:pt-8`. Page = `PageHeader` then
  `space-y-6` (or `gap-6` grid) of panels. Detail pages: 12-col grid, main `lg:col-span-8`, rail `lg:col-span-4`.

### Radii & elevation

| Token | Size | Use |
|---|---|---|
| `rounded-sm` | 4px | chips, inline code |
| `rounded` | 6px | badges, small controls |
| `rounded-md` | 8px | buttons, inputs, segmented controls, nav items |
| `rounded-lg` | 12px | panels, cards, code panels, menus |
| `rounded-xl` | 14px | modals, product frames |
| `rounded-2xl` | 20px | marketing CTA band only |

Shadows are near-invisible: `shadow-panel` (default surface), `shadow-raised` (product frames,
floating previews), `shadow-overlay` (menus, modals, drawers). No colored shadows, no glows.

---

## 5. Components (`src/components/ui`)

| Component | Purpose |
|---|---|
| `PageHeader`, `MetaItem` | Every app page starts with one: optional `back`, `eyebrow` (object type, sentence case), title, `badges`, `actions`, `meta`. |
| `Panel`, `PanelHeader`, `PanelBody`, `PanelFooter`, `SectionHeading` | Base surface (`.panel`: white, 1px border, 12px radius). |
| `MetricStrip` + `Metric` | KPIs as one hairline-divided strip — never separate tiles. Real data only. |
| `DataList` + `DataRow` | Key/value records (terms, parties, IDs). |
| `StatusBadge` (`type`: invoice/hsp/check/verdict), `StatusDot`, `toneStyles`, `resolveStatus` | All status rendering. |
| `FinalityTrack` | HSP lifecycle (Submitted → Processing → Included → **Safe · not final** → Finalized). |
| `Timeline` | Vertical audit timeline. |
| `Callout` | Inline alerts (`info`/`warning`/`danger`/`success`/`neutral`). |
| `EvidenceCard` | One verification check row; stack inside a `divide-y` container. |
| `CodeViewer` | Ink-surface JSON/code viewer with copy + line numbers. |
| `CopyableValue` | Any hash/address/ID; add `explorerUrl` for on-chain values. |
| `AmountDisplay` | Human amount + raw integer units. Never round. |
| `Button` + `buttonStyles()` | `primary` (violet), `inverse` (ink), `secondary` (white + border), `outline`, `ghost`, `danger`, `subtle`. Sizes `xs` 28 / `sm` 32 / `md` 36 / `lg` 44px, `icon`, `icon-sm`. Use `buttonStyles()` on `<Link>`. |
| `Input`, `Select`, `Textarea`, `SearchInput`, `Field`, `Segmented`, `Tabs` | Forms and filters. `Field` renders 13px labels and `role="alert"` errors; set `aria-invalid` on invalid inputs. |
| `Modal`, `Drawer` | Overlays with `bg-foreground/25` scrim. |
| `EmptyState`, `ErrorState` | Tell the user what to do next. Never placeholder records. |

Marketing components live in `src/components/marketing` (`SiteHeader`, `HeroSection`,
`TrustCircuit`, `ProcessTimeline`, `InteractiveProductPreview`, `EditorialFeatures`,
`SecurityScenarios`, `IntegrationPreview`, `SettlementRails`, `FAQAccordion`, `CTASection`,
`SiteFooter`, plus `Reveal` and `SectionHeading` primitives).

App shell: `src/components/layout` (`Sidebar`, `Topbar`, `MobileBottomNav`, `ConnectionNotice`). The persistent sidebar appears from `lg` (1024px); below that the topbar menu opens a drawer and `MobileBottomNav` provides primary navigation.

---

## 6. Patterns

**Tables** — `<table className="table-base">` inside a `Panel` with `overflow-x-auto`. Filter row
above (`Segmented` + `SearchInput`) separated by `border-b`. IDs in `font-mono text-xs`; primary
label 13px foreground with a muted 12px sub-line. Amounts right-aligned, `tabular-nums`. Clickable
rows get `hover:bg-surface-2/60` and a trailing chevron — never lift rows.

**Detail pages** — `PageHeader` with `back`, eyebrow (object type), title, status badges, actions.
Then a 12-col grid: substantive record left (8), actions/parties/timeline right (4).

**Verdict** — one clear panel: tone icon + verdict word + one-line consequence ("Payment gated",
"Eligible for payment"), then the reason, then checks with expected vs actual values.

**Authorization** — calm and deliberate: amount large (`text-[32px] font-medium tabular-nums`),
raw integer units beneath in mono, token contract, network, recipient and expiry in a `DataList`,
then a single clearly separated primary action. No celebratory animation for irreversible actions.

**Settlement state** — Sepolia: `PaymentStateBadge` (Submitted → Included · confirming → Confirmed
→ Finalized). HSP: `StatusBadge type="hsp"` + `FinalityTrack`; `payment-safe` always reads
**"Safe · Not final"** in warning tone. Only finalized/confirmed states use success tone.

**Receipts** — white paper document, hairline dividers, structured rows, print-friendly (`.no-print`
on chrome).

**Illustrative data** — any fixture shown outside the demo routes carries a visible
"Illustrative preview" label. Demo routes carry `SimulatedBadge`.

---

## 7. Motion

Motion communicates a state change, directs attention, or clarifies a sequence. Nothing loops.

| Interaction | Duration | Implementation |
|---|---|---|
| Page entrance | 520ms, 12px rise | `.animate-enter` (app content wrapper) |
| Section reveal (marketing) | 560ms, 14px rise, once | `<Reveal>` → `[data-reveal]` + IntersectionObserver; hidden only under `html.js` |
| Button hover | 150ms | color/border transitions only — no scaling |
| Card / row hover | 150–200ms | background or border change only |
| Tab / preview switch | 220ms crossfade, 4px rise | `.animate-crossfade` keyed on the active tab |
| Arrow affordance | 150ms, ≤ 3px | `group-hover:translate-x-0.5` |
| Menus, modals, drawers | 200–260ms | `animate-fade-in`, `animate-scale-in`, `animate-slide-in-left/right` |
| Accordion | 240ms | `grid-template-rows: 0fr → 1fr` |

Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (`ease-out` in Tailwind, `--ease-out` in CSS).
Forbidden: infinite animation (except loading spinners and skeleton placeholders), `animate-pulse`/`animate-ping` on status,
parallax, scroll-jacking, typewriter text, particles, cursor effects, spinning 3D, glow.
`prefers-reduced-motion: reduce` disables transitions/animations globally and shows reveal content immediately.

---

## 8. Brand

- Name **HashX**; tagline **The Trust Layer for Agent Payments**.
- Mark: the 3D violet X (`LogoMark`), served as optimized WebP (`/public/brand/hashx-mark-{64,128,512}.webp`,
  trimmed from `src/HASHX_3D_Logo_Transparent_1520.png`). Static only — never spin, bounce, or glow.
- Wordmark: Geist semibold, tracking −0.035em.
- EIP-712 domain names are signing constants — do not change them: protocol v2 (connected mode) uses `"HashX"` version `"2"`; "HashX Global" is the legacy v1 domain used only by demo fixtures.

---

## 9. Accessibility

- Status = icon/dot + text + color.
- Every interactive element is keyboard reachable with a visible 2px violet focus ring.
- Tabs use `role="tablist"`/`tab`/`tabpanel` with arrow-key navigation; accordions use
  `aria-expanded` + `aria-controls`.
- Touch targets ≥ 40px on mobile navigation.
- `prefers-reduced-motion` respected globally.
- Receipts print cleanly (`.no-print` hides app chrome).
