# HashX — Visual Redesign Report

Branch: `design/premium-visual-sprint`, created from `feat/sepolia-production-foundation` (`0240bac`). Nothing has been committed, staged,
pushed or deployed. Scope: frontend presentation only — marketing site and every application route.
Design system reference: [`docs/design-system.md`](./design-system.md).

> **Status: final QA complete — recommendation GO for a two-commit split (§10–§11).** Earlier drafts of this
> report contained two inaccuracies, corrected here: `ConnectionNotice.tsx` is **not** a redesign file
> (its only change comes from the concurrent session), and some route/component edits listed as "redesign"
> sit on top of uncommitted work from that session (see §9).

---

## 1. Before implementation

### Visual problems found (running app, `docs/screenshots/before/`)

| Area | Problem |
|---|---|
| Overall | Two unrelated aesthetics: a beige "mineral" marketing page and a near-black "carbon control room" app. |
| Typography | Uppercase monospace everywhere (`[ PROTOCOL V2 // TESTNET ]`, `01 // ACTIVE OBLIGATIONS`), all-caps headings, three font families. |
| Hierarchy | Boxed tile grids, coloured comparison borders, a dark band mid-page, decorative telemetry strips; no single focal point per section. |
| Colour | Ultramarine, mint, amber, red and slate-cyan competing; raw hex values hard-coded in ~900 places; mint text failed contrast. |
| Honesty | Decorative values shown as data: latency/assurance percentages, a fake verifier contract and block, "RISK 100/100", "100% Attested", an invented 2.40 USDC fee. |
| Components | 800-line marketing monolith; ten dead `src/components/marketing/*` files; `carbon-panel` referenced but undefined. |
| Assets | 629 KB PNG logo rendered at 24–32 px. |

### GTMMaxing principles adapted (not copied)

Light canvas with ink typography; one central workflow illustration; interactive preview tabs; numbered
process with a quiet connecting line; restrained nav, compact buttons, generous rhythm, plain accordion FAQ,
one focused closing CTA. Not used: their artwork, mascot, blue identity, copy, logos or measurements.

### HashX direction

"Quiet confidence for programmable payments": warm off-white canvas, Geist ink type, violet only as a
signal, status colours only for real states, one ink surface for code, the existing 3D violet X as the single
brand object, and the product's real records (signed intent, verification run, authorization, receipt) as
the illustrations.

---

## 2. Final visual system

### Colour (tokens in `src/app/globals.css`)

| Token | Value | Contrast |
|---|---|---|
| canvas `background` | `#FAFAF8` | — |
| `surface-1` / `-2` / `-3` | `#FFFFFF` / `#F5F4F7` / `#F0EEF4` | — |
| `foreground` | `#19181D` | 16.9 : 1 on canvas |
| `foreground-secondary` | `#5F5C66` | 6.3 : 1 |
| `foreground-muted` | `#716D79` | 4.8 : 1 |
| `primary` / `primary-hover` | `#7546D3` / `#6338BB` | 5.6 : 1 / 7.1 : 1 |
| `primary-subtle` | `#F0EAFC` | — |
| `success` | `#136E53` | 5.9 : 1 on canvas · ≥ 4.9 : 1 on its own 10 % tint |
| `warning` | `#865509` | 6.1 : 1 · ≥ 5.0 : 1 on tint |
| `danger` | `#AD3448` | 6.0 : 1 · ≥ 4.9 : 1 on tint |
| `info` | `#2A62A3` | 6.0 : 1 · ≥ 4.9 : 1 on tint |

Deviations from the brief's proposal: muted text, success, warning and danger were darkened. The final QA
pass found status badges at 4.27–4.47 : 1 (tone text on a 10 % tint of itself), so the status tones were
darkened a second time. `.surface-ink` re-scopes all tokens to an ink palette (`#16151A`) for code.

### Typography

Geist + Geist Mono via `next/font` (replacing Inter, Space Grotesk, JetBrains Mono).
Hero `clamp(44 → 76px)` weight 500 tracking −0.042em; sections `clamp(32 → 52px)`; subsections
`clamp(26 → 34px)`; lede `clamp(17 → 20px)` at ≤ 600px measure; app page titles 26 → 30px weight 600;
body 13px (app) / 15–16px (marketing); labels 12–13px sentence case; mono only for machine data.

