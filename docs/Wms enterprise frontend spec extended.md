# WMS Frontend — Extended Enterprise Production Specification
## Arabic/RTL · Semantic Color · Safe Messaging · Permission UX · Tablet · Operational Polish

> **Document status:** Extension of the WMS Frontend Modernization Blueprint.  
> Read this together with the original blueprint. This document adds 8 enterprise-grade requirement layers without modifying the original phasing or component plan.

---

## Table of Contents

- [A. Arabic / RTL / Localization Architecture](#a-arabic--rtl--localization-architecture)
- [B. Extended Operational Semantic Color System](#b-extended-operational-semantic-color-system)
- [C. Production-Safe Messaging System](#c-production-safe-messaging-system)
- [D. Content Cleanup & Terminology Standardization](#d-content-cleanup--terminology-standardization)
- [E. Realtime Operational UX (Extended)](#e-realtime-operational-ux-extended)
- [F. Permission-Aware UX](#f-permission-aware-ux)
- [G. Tablet & Warehouse Device UX](#g-tablet--warehouse-device-ux)
- [H. Enterprise Operational Polish Layer](#h-enterprise-operational-polish-layer)
- [Appendix C — Phase Integration Map](#appendix-c--phase-integration-map)

---

## A. Arabic / RTL / Localization Architecture

### A.1 Current State Assessment

The system today has an incomplete, ad-hoc i18n approach:

| Gap | Admin | Client Portal |
|-----|-------|---------------|
| Translation library | Inline `Record<string,string>` maps per file | None |
| RTL switching | `document.dir = 'rtl'` | Same |
| `lang` attribute update | **Missing** | **Missing** |
| String coverage | Partial | English only |
| Operational terminology | Not standardized | Not standardized |
| Font stack for Arabic | Not defined | Not defined |
| Bidirectional icon handling | Not reviewed | Not reviewed |

### A.2 Localization Architecture

**Adopt a single i18n library.** The recommended choice is `react-i18next` with the `i18next` backend — it is the industry standard, supports namespaces, lazy loading, RTL context, and plural rules.

```
shared/
└── i18n/
    ├── i18n.ts                  # init: lng detection, fallback 'en', ns list
    ├── locales/
    │   ├── en/
    │   │   ├── common.json      # shared UI chrome (nav, buttons, pagination)
    │   │   ├── orders.json      # order domain terminology
    │   │   ├── tasks.json       # task domain terminology
    │   │   ├── inventory.json   # inventory domain terminology
    │   │   ├── auth.json        # login, session messages
    │   │   └── errors.json      # safe operational error messages
    │   └── ar/
    │       ├── common.json
    │       ├── orders.json
    │       ├── tasks.json
    │       ├── inventory.json
    │       ├── auth.json
    │       └── errors.json
    └── hooks/
        └── useDir.ts            # returns 'rtl' | 'ltr' from i18next language
```

**i18n initialization (`shared/i18n/i18n.ts`):**

```typescript
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    ns: ['common', 'orders', 'tasks', 'inventory', 'auth', 'errors'],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'wms-ui-language',
    },
    interpolation: { escapeValue: false },
  });
```

### A.3 RTL/LTR Switching Architecture

**Language change must trigger ALL of the following — atomically:**

```typescript
// shared/i18n/hooks/useLanguageSwitch.ts
export function useLanguageSwitch() {
  const { i18n } = useTranslation();

  const switchLanguage = useCallback((lang: 'en' | 'ar') => {
    i18n.changeLanguage(lang);                          // (1) update i18next
    document.documentElement.lang = lang;               // (2) update lang attribute
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';  // (3) update dir
    localStorage.setItem('wms-ui-language', lang);      // (4) persist
  }, [i18n]);

  return { switchLanguage, currentLang: i18n.language };
}
```

**Current bug fix:** The existing code sets `dir` but never updates the `lang` attribute. Screen readers use `lang` to select the correct voice and pronunciation engine. This must be fixed in Phase 3.

### A.4 Arabic Typography

Arabic requires a specific font stack separate from the Latin system stack. Do not use the same `font-family` for both.

```css
/* In shared/design-system/globals.css — extend the existing token set */

/* Latin (existing) */
--font-sans: 'DM Sans', 'Geist', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;

/* Arabic — NEW */
--font-arabic: 'IBM Plex Arabic', 'Noto Naskh Arabic', 'Cairo',
               'Segoe UI', Tahoma, Arial, sans-serif;

/* Automatic switch via CSS logical properties + [lang] selector */
[lang="ar"] {
  font-family: var(--font-arabic);
  /* Arabic glyphs are naturally larger at the same point size */
  --text-sm-size: 0.9375rem;  /* 15px instead of 14px for Arabic body */
  --text-base-size: 1.0625rem; /* 17px instead of 16px */
}
```

**Arabic typography rules:**
- Use `IBM Plex Arabic` (open source, excellent legibility at small sizes). Load via Google Fonts or self-host.
- Arabic text renders approximately 15–20% taller than Latin at the same font size. Adjust line heights: `leading-relaxed` for Arabic body text.
- Never use `letter-spacing` or `tracking-wide` on Arabic text — Arabic does not use inter-character spacing.
- Table header `uppercase` transformation does not apply to Arabic. Use `font-semibold` only, no `uppercase`.
- Numeric quantities, SKUs, lot numbers, and order IDs always remain in Latin numerals and LTR direction, even in RTL layout. Wrap these in `<bdi>` or `<span dir="ltr">`.

```html
<!-- Correct: numeric data in RTL layout -->
<td dir="ltr" class="font-mono text-sm">INB-00142</td>
<td dir="ltr" class="font-mono text-sm">1,250.00</td>
```

### A.5 RTL Layout Architecture

Use **CSS logical properties** throughout all new components. This eliminates the need for RTL-specific overrides.

| Avoid (physical) | Use (logical) |
|-----------------|---------------|
| `margin-left` | `margin-inline-start` |
| `padding-right` | `padding-inline-end` |
| `border-left` | `border-inline-start` |
| `left: 0` | `inset-inline-start: 0` |
| `text-align: left` | `text-align: start` |
| `float: right` | `float: inline-end` |

**Tailwind logical property classes** (Tailwind v3.3+):

```
ms-4  → margin-inline-start (replaces ml-4)
me-4  → margin-inline-end   (replaces mr-4)
ps-4  → padding-inline-start
pe-4  → padding-inline-end
start-0 → inset-inline-start: 0
end-0   → inset-inline-end: 0
```

All new shared components (Phase 1+) must use logical properties. Legacy page components can be migrated in Phase 6.

### A.6 Bidirectional Icon Handling

Some icons have inherent directionality and must flip in RTL. Others are neutral.

**Must mirror in RTL:**

| Icon | Usage | Mirror method |
|------|-------|---------------|
| `ChevronRight` / `ChevronLeft` | Breadcrumb separator, nav arrows | `[dir=rtl] .icon-directional { transform: scaleX(-1); }` |
| `ArrowRight` / `ArrowLeft` | Back/forward actions | Same |
| `ArrowLeft` (back link) | "← Back to orders" | Flip to → in RTL |
| Timeline connector arrows | Workflow stepper | Flip |

**Must NOT mirror in RTL:**

| Icon | Reason |
|------|--------|
| `CheckCircle`, `XCircle` | Symmetric |
| `Package`, `Truck`, `Warehouse` | Semantic, not directional |
| `Bell`, `Search`, `Settings` | Symmetric |
| `BarChart`, `PieChart` | Data, neutral direction |

**Implementation:**

```tsx
// shared/components/icons/DirectionalIcon.tsx
export function DirectionalIcon({ icon: Icon, ...props }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  return <Icon
    {...props}
    style={{ transform: isRTL ? 'scaleX(-1)' : undefined, ...props.style }}
  />;
}
```

### A.7 Mixed-Language Content Handling

The WMS operates in a bilingual environment where some data is always in one language regardless of UI language:

| Content type | Direction rule |
|-------------|---------------|
| Order numbers (INB-00142) | Always LTR, `dir="ltr"`, `font-mono` |
| SKU codes | Always LTR |
| Lot numbers | Always LTR |
| Location codes (A-01-03) | Always LTR |
| Quantities + units | Always LTR numerals |
| Product names | Bilingual — show in user's language if translated |
| Company names | As entered — may be Arabic or English |
| Notes fields | `dir="auto"` — browser detects from first character |
| Dates/times | Format per locale (`Intl.DateTimeFormat`) |
| Carrier/tracking | Always LTR |

### A.8 Bilingual Operational Terminology Standard

The following canonical translations must be used everywhere in the Arabic UI. No alternatives, no paraphrasing.

**Core warehouse operations:**

| English | Arabic (canonical) | Notes |
|---------|-------------------|-------|
| Inbound Order | طلب استلام | Never "أوردر وارد" |
| Outbound Order | طلب شحن | Never "أوردر صادر" |
| Receiving | الاستلام | Noun form |
| Putaway | التخزين | "Storing into location" |
| Picking | التحضير | "Preparing for shipment" |
| Packing | التعبئة | |
| Dispatch | الشحن | |
| Stock | المخزون | |
| Inventory | الجرد / المخزون | "Inventory" as noun: الجرد; "stock on hand": المخزون |
| Ledger | سجل الحركات | Not "ليدجر" |
| Adjustment | تسوية مخزنية | |
| Location | موقع التخزين | Never "لوكيشن" |
| Bin | صندوق تخزين | |
| Lot | دفعة | |
| Expiry Date | تاريخ انتهاء الصلاحية | |
| SKU | رمز المنتج | |
| Barcode | الباركود | Accepted transliteration |
| Warehouse | المستودع | |
| Dock | رصيف التحميل | |
| Worker | عامل المستودع | |
| Task | مهمة | |
| Status | الحالة | |
| Draft | مسودة | |
| Confirmed | مؤكد | |
| In Progress | قيد التنفيذ | |
| Completed | مكتمل | |
| Cancelled | ملغي | |
| Shipped | مشحون | |

**Manage these in `shared/i18n/locales/ar/` namespaces. Require design/terminology review before any Arabic string is added.**

### A.9 Date, Number, and Unit Formatting

Use `Intl` APIs — never hardcode format strings.

```typescript
// shared/lib/format.ts
export function fmtDate(date: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric'
  }).format(new Date(date));
}

export function fmtQty(qty: string | number, locale: string): string {
  // Always use Western Arabic numerals (0-9) for warehouse quantities
  // Use en-US number format regardless of locale for quantities
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(qty));
}
```

For Arabic locale, dates will display in Arabic month names but quantities remain in Western numerals. This matches operational practice in Gulf/MENA warehouse environments.

### A.10 Responsive RTL Behavior

RTL layouts must be tested at every breakpoint. Known failure points:

| Layout element | RTL concern |
|---------------|-------------|
| Sidebar (left panel → right panel) | `inset-inline-start` handles automatically |
| Breadcrumb separator chevron | Must flip (see A.6) |
| Table first/last column sticky | `sticky start-0` for identifier column |
| Filter chips "clear" × button | Position on inline-end side |
| Toast stack position | Top-inline-end (top-right in LTR, top-left in RTL) |
| Modal close × button | Inline-end of header |
| Progress stepper direction | Reversed in RTL — start from right |
| Timeline connector lines | Reversed direction |

---

## B. Extended Operational Semantic Color System

### B.1 Principles

The color system already defines brand and basic semantic colors. This section extends it with **operational state colors** — the specific palette required for a warehouse management system where color communicates mission-critical status.

**Two distinct color purposes:**

1. **Brand / Action colors** — what the user should do (already defined in the blueprint)
2. **Operational state colors** — what is happening to inventory, tasks, and orders

These must never be confused. A confirmation button and a "stock increased" indicator should never share a color.

### B.2 Complete Operational Semantic Token Set

```css
/* --- Operational State Colors (extend globals.css) --- */

/* Inventory movement — directional */
--color-inv-increase:       #16a34a;   /* green-600 — stock went up */
--color-inv-increase-bg:    #f0fdf4;   /* green-50 */
--color-inv-increase-text:  #14532d;   /* green-900 */

--color-inv-decrease:       #dc2626;   /* red-600 — stock went down */
--color-inv-decrease-bg:    #fef2f2;   /* red-50 */
--color-inv-decrease-text:  #7f1d1d;   /* red-900 */

--color-inv-neutral:        #64748b;   /* slate-500 — no change / transfer */
--color-inv-neutral-bg:     #f8fafc;   /* slate-50 */

/* Task operational states */
--color-task-assigned:      #7c3aed;   /* violet-600 — task has a worker */
--color-task-assigned-bg:   #f5f3ff;   /* violet-50 */
--color-task-assigned-text: #4c1d95;   /* violet-900 */

--color-task-active:        #0891b2;   /* cyan-600 — task is being worked now */
--color-task-active-bg:     #ecfeff;   /* cyan-50 */
--color-task-active-text:   #164e63;   /* cyan-900 */

--color-task-blocked:       #9a3412;   /* orange-800 — task cannot proceed */
--color-task-blocked-bg:    #fff7ed;   /* orange-50 */
--color-task-blocked-text:  #7c2d12;   /* orange-900 */

/* Lease / lock states */
--color-locked:             #b45309;   /* amber-700 — record is locked/leased */
--color-locked-bg:          #fffbeb;   /* amber-50 */
--color-locked-border:      #fbbf24;   /* amber-400 */
--color-locked-text:        #78350f;   /* amber-900 */

/* Realtime states */
--color-syncing:            #0284c7;   /* sky-600 — actively syncing */
--color-syncing-bg:         #f0f9ff;   /* sky-50 */
--color-live:               #16a34a;   /* green-600 — connected and live */
--color-stale:              #d97706;   /* amber-600 — data may be stale */
--color-offline:            #dc2626;   /* red-600 — disconnected */

/* Critical warehouse alerts */
--color-critical:           #9f1239;   /* rose-800 — requires immediate action */
--color-critical-bg:        #fff1f2;   /* rose-50 */
--color-critical-border:    #fda4af;   /* rose-300 */

/* Expiry / date warnings */
--color-expiry-warning:     #d97706;   /* amber-600 — expires within 30 days */
--color-expiry-critical:    #dc2626;   /* red-600 — expires within 7 days */
--color-expired:            #9f1239;   /* rose-800 — already expired */

/* Quantity / shortfall */
--color-shortfall:          #ea580c;   /* orange-600 — received less than expected */
--color-shortfall-bg:       #fff7ed;   /* orange-50 */
--color-overage:            #7c3aed;   /* violet-600 — received more than expected */
--color-overage-bg:         #f5f3ff;   /* violet-50 */
```

### B.3 Badge Color Map (Complete)

All status values across the system, normalized:

| Status value | Badge bg | Badge text | Badge border | Dot color | Used in |
|-------------|----------|-----------|-------------|----------|---------|
| `draft` | neutral-100 | neutral-600 | neutral-300 | neutral-400 | Orders |
| `confirmed` | blue-50 | blue-700 | blue-200 | blue-500 | Orders |
| `receiving` | cyan-50 | cyan-700 | cyan-200 | cyan-500 | Orders, Tasks |
| `in_progress` | amber-50 | amber-700 | amber-200 | amber-500 | Orders, Tasks |
| `complete` / `completed` | green-50 | green-700 | green-200 | green-500 | Orders, Tasks |
| `shipped` | green-50 | green-700 | green-200 | green-500 | Orders |
| `cancelled` | red-50 | red-700 | red-200 | red-500 | Orders, Tasks |
| `assigned` | violet-50 | violet-700 | violet-200 | violet-500 | Tasks |
| `active` | cyan-50 | cyan-700 | cyan-200 | cyan-500 | Tasks |
| `blocked` | orange-50 | orange-800 | orange-200 | orange-600 | Tasks |
| `suspended` | slate-100 | slate-600 | slate-300 | slate-400 | Products, Users |
| `archived` | slate-100 | slate-500 | slate-200 | slate-300 | Products, Locations |
| `approved` | green-50 | green-700 | green-200 | green-500 | Adjustments |
| `pending` | amber-50 | amber-700 | amber-200 | amber-500 | Adjustments |

### B.4 Table Row State Colors

When an entire table row needs to communicate state (not just a badge):

| Row state | Background | Left border | Use case |
|-----------|-----------|------------|---------|
| New (realtime) | brand-50 → transparent (2s animation) | brand-500 | Row just arrived via socket |
| Selected (bulk) | brand-50 | 2px brand-500 | Bulk selection |
| Warning | amber-50 | 3px amber-400 | Shortfall, expiry soon |
| Error / critical | red-50 | 3px red-400 | Cancelled, expired lot |
| Locked | amber-50 | 3px amber-400 | Task lease active |
| Inactive / muted | neutral-50 | none | Archived/suspended items |

Row state colors should not replace badges — they provide additional context when the badge alone is insufficient at a glance.

### B.5 Workflow State Colors

For the workflow stepper (Section 6 of original blueprint):

| Step state | Circle fill | Line color | Icon |
|-----------|------------|-----------|------|
| Completed | green-500 | green-400 | `✓` white |
| In progress | amber-500 (pulse) | green-400 (behind) + neutral-200 (ahead) | spinner |
| Pending | white, neutral-300 border | neutral-200 | none |
| Skipped | neutral-300 | neutral-200 | `⤼` |
| Cancelled | red-100, red-300 border | neutral-200 | `×` |
| Blocked | orange-500 | neutral-200 | `!` |

### B.6 Ledger Quantity Display

Inventory ledger entries must use directional color for quantities:

```tsx
// shared/components/data-display/LedgerQty.tsx
function LedgerQty({ delta }: { delta: string }) {
  const value = parseFloat(delta);
  if (value > 0) return (
    <span className="font-mono text-sm text-green-700 font-semibold">
      +{fmtQty(delta)}
    </span>
  );
  if (value < 0) return (
    <span className="font-mono text-sm text-red-700 font-semibold">
      {fmtQty(delta)}
    </span>
  );
  return <span className="font-mono text-sm text-neutral-500">{fmtQty(delta)}</span>;
}
```

### B.7 Accessibility Considerations for Color

**Color alone must never be the only signal.** Every operational color must be paired with:

1. An icon or symbol (dot, arrow, checkmark)
2. A text label or screen-reader-accessible title
3. A pattern or shape difference where possible

**Contrast requirements (WCAG AA minimum):**
- All badge text on badge background: ≥ 4.5:1
- Row state border colors: decorative only — do not rely solely on border color
- Ledger `+` / `−` prefix: combines symbol + color (passes even with color blindness)

**Color blindness accommodations:**
- Red/green pairs (increase/decrease, complete/cancelled): Always include `+`/`−` prefix or `✓`/`×` symbol
- Amber/green pairs (warning/success): Always include distinct icon (`⚠` vs `✓`)
- The colored dot in badges: supplements text, never replaces it

---

## C. Production-Safe Messaging System

### C.1 The Problem

The current system surfaces errors in ways that violate operational UX and information security:

```
// Current failure modes (do NOT ship these to users)
"Prisma error: Unique constraint failed on the fields: (`sku`)"
"Request failed with status code 409"
"Internal server error"
"Cannot read properties of undefined (reading 'lines')"
```

None of these are acceptable in a production warehouse management system.

### C.2 Error Classification & Safe Handling

All errors must be classified before display:

```typescript
// shared/lib/errors/classify.ts

export type ErrorClass =
  | 'validation'       // User input is wrong — show the specific field error
  | 'conflict'         // Business rule violation — show operational message
  | 'not_found'        // Resource doesn't exist — show navigational guidance
  | 'permission'       // User lacks access — show role guidance
  | 'network'          // Connectivity issue — show retry guidance
  | 'session'          // Auth expired — redirect to login
  | 'operational'      // Warehouse workflow conflict — show workflow guidance
  | 'unknown';         // Catch-all — show safe generic message

export function classifyError(error: unknown): ErrorClass {
  if (!error || typeof error !== 'object') return 'unknown';
  const e = error as any;
  if (e.status === 401) return 'session';
  if (e.status === 403) return 'permission';
  if (e.status === 404) return 'not_found';
  if (e.status === 409) return 'conflict';
  if (e.status === 422) return 'validation';
  if (e.status === 423) return 'operational'; // locked resource
  if (!navigator.onLine || e.code === 'ERR_NETWORK') return 'network';
  return 'unknown';
}
```

### C.3 Safe Message Map

Every error class maps to a localized, human-readable message. These live in `shared/i18n/locales/*/errors.json`.

**`errors.json` (English):**

```json
{
  "validation": {
    "generic": "Please check the highlighted fields and try again.",
    "sku_taken": "This SKU is already in use. Try a different one or use the auto-generate button.",
    "qty_insufficient": "Not enough stock at this location. Check the current stock levels.",
    "date_in_past": "The date must be today or in the future.",
    "required_field": "This field is required."
  },
  "conflict": {
    "order_already_confirmed": "This order has already been confirmed and cannot be modified.",
    "task_already_assigned": "This task has been assigned to another worker. Refresh to see the latest status.",
    "lease_held": "This task is currently being worked by another operator. Wait for them to finish or ask a supervisor to release it.",
    "order_has_active_tasks": "This order has active tasks running. Complete or cancel the tasks before making changes to the order.",
    "product_has_stock": "This product has stock on hand and cannot be archived. Remove stock first.",
    "generic": "This action conflicts with the current state. Refresh the page and try again."
  },
  "not_found": {
    "order": "This order was not found. It may have been deleted or you may have an outdated link.",
    "task": "This task was not found.",
    "product": "This product was not found.",
    "generic": "The item you're looking for doesn't exist or has been removed."
  },
  "permission": {
    "generic": "You don't have permission to do this. Contact your supervisor if you need access.",
    "admin_only": "This action requires administrator access."
  },
  "network": {
    "generic": "Connection problem. Check your network and try again.",
    "retry": "Could not reach the server. Retrying..."
  },
  "session": {
    "expired": "Your session has expired. Please sign in again."
  },
  "operational": {
    "lease_expired": "Your work session on this task has expired. The task has been released. You can re-acquire it to continue.",
    "workflow_blocked": "The next workflow step cannot start until the current step is completed.",
    "insufficient_receiving_dock": "A receiving dock must be selected before this order can be confirmed.",
    "generic": "This operation could not be completed due to a workflow conflict. Refresh and try again."
  },
  "unknown": {
    "generic": "Something went wrong. If this keeps happening, contact your system administrator.",
    "action_failed": "The action could not be completed. Please try again."
  }
}
```

### C.4 Error Resolver Hook

```typescript
// shared/lib/errors/useOperationalError.ts
export function useOperationalError() {
  const { t } = useTranslation('errors');

  function resolve(error: unknown, context?: string): string {
    const cls = classifyError(error);
    const code = (error as any)?.code;

    // Try specific code first, fall back to class generic
    if (code && t(`${cls}.${code}`, { defaultValue: '' })) {
      return t(`${cls}.${code}`);
    }
    if (context && t(`${cls}.${context}`, { defaultValue: '' })) {
      return t(`${cls}.${context}`);
    }
    return t(`${cls}.generic`);
  }

  return { resolve };
}
```

Usage in mutations:

```typescript
const { resolve } = useOperationalError();

useMutation({
  mutationFn: confirmOrder,
  onError: (error) => {
    toast.error(resolve(error, 'order_confirm'));
  }
});
```

### C.5 Never-Expose Rules

The following must **never** reach the UI layer in any form:

| Blocked content | Example | Why |
|----------------|---------|-----|
| Stack traces | `at Object.confirm (/app/src/...)` | Security + confusion |
| Prisma errors | `Unique constraint failed on fields: sku` | Exposes DB schema |
| SQL fragments | `WHERE id = $1` | Security |
| Internal service names | `UserService.findById` | Exposes architecture |
| HTTP status codes (raw) | `Error 500` | Meaningless to operators |
| UUIDs in error messages | `Resource abc123... not found` | Confusing |
| Environment variables | `VITE_API_URL: ...` | Security |
| Debug JSON payloads | `{ prismaCode: 'P2002', meta: {...} }` | Never in production |

**Implementation:** The API Axios client already maps errors. Extend it:

```typescript
// api/client.ts (extend existing error handling)
function sanitizeError(axiosError: AxiosError): AppError {
  const data = axiosError.response?.data as any;
  return {
    status: axiosError.response?.status ?? 0,
    // Use only the safe 'code' field from backend, never the raw 'message'
    code: data?.error?.code ?? data?.code ?? 'unknown',
    // Never expose: data.message, data.stack, data.detail
  };
}
```

The backend must return structured errors with a `code` field. Frontend maps codes, never raw messages.

### C.6 Toast Standards

**Success toasts:**

| Action | Toast text |
|--------|-----------|
| Order confirmed | "Order #INB-00142 confirmed" |
| Task assigned | "Task assigned to [Worker Name]" |
| Product created | "[Product Name] added to catalog" |
| Stock adjustment approved | "Adjustment approved — inventory updated" |
| Task completed | "Task completed successfully" |

**Rules:**
- Always include the reference number or name for clarity
- Never say "Success!" alone — always specify what succeeded
- Max 2 lines — title + optional 1-line detail

**Error toasts:**

- Title: the safe operational message (from C.3)
- Optional detail: an actionable next step
- Never show the raw error

**Confirmation dialogs (destructive actions):**

All destructive actions require confirmation with specific language:

| Action | Confirmation message |
|--------|---------------------|
| Cancel order | "Cancel order #INB-00142? This cannot be undone. Any active tasks for this order will also be cancelled." |
| Delete product | "Delete [Product Name]? This product will be permanently removed from the catalog." |
| Suspend user | "Suspend [Name]? They will not be able to log in until their account is reactivated." |
| Approve adjustment | "Approve this adjustment? This will update inventory levels and cannot be reversed." |

**Rules:**
- State the specific item being affected
- State the consequence
- Use the word "cannot be undone" or "cannot be reversed" for irreversible actions
- Primary button label matches the verb: "Cancel Order", "Delete Product", "Suspend User" — never just "Confirm"

### C.7 Validation Messages

Form field validation must be specific and actionable:

| Scenario | Bad message | Good message |
|---------|------------|-------------|
| Required field empty | "Required" | "Order number is required" |
| Invalid date | "Invalid date" | "Expected arrival must be today or later" |
| Quantity below zero | "Invalid quantity" | "Quantity must be greater than 0" |
| SKU already exists | "Duplicate" | "This SKU is already in use. Try a different one." |
| Email format | "Invalid email" | "Enter a valid email address (e.g. name@company.com)" |

Validation errors appear **inline below the field** — never as a top-of-form banner except for multi-field cross-validation errors.

### C.8 Loading / In-Progress Messages

Buttons with loading states should describe what is happening:

| Action | Loading label |
|--------|--------------|
| Confirm Order | "Confirming..." |
| Create Product | "Creating product..." |
| Assign Task | "Assigning..." |
| Approve Adjustment | "Approving..." |
| Sign In | "Signing in..." |

---

## D. Content Cleanup & Terminology Standardization

### D.1 Terminology Audit Scope

Run a full content audit before Phase 3 begins. The audit covers every visible string in both apps.

**Audit checklist per page:**
- [ ] Page title matches the canonical term (see D.2)
- [ ] Table column headers use canonical labels
- [ ] Button labels use canonical action verbs
- [ ] Empty states are contextual (not generic)
- [ ] Error messages are safe and operational
- [ ] Status values display as badges with canonical labels
- [ ] Form field labels are canonical
- [ ] No placeholder text left in production views (`"Add notes here..."` is acceptable; `"TODO: label"` is not)

### D.2 Canonical Terminology Map (English)

**Do not deviate from these terms. Consistency builds operator trust.**

| Concept | Canonical term | Never use |
|---------|---------------|-----------|
| 3PL customer company | Client | Customer, Account, Company (in UI — code can use `company`) |
| Inbound purchase/receipt | Inbound Order | Purchase Order, PO, Receipt |
| Outbound fulfillment | Outbound Order | Sales Order, Shipment, Delivery Order |
| Warehouse stock | Stock | Inventory (use "Inventory" for the nav section; "Stock" for quantities) |
| Stock movement record | Ledger Entry | Transaction, Journal, Movement |
| Inventory correction | Stock Adjustment | Variance, Write-off, Correction |
| Physical storage node | Location | Bin (use Bin only if it refers to a specific location type) |
| Pick route | Pick Path | Route, Order |
| Worker assigned to task | Assigned Worker | Owner, Operator, User |
| Lot tracking | Lot | Batch (unless the product specifically uses "batch") |
| Unit of measure | UoM | Unit, Measure |
| Task type: receive inbound goods | Receiving | Receiving Task, Inbound Task |
| Task type: move to storage | Putaway | Putaway Task, Storage Task |
| Task type: gather for shipment | Picking | Pick Task |
| Task type: prepare for shipment | Packing | Pack Task |
| Task type: hand to carrier | Dispatch | Dispatch Task, Shipping Task |

### D.3 Button Label Standards

| Action type | Label pattern | Examples |
|------------|--------------|---------|
| Create new record | "New [Entity]" | "New Inbound Order", "New Product" |
| Save a form | "Save [Entity]" | "Save Product", "Save Order" |
| Confirm a workflow step | "Confirm Order" | Never just "Confirm" |
| Destructive irreversible | "[Verb] [Entity]" | "Cancel Order", "Delete Product", "Suspend User" |
| Navigation | "View [Entity]" or "← Back to [Entities]" | "View Order", "← Back to Tasks" |
| Secondary actions | "[Verb]" | "Edit", "Archive", "Export" |
| Filter application | "Apply Filters" / "Clear Filters" | Never "Search", "Submit" |
| Bulk actions | "[Verb] Selected ([n])" | "Assign Selected (3)", "Cancel Selected (5)" |

### D.4 Column Header Standards

Column headers in tables must be:
- Sentence case (not ALL CAPS in English) — already defined in the blueprint's `text-xs uppercase tracking-wide` style refers to Tailwind's CSS transform, not the source text
- Concise: 1–3 words
- Consistent across both apps for the same data

| Data | Canonical column header |
|------|------------------------|
| Order identifier | Order # |
| Order status | Status |
| Expected arrival date | Expected |
| Required ship date | Ship By |
| Created timestamp | Created |
| Number of line items | Lines |
| Product identifier | SKU |
| Product name | Product |
| Quantity expected | Expected Qty |
| Quantity received | Received Qty |
| Quantity requested | Requested Qty |
| Quantity picked | Picked Qty |
| Unit of measure | UoM |
| Assigned worker | Assigned To |
| Task type | Type |
| Last updated | Updated |

### D.5 Empty State Terminology

| Table | Primary empty message | CTA button |
|-------|----------------------|-----------|
| Inbound orders (no filters) | "No inbound orders yet" | "New Inbound Order" |
| Inbound orders (filters active) | "No orders match these filters" | "Clear Filters" |
| Tasks (no filters) | "No tasks in the queue" | — |
| Tasks (filtered by type) | "No [type] tasks found" | "View All Tasks" |
| Products | "No products in the catalog" | "New Product" |
| Stock | "No stock on hand" | — |
| Ledger | "No ledger entries for this period" | — |
| Clients | "No clients added yet" | "New Client" |

### D.6 Navigation Label Standards

| Current nav label | Canonical label | Notes |
|------------------|----------------|-------|
| "Overview" | "Dashboard" | More intuitive as a home landing page |
| "Catalog" → "Products" | Keep "Products" directly | Skip "Catalog" section unless Locations is also under it |
| "Catalog" → "Locations" | Keep |  |
| "Manage" → "Customers" | "Clients" | Match canonical term |
| "Manage" → "Users" | "Users" | Keep |
| "Internal transfer" | "Stock Transfer" | Clearer to operators |
| "Adjustments" | "Stock Adjustments" | Clearer |

---

## E. Realtime Operational UX (Extended)

This section extends Section 6.5 and 7.6 of the original blueprint with production-level detail.

### E.1 Connection State Machine

The realtime connection has 5 observable states:

```
disconnected → connecting → connected → reconnecting → failed
                                ↑              ↓
                                └──────────────┘  (on reconnect success)
```

| State | Topbar indicator | User message | Data freshness warning |
|-------|-----------------|-------------|----------------------|
| `connected` | ● Live (green, pulse every 3s) | none | none |
| `connecting` | ● Connecting... (blue, spinner) | none | none |
| `reconnecting` | ● Reconnecting... (amber, spinner) | "Live updates paused — reconnecting" (inline banner) | Yes — "Data may be outdated" |
| `disconnected` | ● Offline (red, static) | "Live updates unavailable" (sticky banner) | Yes — "Refresh manually to see latest data" |
| `failed` (5+ attempts) | ● Offline (red) | "Cannot connect to server. Contact IT." | Yes |

### E.2 RealtimeStatusProvider

Add a context that exposes connection status throughout the app:

```typescript
// realtime/RealtimeStatusContext.tsx
type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

export const RealtimeStatusContext = createContext<{
  status: RealtimeStatus;
  lastUpdated: Date | null;
  reconnectAttempts: number;
}>({ status: 'connecting', lastUpdated: null, reconnectAttempts: 0 });
```

The socket lifecycle events (`connect`, `disconnect`, `connect_error`, `reconnect_attempt`, `reconnect`) map to state transitions. The existing `RealtimeProvider` should emit these.

### E.3 Per-Table Last-Updated Indicator

Every data table shows when its data was last refreshed:

```
Inbound Orders                          ↻ Updated just now   [gear] [export]
```

Implementation:
- Each query stores a `dataUpdatedAt` timestamp (available from TanStack Query)
- The table toolbar shows relative time: "just now", "5s ago", "2 min ago"
- On socket event that invalidates this table: brief highlight of the indicator (brand color, 1s)
- After 5 minutes without update: indicator turns amber ("5 min ago — may be outdated")

### E.4 Optimistic Update Patterns

Extend the blueprint's optimistic UI section with specific rollback strategies:

```typescript
// Pattern for all order status changes
useMutation({
  mutationFn: (id: string) => OrdersApi.confirm(id),

  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: QK.inboundOrders });

    // Snapshot for rollback
    const prev = queryClient.getQueryData(QK.inboundOrders);

    // Optimistic update
    queryClient.setQueryData(QK.inboundOrders, (old: any) => ({
      ...old,
      items: old.items.map((o: Order) =>
        o.id === id ? { ...o, status: 'confirmed' } : o
      )
    }));

    return { prev };
  },

  onError: (err, id, ctx) => {
    // Rollback
    queryClient.setQueryData(QK.inboundOrders, ctx?.prev);
    toast.error(resolve(err, 'order_confirm'));
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: QK.inboundOrders });
  }
});
```

**Mutations that support optimistic updates:**

| Mutation | Optimistic change | Rollback trigger |
|---------|------------------|----------------|
| Confirm order | Status → `confirmed` | Any error |
| Cancel order | Status → `cancelled` | Any error |
| Assign task | Assignee → worker name | Any error |
| Suspend product | Status → `suspended` | Any error |
| Complete task | Status → `complete` | Any error |
| Approve adjustment | Status → `approved` | Any error |

### E.5 Task Progress Live Feedback

For long-running tasks (receiving with many lines), show progress without requiring page refresh:

```typescript
// realtime/useTaskProgressSync.ts
function useTaskProgressSync(taskId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (event: { taskId: string; progress: any }) => {
      if (event.taskId !== taskId) return;
      queryClient.setQueryData(['tasks', 'detail', taskId], (old: any) =>
        old ? { ...old, progress: event.progress } : old
      );
    };

    socket.on(TASK_PROGRESS_UPDATED, handler);
    return () => socket.off(TASK_PROGRESS_UPDATED, handler);
  }, [taskId]);
}
```

This enables the "Lines received: 8/12" progress bar to update in real time as a co-worker scans items on the same task.

### E.6 Realtime Toast Patterns

| Trigger | Toast behavior |
|--------|---------------|
| Order confirmed by another user | Subtle info toast: "Order #INB-00142 was confirmed" (3s) |
| Task assigned to current user | Prominent info toast: "A [receiving] task has been assigned to you" + link |
| Stock low alert (future) | Warning toast: "Low stock alert: [Product]" |
| Another user cancels order you're viewing | Error toast + page state update: "This order was cancelled" |

**Rule:** Do not show a toast for every socket event — only events that are directly relevant to the current user's current page context. Broad socket events that just refresh lists in the background should be silent.

---

## F. Permission-Aware UX

### F.1 Role Model

| Role | Access scope |
|------|-------------|
| `ADMIN` | Full admin dashboard — all features, all clients, user management |
| `OPERATOR` | Admin dashboard — all operational features except user management and client management |
| `client_admin` | Client portal — read-only own company data; no admin access |
| `client_staff` | Client portal — read-only own company data (same as client_admin for now) |

### F.2 Permission-Aware Component Pattern

Create a `<PermissionGate>` component for declarative permission control:

```tsx
// shared/components/auth/PermissionGate.tsx
interface PermissionGateProps {
  require: Permission | Permission[];
  fallback?: React.ReactNode;  // Default: null (hidden)
  children: React.ReactNode;
}

export function PermissionGate({ require, fallback = null, children }: PermissionGateProps) {
  const { user } = useAuth();
  const allowed = checkPermission(user, require);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
```

### F.3 Disabled vs Hidden Actions

The choice between hiding and disabling an action depends on context:

| Scenario | Treatment | Rationale |
|---------|-----------|-----------|
| Action requires ADMIN role | **Hidden** | Operators should not know admin-only features exist in this context |
| Action temporarily blocked by workflow state | **Disabled** with tooltip | Operator needs to know the action exists but can't take it yet |
| Action blocked because of a lease/lock | **Disabled** with tooltip showing who holds the lock | Operational transparency |
| Action blocked due to insufficient stock | **Disabled** with tooltip | User needs to understand why |
| Action blocked by pending confirmation | **Disabled** | Waiting state |

```tsx
// Example: Confirm Order button
<PermissionGate require="orders:confirm" fallback={null}>
  <Button
    variant="primary"
    disabled={order.status !== 'draft'}
    title={order.status !== 'draft' ? `Cannot confirm — order is ${order.status}` : undefined}
    onClick={handleConfirm}
  >
    Confirm Order
  </Button>
</PermissionGate>
```

### F.4 Permission Map

```typescript
// shared/lib/permissions.ts
export const PERMISSIONS = {
  // Orders
  'orders:create':  ['ADMIN', 'OPERATOR'],
  'orders:confirm': ['ADMIN', 'OPERATOR'],
  'orders:cancel':  ['ADMIN', 'OPERATOR'],
  'orders:view':    ['ADMIN', 'OPERATOR'],

  // Tasks
  'tasks:assign':   ['ADMIN', 'OPERATOR'],
  'tasks:execute':  ['ADMIN', 'OPERATOR'],
  'tasks:cancel':   ['ADMIN', 'OPERATOR'],

  // Products
  'products:create':   ['ADMIN', 'OPERATOR'],
  'products:edit':     ['ADMIN', 'OPERATOR'],
  'products:archive':  ['ADMIN'],
  'products:delete':   ['ADMIN'],
  'products:suspend':  ['ADMIN', 'OPERATOR'],

  // Inventory
  'inventory:adjust':  ['ADMIN', 'OPERATOR'],
  'inventory:approve': ['ADMIN'],
  'inventory:transfer':['ADMIN', 'OPERATOR'],

  // Management (ADMIN only)
  'users:view':    ['ADMIN'],
  'users:create':  ['ADMIN'],
  'users:manage':  ['ADMIN'],
  'clients:view':  ['ADMIN'],
  'clients:create':['ADMIN'],
  'clients:manage':['ADMIN'],
} as const;
```

### F.5 Route-Level Guards

Fix the existing gap where `/users` has no router-level guard:

```tsx
// router.tsx — add role guard to management routes
{
  path: '/users',
  element: (
    <RequireRole role="ADMIN" fallback={<Navigate to="/dashboard/overview" />}>
      <UsersPage />
    </RequireRole>
  )
}
```

```tsx
// shared/components/auth/RequireRole.tsx
export function RequireRole({ role, fallback, children }) {
  const { user } = useAuth();
  if (user?.authGroup !== role) return fallback;
  return children;
}
```

### F.6 Client Portal Role Differentiation

Today, `client_admin` and `client_staff` have identical UI. When client-side permissions are added:

| Feature | client_admin | client_staff |
|---------|-------------|-------------|
| View orders | ✅ | ✅ |
| Download reports (future) | ✅ | ✅ |
| Manage company users (future) | ✅ | ❌ |
| API key management (future) | ✅ | ❌ |

Prepare for this with `PermissionGate` even before backend enforces it.

### F.7 Operational Context Clarity

Operators should always know who performed an action:

- Workflow timeline: "Confirmed by Alex M. · Jan 11, 09:32"
- Task assignment: "Assigned to Sarah K."
- Ledger entries: "Receiving task completed by Omar F."
- Toast for realtime events from other users: "Order confirmed by [name]"

This is not about blame — it's operational transparency that helps supervisors and operators coordinate.

---

## G. Tablet & Warehouse Device UX

### G.1 Device Profiles

The system must be tested against these device profiles:

| Profile | Resolution | Context | Primary interaction |
|---------|-----------|---------|-------------------|
| Desktop workstation | 1920×1080+ | Office, supervisor | Mouse + keyboard |
| Standard laptop | 1440×900 | Office, admin | Mouse + keyboard |
| Warehouse tablet (10") | 1280×800 | Floor, mobile | Touch |
| Rugged tablet (8") | 1024×768 | Floor, scanner | Touch + barcode |
| Warehouse terminal (fixed) | 1366×768 | Fixed station | Touch + scanner |

### G.2 Touch Target Standards

All interactive elements on tablet/touch contexts must meet minimum size requirements:

| Element type | Minimum tap target |
|-------------|-------------------|
| Primary action buttons | 48×48px minimum |
| Secondary buttons | 44×44px minimum |
| Table row (clickable) | Full row, minimum 52px height — already in blueprint |
| Checkbox (bulk select) | 44×44px touch area, 20px visual |
| Dropdown / Combobox | 44px height minimum |
| Pagination prev/next | 44×44px |
| Filter chip × close | 32×32px touch area |
| Sidebar nav items | 48px height on tablet |

Implementation: use a `touch-target` utility class that adds invisible padding:

```css
.touch-target {
  position: relative;
}
.touch-target::after {
  content: '';
  position: absolute;
  inset: -8px;  /* expand touch area by 8px on all sides */
}
```

### G.3 Task Execution on Tablet

The task execution view is the most critical tablet surface — operators use it on the warehouse floor.

**Tablet layout adaptations:**

```
Desktop (≥1280px):
  [Task header] | [Worker panel]
  [Main task body (lines, quantities)]
  [Actions bar]

Tablet (768–1279px):
  [Task header — compact, single row]
  [Main task body — full width, increased spacing]
  [Worker panel — collapsible panel below header]
  [Actions bar — sticky bottom, full width, large buttons]
```

**Sticky action bar (tablet):**

```css
/* Tablet task execution — actions always reachable */
@media (max-width: 1279px) {
  .task-actions-bar {
    position: sticky;
    bottom: 0;
    background: white;
    border-top: 1px solid var(--color-neutral-200);
    padding: 12px 16px;
    display: flex;
    gap: 12px;
  }
  .task-actions-bar .btn {
    flex: 1;
    height: 52px;   /* Larger on tablet */
    font-size: 1rem;
  }
}
```

**Quantity input on tablet:**

- Use `type="number"` with `inputmode="decimal"` to trigger the numeric keyboard on tablets
- Make quantity inputs extra large: `h-14 text-xl` on tablet breakpoint
- Add large `+` / `−` increment buttons beside each quantity field for touch entry

```tsx
<QuantityInput
  value={qty}
  onChange={setQty}
  className="h-14 text-xl font-mono"  // tablet size
  showIncrements={isTablet}           // show +/- buttons on touch
/>
```

### G.4 Barcode / Scanner Integration

Warehouse operators often use physical barcode scanners connected via Bluetooth or USB. Scanners function as keyboards that emit the barcode string followed by `Enter`.

**Scanner-ready input pattern:**

```tsx
// All barcode inputs must handle scanner input correctly
function BarcodeInput({ onScan }: { onScan: (code: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const buffer = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && buffer.current.length > 3) {
      onScan(buffer.current);
      buffer.current = '';
      if (ref.current) ref.current.value = '';
    } else if (e.key.length === 1) {
      buffer.current += e.key;
      // Reset buffer if typing is too slow (human, not scanner)
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { buffer.current = ''; }, 100);
    }
  };

  // Auto-focus on task view load — scanner should be ready immediately
  useEffect(() => { ref.current?.focus(); }, []);

  return <input ref={ref} onKeyDown={handleKeyDown} autoFocus />;
}
```

**Scanner UX rules:**
- The active scan field must auto-focus when a task step begins
- Successful scan: brief green flash + sound (optional, configurable) + auto-advance to next field
- Failed scan (not found): red flash + error message + field cleared + ready for re-scan
- Duplicate scan (already scanned): amber flash + "Already scanned" message

### G.5 Offline / Poor Connectivity Handling

Warehouse environments often have spotty WiFi coverage. The system must degrade gracefully:

| Scenario | Behavior |
|---------|---------|
| Momentary packet loss | Silent — TanStack Query retries once |
| Socket disconnects | Show reconnecting indicator; data remains visible |
| Full network loss | Show offline banner; disable mutations with tooltip "No connection — save not available" |
| Reconnect | Sync all stale queries; dismiss offline banner; show "Reconnected" toast |

**Offline mutation queue:** Do not implement full offline-first with IndexedDB — this is out of scope for Phase 1–6. However, if a mutation fails due to network, retain the form state so the operator doesn't lose entered data. Use a `draftState` ref.

### G.6 Font Size & Readability for Warehouse Conditions

Warehouse environments include:
- Bright overhead fluorescent light (washes out screens)
- Viewing from distance (operator looks between screen and physical shelf)
- Gloves (affects touch accuracy)

**Tablet-specific font size overrides:**

```css
@media (max-width: 1279px) and (pointer: coarse) {
  /* Touch device override */
  --text-sm-operational: 0.9375rem;  /* 15px instead of 14px */
  --text-base-operational: 1.0625rem; /* 17px instead of 16px */

  .task-execution-view {
    font-size: var(--text-base-operational);
  }

  .task-line-qty {
    font-size: 1.25rem;   /* Quantities prominent */
    font-weight: 700;
  }

  .status-badge {
    font-size: 0.875rem;  /* Slightly larger badges */
    padding: 4px 10px;
  }
}
```

### G.7 Reduced Gesture Complexity

On touch devices, avoid:
- Horizontal swipe to reveal actions (unreliable with industrial cases)
- Long-press context menus (hard to trigger with gloves)
- Multi-finger gestures

Instead:
- Row actions visible directly in the row (icon buttons, not swipe-reveal)
- All actions accessible from detail page, not gesture-only
- Context menus only via explicit button tap, not long-press

---

## H. Enterprise Operational Polish Layer

### H.1 Operational Clarity Principles

This section extends the visual polish layer (Section 7 of the original blueprint) with operational-specific quality standards.

**The measure of success for this system is operational efficiency, not visual delight.** Every polish decision should be justified by: "Does this help a warehouse operator complete their work faster or with fewer errors?"

Approved polish rationale:
- ✅ Skeleton loaders prevent layout shift — operators don't lose their visual anchor
- ✅ Optimistic updates feel instant — operators trust the system
- ✅ Keyboard shortcuts reduce mouse travel — faster workflows
- ✅ Sticky action bars on tablet — operators don't need to scroll to take action
- ✅ Row state colors highlight actionable items — faster scan of task queue

Not-approved polish:
- ❌ Page transition animations for their own sake — adds latency to operator workflows
- ❌ Elaborate hover effects on data rows — distracting in a data-dense environment
- ❌ Decorative illustrations on every empty state — slow to render, not operational

### H.2 Scanability Standards

For data-dense tables that operators scan at speed:

**Horizontal rhythm:** Column widths must be fixed (not auto), so the operator's eye can return to the same horizontal position on every row:

```typescript
// DataTable column width config
const inboundColumns = [
  { key: 'orderNumber', width: '140px', sticky: true },
  { key: 'status',      width: '120px' },
  { key: 'client',      width: '160px' },
  { key: 'expected',    width: '120px' },
  { key: 'lines',       width: '80px', align: 'end' },
  { key: 'created',     width: '120px' },
  { key: 'actions',     width: '80px' },
];
```

**Vertical rhythm:** Row height is always 52px (defined in blueprint). Never let content overflow to a second line in a table row — truncate with tooltip.

**Status column placement:** The status badge column should always be the second column (after the identifier), so operators can scan status without reading across the whole row.

**Highest-priority information first:** For each table, determine what an operator checks first, and put it leftmost (after the identifier). For task lists, that's `type` then `assigned`. For order lists, that's `status` then `client`.

### H.3 Dense Data Readability

**Monospace alignment for numeric columns:**

All quantity, amount, and ID columns must use `font-mono` to ensure digits align vertically:

```css
.col-qty, .col-sku, .col-order-num, .col-lot { font-family: var(--font-mono); }
```

**Number formatting consistency:**
- Quantities: always 2 decimal places maximum, thousands separator for ≥1000
- Dates: always `MMM DD, YYYY` in English (e.g., "Jan 15, 2026"), `DD MMM YYYY` in Arabic
- Times: 24-hour format in warehouse context (less ambiguity than AM/PM)

**Column sorting indicators:**

Sortable columns show a persistent (but muted) sort icon, not just on hover. The current sort column has a more prominent indicator. Operators need to know at a glance what the current sort order is.

### H.4 Fast Workflow Keyboard Shortcuts

Extend the keyboard shortcuts from Section 7.5 of the original blueprint:

| Shortcut | Context | Action |
|---------|---------|--------|
| `⌘K` / `Ctrl+K` | Global | Open command palette / global search |
| `N` | List pages (no input focused) | New [entity] |
| `F` | List pages | Focus filter search input |
| `/` | List pages | Focus filter search input (alternative) |
| `Escape` | Modal, filter, drawer open | Close |
| `Enter` | Confirmation dialogs | Confirm (primary action) |
| `⌘Enter` | Forms | Submit |
| `R` | Any page | Refresh current query (without full reload) |
| `←` | Detail pages | Back to list |
| `J` / `K` | Table focused | Navigate rows down / up |
| `Tab` | Task execution | Advance to next input field |
| `Space` | Checkbox rows | Toggle selection |

**Keyboard shortcut discovery:** Add a `?` global shortcut that opens a shortcut reference panel (modal). This is a standard enterprise SaaS pattern (used by Linear, GitHub, Notion).

### H.5 Focus Management

**Critical focus rules:**

1. **Modal open:** Focus moves to the first focusable element inside (typically the first input or the close button if no inputs)
2. **Modal close:** Focus returns to the trigger element that opened the modal
3. **Form submit (success):** Focus moves to the success feedback (toast is not focusable — announce via `aria-live`)
4. **Form submit (error):** Focus moves to the first invalid field
5. **Table row navigation (J/K):** Row receives `focus`, then Enter navigates to detail
6. **Drawer open:** Focus moves to the drawer header or first input
7. **Toast:** Do not move focus to toast — use `aria-live` region instead

**Focus ring consistency:**

```css
/* All focusable elements — uniform focus ring */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgb(40 160 94 / 0.25), 0 0 0 1px var(--color-brand-500);
}

/* High-contrast mode support */
@media (forced-colors: active) {
  :focus-visible {
    outline: 2px solid ButtonText;
  }
}
```

### H.6 ARIA Live Regions

```tsx
// shared/components/accessibility/LiveRegion.tsx
export function LiveRegion() {
  return (
    <>
      {/* Polite: non-urgent updates (realtime data refresh, success actions) */}
      <div
        id="live-region-polite"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      {/* Assertive: urgent updates (errors, session expiry, critical alerts) */}
      <div
        id="live-region-assertive"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}

// Usage: announce to screen readers without moving focus
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const el = document.getElementById(`live-region-${priority}`);
  if (el) {
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = message; });
  }
}
```

### H.7 Print Support

Some operational workflows require printed documents from the browser:

| Print target | Print format | Triggered by |
|-------------|-------------|-------------|
| Inbound order detail | Clean list with line items, expected quantities | "Print" button in page actions |
| Outbound order detail | Pick list format | "Print Pick List" |
| Stock adjustment | Approval record | "Print Approval" |
| Task execution | Task work order | "Print Work Order" |

```css
@media print {
  /* Hide chrome for print */
  [data-sidebar], [data-topbar], [data-filter-bar],
  [data-table-toolbar], [data-pagination], .btn { display: none !important; }

  /* Show print-only elements */
  [data-print-only] { display: block !important; }

  /* Page breaks */
  .page-break-before { page-break-before: always; }

  /* Font adjustments */
  body { font-size: 11pt; color: black; }
  table { font-size: 9pt; }
}
```

### H.8 Error Boundary Strategy

Each major page section should have its own error boundary so that a failed widget doesn't crash the entire page:

```
Page
  ├── ErrorBoundary > PageHeader
  ├── ErrorBoundary > FilterBar
  ├── ErrorBoundary > DataTable      ← if this fails, header + filter still work
  └── ErrorBoundary > Pagination
```

```tsx
// shared/components/feedback/OperationalErrorBoundary.tsx
export class OperationalErrorBoundary extends Component<Props, State> {
  render() {
    if (this.state.hasError) {
      return (
        <Banner variant="error">
          <p>{t('errors.unknown.generic')}</p>
          <Button variant="secondary" size="sm" onClick={() => this.setState({ hasError: false })}>
            Try Again
          </Button>
        </Banner>
      );
    }
    return this.props.children;
  }
}
```

### H.9 Session Management UX

**Session expiry:**
- Warn operators 5 minutes before session expires: sticky banner "Your session expires in 5 minutes. Save your work."
- If session expires while a task is being executed: do not lose progress data — persist to `sessionStorage`
- On re-login: offer to restore the in-progress task context

**Multi-tab behavior:**
- JWT is stored in `sessionStorage` — tabs do not share sessions by default
- If an operator opens a second tab and logs in as a different user, the first tab should detect the conflict (via a `storage` event on a BroadcastChannel) and warn: "Another session has started. Refresh to continue."

### H.10 Performance Baselines

Define measurable targets for operational readiness:

| Metric | Target | Measurement |
|--------|--------|------------|
| Initial page load (dashboard) | < 2s on 50Mbps | Lighthouse |
| Table data load (with skeleton) | < 500ms from navigation | TanStack Query |
| Mutation response (confirm order) | < 300ms perceived (optimistic) | Measured |
| Filter apply response | < 200ms debounce + < 500ms result | Measured |
| Socket reconnect | < 3s | Socket.IO metric |
| First contentful paint | < 1.5s | Lighthouse |
| Bundle size (initial) | < 300KB gzipped | Build output |

**Code splitting:** Each page should be lazy-loaded. `TaskExecutionView` is a particularly large bundle candidate for code splitting by task type:

```typescript
// router.tsx — lazy load heavy pages
const TaskDetailPage = lazy(() => import('./pages/tasks/TaskDetailPage'));
const InboundDetailPage = lazy(() => import('./pages/orders/InboundDetailPage'));
```

---

## Appendix C — Phase Integration Map

This appendix maps the 8 new requirement areas to the existing 7-phase roadmap.

| Phase | Original scope | Extensions added by this document |
|-------|---------------|----------------------------------|
| **Phase 0** | Design token consolidation | Add operational semantic tokens (Section B) to `globals.css` in the same pass |
| **Phase 1** | DataTable v2 + pagination | Integrate tablet touch targets (G.2), column width standards (H.2), LedgerQty component (B.6) |
| **Phase 2** | StatusBadge + FilterBar | Implement complete badge color map (B.3), row state colors (B.4), canonical terminology (D.2–D.4) |
| **Phase 3** | Layout modernization | Add i18n library (A.2), RTL logical properties (A.5), `useLanguageSwitch` fix (A.3), route guards (F.5), realtime status context (E.2) |
| **Phase 4** | Toast + realtime UX | Production-safe messaging (C.3–C.6), per-table last-updated indicator (E.3), optimistic update patterns (E.4) |
| **Phase 5** | Workflow visualization | Workflow state colors (B.5), task execution tablet layout (G.3), scanner integration (G.4), task progress sync (E.5) |
| **Phase 6** | Polish + accessibility | ARIA live regions (H.6), focus management (H.5), print support (H.7), error boundaries (H.8), keyboard shortcuts (H.4), Arabic typography final pass (A.4) |

**New addition to Phase 3:** Content audit (Section D.1) should be run as a dedicated 1-week sub-sprint at the start of Phase 3. All canonical terminology changes are pure content — zero risk, high consistency impact.

**New addition to Phase 5:** Tablet UX testing sprint (3–5 days) after task execution refactor. Test on real devices against the profiles in G.1.

---

*This document is an extension of the WMS Frontend Modernization Blueprint. It adds production-readiness requirements without modifying the phasing or component architecture defined in the original. Update both documents together when major phases complete.*

*Version: Extension v1.0 — paired with Blueprint v1.0*