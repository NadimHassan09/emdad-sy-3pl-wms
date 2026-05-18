# Client Portal — Pages, UI & API Mapping

**Global layout on all protected pages:** `PortalLayout` topbar + sidebar + `<main className="main"><motion.div className="card">` pattern.

**No** `PageHeader`, `DataTable`, or `Modal` components — semantic CSS classes from shared design system.

---

## `/login` — LoginPage

| Field | Detail |
|-------|--------|
| **Purpose** | Client user sign-in |
| **Access** | Public |
| **Roles** | Returns `client_admin` or `client_staff` |

### UI

- Centered **card** (`card--narrow` on centered page `page--centered`)
- Title + subtitle
- **Form:** email, password (`field`, `field__input`)
- **Primary button:** Sign in (`btn btn--primary`)
- **Error banner:** `banner banner--error`
- Redirect authenticated users away from login

### Logic

- `login()` → store token → `AuthContext` sets user
- `Navigate` to `location.state.from` or `/`

### API

| Method | Path |
|--------|------|
| POST | `/auth/login` body `{ email, password }` |
| GET | `/auth/me` |

---

## `/` — WelcomePage

| Field | Detail |
|-------|--------|
| **Purpose** | Home / profile summary |
| **Access** | Authenticated client users |

### UI

- **card__title:** Welcome message with user name
- **details** list (`dl.details` / `details__row`):
  - Name, email, role, company name

### Logic

- Reads `user` from `useAuth()` — no extra fetch

### API

- Uses boot-time `GET /auth/me` only

---

## `/products` — ProductsPage

| Field | Detail |
|-------|--------|
| **Purpose** | Browse client product catalog with on-hand totals |
| **Workflow** | Search → paginated table |

### UI

- **h1** `card__title`: Products
- **stock-toolbar** form: search input + Search button
- **data-table:** SKU, Name, Barcode, UoM, On hand (numeric `.num`)
- **pager:** meta label + Previous/Next (`btn btn--secondary`)
- **Loading:** `muted` text
- **Empty:** "No products found."
- **Error:** `banner banner--error`

### Logic

- Page size **25**, offset pagination
- Search: draft `searchInput` → apply on submit → `appliedSearch` in query key
- `fetchClientProducts({ limit, offset, productSearch })`

### API

| Method | Path | Query params |
|--------|------|--------------|
| GET | `/products` | `limit`, `offset`, `search` / `productSearch` |

**Response shape:** `{ items, total, limit, offset }`

---

## `/stock` — StockPage

| Field | Detail |
|-------|--------|
| **Purpose** | Per-product inventory totals for client company |
| **Workflow** | Search products → view qty and expiry |

### UI

- Title + optional **company name** subtitle
- Same toolbar/table/pager pattern as products
- Columns: SKU, Product, Total qty, UoM, Expiry (if tracked)

### Logic

- Query key `['client', 'stock', offset, PAGE_SIZE, appliedSearch]`
- **Realtime:** invalidated on socket events

### API

| Method | Path | Query |
|--------|------|-------|
| GET | `/stock` | `limit`, `offset`, `productSearch` |

---

## `/inbound-orders` — InboundOrdersPage

| Field | Detail |
|-------|--------|
| **Purpose** | List inbound orders for client company |
| **Workflow** | Search → click row → detail |

### UI

- **card__title:** Inbound orders
- Search placeholder: "Order number or UUID"
- **data-table columns:** Order #, Status, Expected arrival, Created, Lines (count)
- **Row interaction:** `cursor: pointer`, `role="link"`, click/Enter/Space → `/inbound-orders/:id`
- Pager controls

### Logic

- PAGE_SIZE 25
- Status shown as raw string (no badge component)

### API

| Method | Path |
|--------|------|
| GET | `/inbound-orders` |

---

## `/inbound-orders/:id` — InboundOrderDetailPage