### Grid & spacing

Marketing `.site-container` (1240px content, gutters 20/24/32/40/56px) and `.section-y`
(`clamp(64 → 136px)`). App content 1280px max. **Persistent sidebar from 1024px (`lg`)**; below that, a
topbar menu drawer plus bottom navigation (changed during QA — at 768px the sidebar left only ~520px of content).
Radii 6/8/12/14/20px; near-invisible ink shadows; no coloured shadows or glows.

### Motion

| Interaction | Implementation |
|---|---|
| Hero entrance | eyebrow/lede/CTAs/circuit: `.animate-enter` 520ms fade + 12px rise. **Headline: `.animate-rise` (transform only)** so the LCP element paints immediately |
| Section reveal | `<Reveal>` IntersectionObserver, once, 560ms; hidden only under `html.js` |
| Circuit stages | 300–500ms colour/border transitions |
| Preview tabs | keyed `.animate-crossfade` 220ms; panel min-height prevents layout shift |
| Accordions | `grid-template-rows` 0fr → 1fr, 240ms; collapsed content `inert` |
| Hover | 150ms colour transitions; arrows move 2px |
| App page change | `.animate-enter` on the content wrapper |
| Overlays | fade / scale-in / slide-in-left drawer, 200–260ms |

Nothing loops except loading skeletons. `prefers-reduced-motion: reduce` neutralises all transitions and
animations (verified in browser, §6). No animation library added.

---

## 3. Design critique against GTMMaxing's principles (final pass)

| Principle | Assessment |
|---|---|
| Typography carries hierarchy | Met. One display family, tight tracking, medium weights; mono confined to machine data. |
| Spacing / rhythm | Met on marketing (fluid section rhythm, open hairline layouts). App pages use consistent 24px panel gaps. |
| Restraint | Met. Violet appears on primary actions, focus, active markers and one accent per illustration; no gradients, glows or loops. |
| One visual per section | Met on marketing (circuit, timeline, framed preview, pillar micro-visuals, scenario table, code panel). |
| Component consistency | Met. Shared primitives across all routes; legacy `carbon-*`/`signal-*` palettes fully removed (0 occurrences, browser-verified). |
| Animation quality | Restrained and state-driven; reduced-motion verified. |
| Responsive behaviour | Fixed during QA: tablet shell (sidebar → `lg`), trust-detail rail (8/4 split → `xl`), composer stepper and hero stage tabs at 360px. Verified with true device emulation at 1440/1024/768/390/360. |
| Remaining softness | The developer reference page is long and table-heavy at all widths; the approval/settlement fixture merchant is literally named "HashX", so titles read "Payment to HashX" (fixture content, not layout). |

---

## 4. Screenshots

`docs/screenshots/after/` — **45 captures** from the final production build: homepage plus eight major app
screens (`/app`, `/app/invoices/new`, trust detail, approval detail, settlement detail, receipt detail,
`/app/developers`, `/app/demo`) at **1440, 1024, 768, 390 and 360px**, full page, via
`scripts/shot.mjs` (DevTools device emulation). `docs/screenshots/before/` holds the pre-sprint captures;
its 390px files are cropped ~500px renders (headless window-size limit), not true mobile widths.

---

## 5. Marketing-claims audit (final)

Checked against `docs/PRODUCTION_READINESS.md`, `docs/api-contracts.md`, `shared/networks.ts`,
`shared/protocol.ts` and `server/src`:

| Claim | Status |
|---|---|
| Sepolia test USDC rail "Implemented · testnet" | Accurate. **Added:** "Verified on a local EVM; not yet executed on Sepolia" (readiness: live transfer *implemented, not yet executed*). |
| HashKey HSP "Not connected · fail-closed", mainnet "Disabled by design" | Accurate (`503 HSP_NOT_CONNECTED`, config flags). |
| HashKey delivery checks | **Fixed:** was "Supported" (config flag only); now "Implemented; requires an RPC endpoint". |
| Evidence-registry deployment / on-chain anchoring | Not claimed anywhere on the marketing site (registry is not deployed on Sepolia). |
| EIP-712 domain in the Sepolia preview | **Fixed:** was "HashX Global" (legacy v1 demo domain); protocol v2 is `"HashX"`, version `"2"`. |
| Payment finality | Hero circuit never shows settlement complete; receipt preview shows *Confirmed* with *Finalized* pending, matching the API (receipt at `CONFIRMED`, `confirmations:12` default). |
| Human authorization | **Fixed wording:** "Two explicit approvals by the human payer" (Stage 1 is a session approval; only Stage 2 is a wallet signature). |
| MCP: 9 tools, no approval tool; non-custodial; SIWE + scoped agent credentials | Accurate. |
| Illustrative data | Every fixture outside demo routes carries "Illustrative preview"; security scenarios are labelled simulated. |

