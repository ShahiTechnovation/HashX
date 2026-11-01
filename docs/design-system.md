# HashX — Design System

**HashX · The Trust Layer for Agent Payments**

HashX is payment-control infrastructure: verification, authorization, settlement, evidence. The interface should read like serious financial software — precise, quiet, inspectable — never like a crypto dashboard or a template.

Reference points: Stripe (clarity), Linear (polish), Fireblocks (trust), block explorers (inspectability).

---

## 1. Principles

1. **Hierarchy over decoration.** One primary focus per screen. Secondary information gets smaller type and muted color, not another card.
2. **Hairlines, not boxes.** Group related data inside one panel, separated by `divide-y divide-border/60`. Don't nest cards inside cards. Don't build grids of identical boxed tiles.
3. **Violet is a signal.** `primary` appears on: the primary CTA, active nav indicator, focus rings, JSON keys, and one highlight per diagram. Never as a page wash, card border, or heading gradient.
4. **Status is semantic and never color-only.** Every state has an icon/shape + label.
5. **Mono is for machine data only.** Hashes, addresses, IDs, raw units, code. Labels, headings, and badges are sans.
6. **Evidence is first-class.** Digests, signatures, and reason codes are always copyable, always findable, and laid out like an audit record.
7. **Motion is architectural.** Short fades (`animate-fade-in`), slide-in drawers, color transitions on hover. No glow pulses, floating, or bouncing.

---

## 2. Tokens

Defined in `src/app/globals.css` as RGB channels; exposed via Tailwind so opacity modifiers work (`bg-danger/10`, `ring-primary/25`). Valid opacity steps are multiples of 5 or arbitrary (`/[0.06]`) — `/12` is not generated.

| Token | Use |
|---|---|
| `background` | App canvas (graphite blue-black) |
| `surface-1` | Panels |
| `surface-2` | Inputs, hovered rows, inset areas |
| `surface-3` | Selected segment, raised chips |
| `foreground` | Primary text (warm near-white) |
| `foreground-secondary` | Body copy, values of secondary importance |
| `foreground-muted` | Labels, meta, captions |
| `border` / `border-strong` | Hairlines / hover & emphasis lines |
| `primary` (+`-hover`, `-light`) | Electric violet accent — sparingly |
| `success` | Mint — passed, finalized |
| `warning` | Amber — needs action, safe-but-not-final, expiring |
| `danger` | Muted rose — failed, rejected, blocked |
| `info` | Cool blue — in progress, pending network |

Shadows: `shadow-panel` (default surfaces), `shadow-raised` (floating previews), `shadow-overlay` (menus, modals, drawers).

Radii: controls `rounded-md` (6px), panels `rounded-lg` (8px), modals `rounded-xl`. **Never** `rounded-2xl`/`rounded-full` on containers. Pills only for dots/avatars.

---

## 3. Typography

- **UI:** Inter (`font-sans`). Body `text-[13px]`, small `text-xs` (12px), caption `text-2xs` (11px).
- **Display:** Geist (`font-display`). Page titles, metric values, marketing headlines. Tight tracking (`tracking-[-0.025em]` → `-0.04em` at large sizes). Weight `font-semibold` max — never `font-bold`.
- **Mono:** Geist Mono (`font-mono`) at `text-xs`/`text-2xs` for machine data only.
- **Eyebrow:** `.eyebrow` class — 11px sans uppercase, 0.08em tracking, muted. Use sparingly (one per section at most).
- Numbers: always `tabular-nums`.

Scale in the app: page title 24px → section 15px → panel title 14px → body 13px → meta 12px → caption 11px.

---

## 4. Components (`src/components/ui`)

| Component | Purpose |
|---|---|
| `PageHeader`, `MetaItem` | Every app page starts with one. Supports `back`, `eyebrow`, `badges`, `actions`, `meta`. |
| `Panel`, `PanelHeader`, `PanelBody`, `PanelFooter`, `SectionHeading` | Base surface. A page is usually 2–5 panels in a 12-col grid. |
| `MetricStrip` + `Metric` | KPIs as one hairline-divided strip, not separate cards. |
| `DataList` + `DataRow` | Key/value records (terms, parties, IDs). |
| `StatusBadge` (`type`: invoice/hsp/check/verdict), `StatusDot`, `toneStyles`, `resolveStatus` | All status rendering. |
| `FinalityTrack` | HSP lifecycle: Submitted → Processing → Included → **Safe (not final)** → **Finalized**. Use anywhere a payment's settlement state is shown. |
| `Timeline` | Vertical audit timeline (`done`/`current`/`pending`/`failed`/`warning`). |
| `Callout` | Inline alerts (`info`/`warning`/`danger`/`success`/`neutral`). |
| `EvidenceCard` | One verification check row; stack inside a `divide-y` container. Pass `index` for numbered checks. |
| `CodeViewer` | JSON with syntax highlighting + line numbers. `title`, `language`, `actions`, `maxHeight`. |
| `CopyableValue` | Any hash/address/ID. Add `explorerUrl` for on-chain values. |
| `AmountDisplay` | USD + token amounts with raw-unit notice. |
| `Button` + `buttonStyles()` | Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`, `subtle`, `inverse`. Sizes: `xs`/`sm`/`md`/`lg`/`icon`/`icon-sm`. Use `buttonStyles()` on `<Link>` rather than nesting `<Button>` inside `<Link>`. |
| `Input`, `Select`, `Textarea`, `SearchInput`, `Field`, `Segmented`, `Tabs` | Forms and filters. |
| `Modal`, `Drawer` | Overlays; both accept `footer`. |
| `EmptyState`, `ErrorState` | Empty/error. Place inside panels; no dashed borders. |

CSS classes: `.panel`, `.panel-inset`, `.eyebrow`, `.input`, `.select`, `.table-base` (dense data tables), `.bg-grid`, `.bg-dots`.

---

## 5. Patterns

**Tables** — `<table className="table-base">` inside a `Panel` with `overflow-x-auto`. Filter row above (`Segmented` + `SearchInput`) separated by `border-b`. IDs in mono `text-xs`; primary label in 13px foreground with a muted 11px sub-line. Amounts right-aligned, tabular. Rows clickable with a hover-revealed chevron.

**Detail pages** — `PageHeader` with `back`, eyebrow (object type), mono ID or human title, status badges, and actions. Then a 12-col grid: main column (8) with the substantive record; right rail (4) with actions, parties, and timeline.

**Verdict bands** — a full-width panel whose left edge carries a 2px tone bar, large display verdict, and a one-line plain-language consequence ("Payment gated", "Eligible for payment").

**Settlement state** — always pair `StatusBadge type="hsp"` with `FinalityTrack`. `payment-safe` must always read **"Safe · Not final"** in amber; only `payment-finalized` is mint.

**Amounts for authorization** — show human amount large, raw integer units directly beneath in mono, token contract and decimals adjacent. Never round.

---

## 6. Brand

- Name: **HashX**. Tagline: **The Trust Layer for Agent Payments**.
- Mark: `LogoMark` — two broken diagonal strokes with a violet anchor square. Wordmark set in Geist semibold.
- "HashX Global" survives only as the EIP-712 domain name (a signing constant — do not change).

---

## 7. Accessibility

- Status pairs icon + text + color.
- All interactive elements are keyboard-reachable with a visible violet focus ring.
- `prefers-reduced-motion` disables animation globally.
- Receipts have print styles (`.receipt-container`, `.no-print`).
