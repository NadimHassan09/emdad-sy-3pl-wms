# 17 — Shipping and Carriers

**Confidence:** High for waiting_for_shipping_method → details → ready_to_ship. Medium for every Babel/carrier field requirement on staging credentials.

---

## Shipping Companies (admin)

### Entry

Sidebar **Shipping Companies** (`/shipping/companies`).

### Actions

- **Connect** a carrier
- **Test connection**
- **Disconnect**

### Visible states

Connected / not connected; shipment records may show pending · created · failed.

Roles: super_admin, wh_manager.

---

## Shipping method selection (outbound)

Occurs only when outbound status is **Waiting for Shipping Method**.

### Options

| Method | User label (approx.) | Extra requirement |
|--------|----------------------|-------------------|
| `manual` | Manual | None |
| `carrier` | Shipping Company | Provider code / company selection |

### After selection

Status → **Waiting for Shipping Details**.

### Shipping details fields (carrier-oriented)

Users may need to provide some of:

- Receiver lat / lng
- Package type (Box / Envelope)
- Contents
- Delivery type (Address / Hub)
- Pickup type (Address / Hub)
- Payer (Sender / Receiver / Reseller)
- Weight kg / Volume cbm
- Phone country

Exact required set depends on method; carrier path is stricter and may require successful **Send Shipment** before **Mark Shipping Details Complete**.

### Completion

**Mark Shipping Details Complete** → **Ready to ship** (Waiting for Dispatch) → Dispatch → **Shipped**.

---

## OMS vs outbound shipping

- Clients place a **map pin** on online order create (commercial delivery coordinates).
- Warehouse still selects **shipping method** later on the outbound.
- Clients must **not** set shipping fee; admin sets fee at/before approval.

---

## Failure messages (examples)

- Shipping method can only be selected at waiting_for_shipping_method…
- shippingProviderCode is required when selecting Shipping Company.
- Send Shipment is only for carrier shipping…
- Send Shipment successfully before marking Shipping Details as Complete.

---

## QA notes

- Do not assume carrier Send Shipment works without valid staging carrier credentials.
- If Test connection fails, classify as **environment/configuration** unless Connect UI itself is broken.
- Manual method should allow completing shipping details without carrier send.