---

## 6. Functional & accessibility verification (browser, final build)

`scripts/qa-interactions.mjs` drives the production build in headless Edge via DevTools Protocol with real
clicks and key events. **Final run: 62 / 62 checks passed.** Coverage:

- **Marketing:** every `#anchor` has a target; 5 internal links return 200; 4 external links open in a new tab with `rel`; CTA destinations; skip link → `<main>`; trust-circuit tabs (click, Arrow keys, wrap, roving tabindex, caption live region, settlement never complete); product-preview tabs (click, End key, content swap, stable panel height); security rows (single-open, `inert` toggling); FAQ (Enter expands/collapses, `region` role); code copy confirmation.
- **Mobile menu:** opens, moves focus into the panel, locks scroll; Escape closes and returns focus to the toggle. No horizontal overflow at 390 and 360px.
- **App:** 15 routes render with an `<h1>`, zero console errors, zero legacy classes, no page-level overflow; sidebar (9 destinations, `aria-current`); Demo ↔ Connected mode toggle (Connected shows the wallet gate and the backend-unreachable notice — no backend runs in this environment); wallet menu open/Escape; network selector; composer step advance; approval primary action disabled until the recipient/amount acknowledgement is checked; trust check rows expand; receipt Print invokes `window.print`; Proof Lab and developer tabs; mobile app drawer Escape; 390px overflow on four dense screens.
- **Keyboard:** first focus stop is the skip link; every stop in the header/hero sequence shows a visible focus indicator.
- **Reduced motion:** with `prefers-reduced-motion: reduce` emulated, all 22 reveal sections are fully visible and transition/animation durations are neutralised.
- **Contrast scan:** 877 rendered text elements on 5 key screens (home, overview, trust detail, approval detail, receipt detail) all ≥ WCAG AA after fixes. The scanner composites alpha over ancestor backgrounds and skips gradients/images — it is an approximation, not axe-core.

**Not performed:** a screen-reader audit (NVDA/VoiceOver), real-device testing, Lighthouse.

Defects found and fixed during this QA pass (frontend only):

| Defect | Fix |
|---|---|
| Status badges 4.27–4.47 : 1 | Darker status tokens (§2) |
| Segmented-control counts 3.17 : 1, DataRow hints 2.81 : 1, evidence "Actual" label 3.32 : 1, failed-count 80 % opacity | Full-strength token colours |
| Wrong EIP-712 domain, over-stated HashKey verification, imprecise approval wording | Copy fixes (§5) |
| Approval/settlement H1 showed only "HashX" | Titles now "Payment to {merchant}" |
| 768px: sidebar squeezed content to ~520px | Sidebar/bottom-nav breakpoint `md` → `lg` |
| 1024px: trust-detail rail wrapped amounts and truncated payee | 8/4 split moved to `xl` |
| 360px: composer stepper clipped steps 3–4; hero stage tab truncated | Active-only step labels on phones, compact connectors; compact tab sizing |
| Hero LCP delayed by headline fade-in | Transform-only headline entrance |

---

## 7. Build / typecheck / lint / test results (final code)

| Check | Result |
|---|---|
| `tsc --noEmit` | exit 0, 0 errors |
| `next lint` | exit 0 — **0 errors, 38 warnings.** All are `no-explicit-any`, `react-hooks/exhaustive-deps` or unused-variable warnings in logic code; the two in redesigned pages (`router` in invoices list, `invoice` in receipt detail) were verified to be unused in the pre-sprint baseline as well. None introduced by this sprint. |
| `vitest run` | 5 files, 56 / 56 tests passed |
| `next build` | exit 0; 16 / 16 routes (11 static, 5 dynamic); 38 lint warnings echoed in build output; homepage 17.2 kB route JS / 134 kB first load |
| `git diff --check` | clean (only `core.autocrlf` line-ending notices); untracked redesign files have no trailing whitespace |
| Browser QA | 62 / 62 (§6) |

