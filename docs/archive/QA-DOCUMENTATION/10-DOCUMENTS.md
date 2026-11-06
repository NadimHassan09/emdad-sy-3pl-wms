# 10 — Documents and PDFs

**Confidence:** High for GRN / Delivery note / Final contract / invoice PDF entry points. Medium for exact filename patterns and when Create vs Open appears.

---

## Document types users encounter

| Document | Typical trigger | Where users open it |
|----------|-----------------|---------------------|
| GRN (Goods Received Note) | After inbound receiving / contracts | Contracts → GRN; inbound Documents card |
| Delivery note (DN) | After outbound dispatch / contracts | Contracts → Delivery note; outbound/task |
| Final contract | Contracts module | Contracts → Final contract |
| Invoice PDF | Billing invoice | Admin invoice detail Download/Export PDF |
| Print instructions | Order workspace | Inbound/Outbound detail |
| Task Export PDF | Task execute | Receiving / Putaway / Pick / Dispatch |
| Pack label | Pack modal | Print label |
| Carrier labels | Bulk shipping | Print / Download Labels |
| Client API docs PDF | APIs page | Download documentation |
| Client invoice | Invoice detail | Browser Print |
| Import templates | Import modals | Download template (CSV/XLSX) |

---

## Contracts module (admin)

### Paths

- `/contracts/grn`
- `/contracts/dn`
- `/contracts/final-contract`

### Actions

- **Create PDF**
- **Open PDF**
- Language variants: **EN** and **AR**

### Generation status filters

pending · partial · complete (and possibly “generated”)

### Preconditions

Documents generally require an eligible order/task context. Creating without a linked completed stage may fail or stay pending — verify message on staging.

---

## Order & task document cards

On inbound/outbound detail and some tasks:

1. User expands Documents section.
2. Chooses Create PDF or Open PDF.
3. Browser downloads or opens PDF preview.

Arabic PDFs should present Arabic content / RTL where implemented.

---

## Billing invoice PDF (admin)

1. Open invoice detail.
2. Click **Download PDF** or **Export PDF**.
3. File downloads.

Client portal uses **Print** (print dialog) rather than a guaranteed blob download.

---

## Client API documentation PDF

1. client_admin → **APIs**.
2. **Download documentation**.
3. File name pattern resembles `emdad-{scope}-api-documentation.pdf`.

---

## Failure behavior

| Situation | Expected |
|-----------|----------|
| Open PDF before generation | Create first, or error/empty |
| Worker without export permission | Export PDF hidden |
| Network failure | Error toast / message; no silent success |

Exact error strings: **NEEDS VERIFICATION** per screen.

---

## QA checks

- PDF opens and is non-empty
- Key identifiers appear (order number, client name, dates) when expected
- EN vs AR selection changes language
- Download does not require leaving the authenticated session
