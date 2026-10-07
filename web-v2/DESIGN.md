# Emdad WMS V2 — Design reference

Working reference for `web-v2/` (admin + client). Source of truth for values is code:
`packages/ui/src/styles/tokens.css` (tokens), `packages/ui/src/status/tones.ts` (status colours).

## Identity
- Dark-green shell (`--sidebar #053424`, gradient + warehouse artwork), mint canvas (`--background #dcebdf`), light content sheet (`--sheet #f2f8f3`), white cards.
- Layering: **mint canvas → `bg-sheet` → white `Card`**. Never put a card straight on the canvas.
- Brand = Emdad green (primary `#0a4a33`, active nav `#bbf5b1`). This **overrides** the Creative-Tim "orange" rule for `web-v2/`. No purple/violet.
- Fonts: Inter (Latin) + IBM Plex Sans Arabic. Body >= 14px, helper text >= 12px, no arbitrary `text-[..px]`.

## Colour rules (audit findings solved by construction)
1. Red (`destructive`) means **danger only**. Reset / Clear = `ghost`. Green is never a destructive colour.
2. One status vocabulary: 9 tones (`neutral pending progress ready transit success warning danger returned`). Every badge, status card, legend dot and chart slice uses `toneClasses` / `var(--tone-X-dot)`.
3. Every fg/bg pair is verified >= 4.5:1 by `npm run check:contrast` (light and dark).
4. Charts use `--chart-1..6` in fixed order; status charts use tone dots.

## Layout, spacing, tables
- Page = `PageHeader` → filters → KPI strip → widgets. Gaps 12/16/20px (`gap-3/4/5`); cards `p-5`; rounded `xl`.
- `DataTable<T>`: TanStack manual pagination; every column declares `meta { priority, align, className }` (fixed widths = the column contract). Responsive by **container query**: table >= `@2xl`, row cards below; priority-2 columns >= `@4xl`, priority-3 >= `@6xl`. Row actions use `cardAction`.
- Sidebar becomes an off-canvas sheet below `lg` (1024px). Tap targets >= 40px. No horizontal page scroll at 390/768/1440 (checked by `scripts/e2e/shots.mjs`).

## RTL / i18n
- Logical utilities only (`ms-/me-/ps-/pe-/start-/end-/text-start`); `check:rtl` lints `ml-/mr-/pl-/pr-/left-/right-/text-left/right`.
- Radix `Direction` provider via `UiProviders`; Arabic digits are Latin (`ar-SY-u-nu-latn`).
- Directional icons use `rtl:-scale-x-100`.

## Interaction patterns
- Status cards (OMS/online orders) are **filter buttons**; operational-stage chips and "action by QR" are buttons — unchanged from the classic UI.
- Destructive/irreversible actions use `ConfirmDialog` (`intent="danger"`, cancel = outline, never `window.confirm`).
- Loading = skeleton in place; empty/error = `EmptyState` / `ErrorState` with a retry.

## Independence
`web-v2/` imports nothing from `frontend/`, `client-frontend/`, `shared/design-system*` (`npm run check:independence`). Logic is copied, not linked.
