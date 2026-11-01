# HashX Global V1 — Design System

## Aesthetic: Obsidian × Electric Violet
HashX Global is designed for serious enterprise financial infrastructure, combining:
- **45% Premium Financial Infrastructure**: Stripe-like financial precision, tabular numerals, unambiguous currency values, and operational gravity.
- **30% Modern Productivity Workspace**: Linear-like information density, refined sidebar navigation, keyboard shortcuts, and crisp interactions.
- **15% Cybersecurity Observability**: High-visibility verification verdicts (PASS / FAIL / PENDING), evidence cards with expected vs actual telemetry, and failure reason codes.
- **10% Blockchain Technical Tooling**: Copyable EVM addresses, transaction hashes, EIP-712 digests, block heights, and network tags.

---

## 1. Color Palette Tokens

```css
:root {
  --background: #0B0911;
  --surface-1: #13101B;
  --surface-2: #1A1525;
  --surface-3: #241D31;
  --surface-hover: #2B233A;

  --primary: #8238E8;
  --primary-hover: #934DF0;
  --primary-light: #B78AFF;
  --primary-subtle: #392451;

  --foreground: #F3F0F8;
  --foreground-secondary: #ACA5BA;
  --foreground-muted: #81798F;

  --border: #332C40;
  --border-strong: #4B405C;

  --success: #42CA9B;
  --warning: #E6AF58;
  --danger: #ED7082;
  --info: #8F9BEE;
}
```

---

## 2. Accessibility Guidelines (WCAG 2.2 AA)
- **Status is Never Conveyed by Color Alone**: Every badge, verdict, and state indicator couples a distinct semantic color with an explicit textual label and icon.
- **Keyboard Navigation**: All interactive elements (buttons, inputs, accordions, modals, drawers) support complete keyboard control with visible `:focus-visible` violet rings.
- **Tabular Figures**: Monetary amounts and token counts use `.tabular-nums font-mono` to prevent shifting columns and alignment confusion.
- **Print Optimization**: Verifiable receipts include `@media print` rules for clean, ink-friendly rendering.