Backend (`server/`) and contract tests were not run by this sprint (no backend/contract code changed by it).

### Performance (`scripts/perf.mjs`; 390px, 4× CPU, ~1.6 Mbps / 150ms RTT, cache off, median of 3, local `next start`)

| Route | LCP | FCP | CLS |
|---|---|---|---|
| `/` | 816 ms | 816 ms | 0.001 |
| `/app` | 1440 ms | 608 ms | 0.000 |
| `/app/invoices/new` | 2780 ms | 2040 ms | 0.000 |
| `/app/trust` | 2860 ms | 2024 ms | 0.006 |

Run-to-run variance on this machine is large (the same static app routes measured 1.4–1.9 s in other runs).
**Dynamic routes** (`/app/trust/[id]`, `/app/approvals/[id]`) measured 12–19 s under the emulated network
but 0.4–0.6 s FCP with only CPU throttling, with server responses of 22–28 ms and full shell HTML — consistent
with DevTools network emulation stalling streamed responses rather than a real regression. This is **not
proven** for real networks; confirm with Lighthouse / RUM on a deployed preview. These are not Lighthouse scores.

---

## 8. Product-integrity confirmation

No smart contract, EIP-712 schema, hash algorithm, verification rule, database schema, HSP adapter, network
configuration, settlement state machine or API contract was changed by this sprint. Handlers, effects, API
calls, signing calls, stage sequencing, routes and honesty labels were preserved (browser-verified flows in §6).
Narrow UI-layer fixes: removal of fabricated display values, two unit-display bugs (raw token units shown as
cents; double unit labels), a composer hydration mismatch, and the expiry-countdown text format.

---

## 9. Working-tree ownership audit

Evidence: the git status snapshot at sprint start, both sessions' Claude transcripts (tool calls with
timestamps), file modification times, and exact pre-sprint baselines reconstructed from the sprint's own
full-file reads taken before its first edit of each file.

**Concurrent session** (Sepolia production-foundation work, plus its subagents) had uncommitted frontend/backend/docs
work before this sprint and kept editing during it: `Topbar.tsx` (10:04Z), `Sidebar.tsx`, `ConnectionNotice.tsx`,
`formatters/index.ts` (10:05Z), marketing page + legacy marketing components (10:06–10:07Z), `fixtures.ts`,
`eip712.ts`, `CopyableValue.tsx`, `ProofCircuit.tsx`, ESLint setup + `package.json`/`pnpm-lock.yaml` (10:08–10:13Z),
lint escapes in four app files (11:18–11:19Z), `hardhat.config.js` + `server/tests/setup/global.ts` (11:22Z).
It also ran `rm -rf .next && pnpm build` at 11:20Z, which explains the dev-server corruption during the sprint.
No sprint edit overwrote a concurrent edit made after the sprint read the file; where the sprint rewrote a whole
file (marketing page, Sidebar) the concurrent session's intent (honest copy) is preserved in the new content.

**`package.json` description mojibake (`â€”`)** was introduced by the concurrent session at 09:59Z (Python
`json.load(open(p))` without an encoding, then `json.dump`). The file is concurrent-owned and this sprint never
modified it, so it was **left unchanged** — the other session should fix it (`"HashX — The Trust Layer for Agent Payments"`).

| Category | Count |
|---|---|
| Redesign-only files | 49 |
| Concurrent-only files | 43 |
| Mixed (both sessions) | 42 — **27 with an exact hunk split**, 15 without |

### Redesign-only files (commit-ready as whole files)