| Field | Detail |
|-------|--------|
| **Purpose** | Read-only inbound order detail |
| **Parity target** | Admin `InboundDetailPage` (subset) |

### UI

- **Back link:** ← Back to inbound orders (`Link` muted)
- **Header row:** title + **badge** status (`badge badge-*` classes)
- **details** block: Order #, Client, Expected arrival, Created, optional reference/confirmed/completed/notes
- **Line items table:** #, SKU, Product, Expected, Received, Lot
- **404:** specific error banner
- **Loading:** "Loading order…"

### Logic

- `useParams().id`
- `fetchClientInboundOrder(id)`
- `orderStatusBadge()` maps status → badge class
- `fmtQty()` for decimals

### API

| Method | Path |
|--------|------|
| GET | `/inbound-orders/:id` |

**Response includes:** `lines[]` with nested `product`, quantities as strings.

---

## `/outbound-orders` — OutboundOrdersPage

| Field | Detail |
|-------|--------|
| **Purpose** | List outbound orders |

### UI

Same list pattern as inbound: Order #, Status, Required ship, Created, Lines.

### API

| Method | Path |
|--------|------|
| GET | `/outbound-orders` |

---

## `/outbound-orders/:id` — OutboundOrderDetailPage

| Field | Detail |
|-------|--------|
| **Purpose** | Read-only outbound detail |

### UI

- Back link
- Title + status badge
- **details:** Order #, Client, Required ship, Destination (pre-wrap), Carrier, Tracking, Created, reference, confirmed, shipped, notes
- **Lines table:** #, SKU, Product, Requested, Picked, Line status

### API

| Method | Path |
|--------|------|
| GET | `/outbound-orders/:id` |

---

## Client styling reference

### Semantic classes (from `shared/design-system/globals.css`)

| Class | Appearance |
|-------|------------|
| `.page--app` | Full-height flex column |
| `.topbar--app` | White sticky header, 5rem height |
| `.sidebar` | 220px white panel, border-right |
| `.sidebar__link--active` | Green `#1a7a44` pill |
| `.card` | White rounded-12px, border, light shadow |
| `.data-table` | Full-width table, header row, `.num` right-align |
| `.btn--primary` | Green `#1a7a44` |
| `.btn--secondary` | White bordered |
| `.banner--error` | Red tinted alert |
| `.details` / `.details__row` | Label-value grid (120px label column) |
| `.pager` | Flex footer with meta + buttons |
| `.badge-*` | Status pills (shared with admin) |

### Inline styles

Detail pages use inline `style={{}}` for flex headers and back links — not extracted to components.

### Responsive

- `table-wrap` horizontal scroll
- Sidebar mobile overlay in `PortalLayout` (breakpoint-driven in component)

---

## API summary table (all client endpoints)

| Method | Path | Used by |
|--------|------|---------|
| POST | `/auth/login` | Login |
| GET | `/auth/me` | Boot, Welcome |
| POST | `/auth/logout` | Sign out |
| GET | `/products` | Products |
| GET | `/stock` | Stock |
| GET | `/inbound-orders` | Inbound list |
| GET | `/inbound-orders/:id` | Inbound detail |
| GET | `/outbound-orders` | Outbound list |
| GET | `/outbound-orders/:id` | Outbound detail |

---

## WebSocket integration

| Event | Client handler today |
|-------|---------------------|
| All six admin events | `invalidateQueries(['client', 'stock'])` only |

**Rebuild recommendation:** Also invalidate `inbound-orders`, `outbound-orders`, `products` query prefixes when orders change.

---

## Comparison to admin order detail

| Feature | Admin | Client |
|---------|-------|--------|
| Confirm/Cancel | Yes | No |
| Receive lines | Yes | No |
| Workflow timeline | Yes | No |
| Warehouse/dock pick | Yes | No |
| Status badges | `StatusBadge` | CSS `badge` classes |
| Table component | `DataTable` | Native `data-table` |
| i18n | EN/AR strings | EN only (+ RTL) |
