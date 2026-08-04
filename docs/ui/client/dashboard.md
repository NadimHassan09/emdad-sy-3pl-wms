# Dashboard

**App:** Client Portal  
**Route(s):** `/dashboard` (index `/` redirects here)  
**Source:** `client-frontend/src/pages/DashboardPage.tsx`  
**Nav label:** Dashboard / لوحة التحكم

## Purpose

Exception-first merchant morning view: orders needing attention, sellable stock, COD cash position, order movement, inventory alerts, and recent activity.

## Primary users

`client_admin` and `client_staff`.

## User goals

- See what needs action today
- Jump into stuck orders / low stock / COD
- Scan last-7-days order movement
- Filter order summary by month/date/channel
- Open recent notifications/activity

## Business goal

Drive daily merchant engagement toward exceptions (unprocessed orders, low stock, pending COD) rather than vanity totals.

## Main workflows

1. Load KPIs and charts → click KPI card → deep-link list
2. **New order** CTA → `/ecommerce-orders` (create gated by billing)
3. **View cash on delivery** → `/my-profits`
4. Order summary month/date/channel filters refresh status counts
5. Live inventory **View all** → `/products`; row may open product
6. Attention-table row → ecommerce order detail
7. Activity/notification → entity via `clientNotificationHref`
8. **Request payout** → mailto support with COD body

## Components

- `ListPageHeader`
- Top KPI cards (`TopKpi`)
- Order movement pie (Recharts)
- Order status summary row + month/date/channel controls
- Live inventory table snippet
- Orders needing attention table
- Finance/COD cards
- Activity feed
- `Alert` (load error)
- `Skeleton`
- `Badge` / stock status badges

## Forms

No create form on this page. Order-summary controls:

| Control | EN | AR | Notes |
|---------|----|----|-------|
| Month preset | This month / Last month | هذا الشهر / الشهر الماضي | values `this` / `last` |
| Date from / to | native date inputs (unlabeled) | — | `dateFrom`, `dateTo` |
| Sales channel | aria-label Sales channel / قناة البيع | options: **All** / الكل + dynamic channels |

## Tables

**Live inventory** (section: Live inventory / المخزون الحالي; subtitle What inventory do I have? / ما المخزون المتاح لدي؟)

| Column EN | Column AR |
|-----------|-----------|
| Product | المنتج |
| SKU | رمز SKU |
| Available | المتاح |
| Reserved | المحجوز |
| Status | الحالة |

Status badges: **In stock** / متوفر, **Low stock** / مخزون منخفض, **Out of stock** / نفد المخزون.

**Orders needing attention** (subtitle: Unprocessed, failed delivery, and similar exceptions)

| Column EN | Column AR |
|-----------|-----------|
| Order | طلب |
| Recipient | المستلم |
| Channel | القناة |
| Status | الحالة |
| Total | الإجمالي |

Status values rendered via `<Badge status={…} />` (API status strings).

## Filters

- Month preset (`this` / `last`)
- Custom `dateFrom` / `dateTo`
- Sales channel select (**All** / الكل + API channels)
- Pie chart fixed to **Last 7 days** / آخر 7 أيام (not a user filter)

## Actions

| Control | EN | AR | Notes |
|---------|----|----|-------|
| Header CTA | New order | طلب جديد | Disabled when `!operationalAllowed` |
| Header CTA | View cash on delivery | عرض الدفع عند الاستلام | → `/my-profits` |
| Error | Retry | إعادة المحاولة | dashboard load failure |
| Inventory | View all | عرض الكل | → `/products` |
| Finance | Request payout | طلب تحويل | mailto `support@emdadsy.com`, subject `Request COD Payout — Emdad Client Portal` |
| KPI / row clicks | — | — | navigate to lists/details |

**Top KPIs:** Needs attention / تحتاج متابعة; Sellable stock / المخزون القابل للبيع; Cash on delivery / الدفع عند الاستلام.

**Order movement legend:** Unprocessed, Processing, Out for delivery, Delivered, Returned, Cancelled / failed (+ AR map).

**Finance cards:** Ready for payout, Total COD, Pending collection, Remitted (+ AR).

**Activity kinds:** Order / طلب, Return / مرتجع, Payment / دفعة.

## Dialogs

- None owned; CTAs navigate away.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

| Area | EN | AR |
|------|----|----|
| Pie | No data | لا توجد بيانات |
| Inventory | No inventory rows | لا توجد صفوف مخزون |
| Attention | No orders need attention | لا توجد طلبات تحتاج متابعة |
| Activity | No recent activity | لا يوجد نشاط حديث |

## Loading states

- Per-section `Skeleton` for KPIs and inventory/attention rows; query pending flags.
- Page header subtitle: **Welcome back, {displayName}** / مرحبًا بعودتك, {displayName}.

## Validation

- N/A (no submit form). Load error alert: **Could not load dashboard** / تعذر تحميل لوحة التحكم.

## Permissions

- Route: both roles via `RequireRouteAccess` / `rbac` home group.
- `useClientOperationalAccess(isArabic)`: **New order** disabled when `operationalAllowed` is false (`restricted` / `no_plan`). `actionBlockedReason` supplied by `buildBillingRestrictionCopy` (layout `BillingRestrictionBanner` shows full title/description).
- Expiring billing: banner warning only; create not blocked.

## Relationships with other pages

- → `/ecommerce-orders`, `/my-profits`, `/products`, `/products/:id`, `/ecommerce-orders/:id`
- Notification deep links via `clientNotificationHref`
- Layout billing banner shared with create flows

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
