# 13 — Errors and Validation

**Confidence:** High for the listed messages (taken from implemented validation). Medium for exact wording after i18n.

---

## How to use this file

When testing negative paths, compare the **visible** message to these expectations. Slight wording differences across EN/AR are acceptable if meaning matches. Missing validation where this doc says validation exists is a bug.

---

## Authentication

| Situation | Expected user outcome |
|-----------|------------------------|
| Wrong password | Stay on login; error shown |
| Inactive client account | `/account-inactive` |
| Expired session | Redirect to login; optional expired Continue message |
| Wrong portal for account type | Login failure |

---

## Recipient contact

| Rule | Example message |
|------|-----------------|
| Name not letters/spaces | Name can only contain Arabic or English letters and spaces. |
| Invalid phone for country | Please enter a valid phone number for {Country}. |
| Missing country/phone | Please select a country and enter a valid phone number. |
| Bad phone country | Phone country must be a valid ISO code or dialing code. |

---

## Dates & destination

| Rule | Example message |
|------|-----------------|
| Ship date before today | Required ship date cannot be before today. |
| Missing destination/address | Destination address is required (address line / city / destination). |

---

## Quantities & stock

| Rule | Example message |
|------|-----------------|
| Non-integer qty (discrete UOM) | Requested quantity must be a whole number… |
| Insufficient stock (OMS) | Insufficient stock for {sku}: requested {n}, available {m}. |
| Insufficient stock (generic) | Insufficient stock to fulfil the requested quantity. |
| Over-receive | Received quantity exceeds the 110% over-receive tolerance. |
| Pack > pick | Packed qty cannot exceed picked qty. |
| Ship qty mismatch | Ship qty must match picked qty for line {id}. |
| Lot required | lotNumber is required for lot-tracked products. / Product {sku} requires a lot on return lines. |

---

## OMS / shipping gates

| Rule | Example message |
|------|-----------------|
| Approve incomplete order | This order is incomplete. Shipping/Delivery information must be completed before approval. |
| Illegal status transition | OMS transition not allowed: {from} —[{action}/{actor}]→ … |
| Shipping method wrong status | Shipping method can only be selected at waiting_for_shipping_method… |
| Carrier without provider | shippingProviderCode is required when selecting Shipping Company. |
| Send shipment rules | Send Shipment is only for carrier… / Send Shipment successfully before marking Shipping Details as Complete. |

---

## Billing / permissions

| Rule | Example message / UX |
|------|----------------------|
| Staff billing | Only client administrators can access billing. / Page not available for your role |
| Restricted account | Account restricted banner; creates disabled |
| Tenant scope (admin multi-company) | Select a client tenant… (**more admin-tooling**; may appear if company context missing) |

---

## Import / CSV

| Rule | Example |
|------|---------|
| Missing column | Missing required CSV column: {h}. |
| Duplicate external reference | Error naming existing order number |

Import modals typically offer an error file download.

---

## Map pin (client online order)

| Rule | Expected |
|------|----------|
| Submit without pin | Blocked; message that delivery location / pin is required |

Exact string may differ EN/AR (**NEEDS VERIFICATION** for AR completeness).

---

## Prisma / unexpected server errors

Users may see a generic failure toast. Example previously observed during create when DB constraints mismatched app expectations (shipping_method null). If a raw database error appears in the UI, report as **product bug** (poor error surfacing) even if root cause is data.

---

## Double submit

Buttons should disable while submitting. If two identical orders appear after double-click, report as bug. If second submit is rejected, that is acceptable.