`docs/design-system.md`, `docs/VISUAL_REDESIGN_REPORT.md`, `docs/screenshots/**`, `tailwind.config.ts`,
`src/app/globals.css`, `src/app/layout.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`,
`src/app/(application)/app/layout.tsx`, `src/components/layout/MobileBottomNav.tsx`, `src/components/brand/Logo.tsx`,
`src/components/marketing/{primitives, SiteHeader, HeroSection, TrustCircuit, ProcessTimeline, InteractiveProductPreview, EditorialFeatures, SecurityScenarios, IntegrationPreview, SettlementRails, FAQAccordion, CTASection, SiteFooter}.tsx`,
deletion of `src/components/marketing/MarketingHeader.tsx`,
`src/components/ui/{AmountDisplay, Button, CodeViewer, DataList, Drawer, EmptyState, EvidenceCard, Field, FinalityTrack, Metric, Modal, PageHeader, Panel}.tsx`,
`src/components/{approvals/approval-primitives, invoices/InvoiceStepper, receipts/ReceiptDocument, trust/CheckListPanel, trust/EvidenceHashes, trust/VerdictBand}.tsx`,
`public/brand/hashx-mark-{64,128,512}.webp`, `scripts/{shot, perf, qa-interactions}.mjs`.

### Mixed files with an exact split (27)

For each, `.qa/commit-prep/design-hunks/<file>.patch` holds exactly this sprint's hunks and
`.qa/commit-prep/concurrent-hunks/<file>.patch` exactly the concurrent session's (all 54 patches validated:
design patches reverse-apply to the working tree, concurrent patches apply to HEAD).

`.gitignore` (design: the `.qa/` block) · `src/components/ui/CopyableValue.tsx` (design: `max-w-full`; concurrent: explorer aria-label) ·
`src/lib/formatters/index.ts` (design: expiry-duration text; concurrent: explorer-URL block) · `src/components/layout/Topbar.tsx` ·
`src/components/layout/Sidebar.tsx` · `src/components/brand/ProofCircuit.tsx` (deleted by design) ·
app routes `approvals`, `approvals/[id]`, `demo`, `developers`, `invoices`, `receipts`, `receipts/[id]`, `settings`, `settlements`, `settlements/[id]`, `trust`, `trust/[id]` ·
`src/components/live/{dashboard/LiveDashboard, invoices/LiveInvoiceList, invoices/shared, payments/LiveSettlements, receipts/LiveReceipts, receipts/LiveReceiptDetail, settings/AgentCredentials, settings/SettingsSections, trust/LiveTrustInspector, trust/LiveTrustList}.tsx`.

### Mixed files without an exact split (15) — must be committed whole

The sprint edited these through scripts without a complete pre-edit read, so pre-sprint content is not
recoverable hunk-for-hunk: `src/app/(application)/app/page.tsx`, `invoices/[id]/page.tsx`, `invoices/new/page.tsx`,
`src/app/(marketing)/page.tsx` (fully rewritten by the redesign), `src/components/demo/ScenarioEvidence.tsx`,
`src/components/live/payments/LiveApprovalDetail.tsx`, and the deletions of 8 legacy marketing components the
concurrent session had copy-patched (`ArchitectureSection`, `DeveloperSection`, `Hero`, `MarketingFooter`,
`Pillars`, `ProblemSection`, `ProductShowcase`, `TrustPipelineVisual`).

---

## 10. Recommended commit plan (not executed)

The redesigned routes import the concurrent session's uncommitted modules (`src/components/live/*`,
`src/lib/live/*`, `AppContext`), so the redesign cannot be committed before that work. Validated sequence:

1. **Concurrent session's commit (owned by that session):** its 43 concurrent-only files, the 27 concurrent
   patches (`git apply --cached .qa/commit-prep/concurrent-hunks/*.patch`), and `LiveApprovalDetail.tsx` whole
   (required by the approvals route; carries this sprint's restyle). **Verified in a temporary detached worktree
   from HEAD: `tsc` 0 errors, 56/56 tests, `next build` 16/16 routes.** (Worktree removed afterwards.)
2. **Redesign commit:** everything else — the 49 redesign-only files, the remaining design hunks, and the 14
   whole-file mixed items above (whose concurrent portions — live-mode wiring and copy patches — ride along and
   should be co-attributed in the message). The result equals the current working tree, which passes all checks in §7.

Alternative: one combined commit with both sessions credited — simplest, but mixes two workstreams.

---

## 11. Remaining issues

- Screen-reader audit, Lighthouse and real-device checks not performed.
- Dynamic-route performance under real networks unconfirmed (§7).
- Demo fixtures still describe HashKey Chain / USDT / HSP while marketing and connected mode describe Sepolia (simulated-labelled fixture content, protocol-sprint scope).
- `package.json` mojibake — concurrent-owned, not changed (§9).
- 38 pre-existing lint warnings remain.
