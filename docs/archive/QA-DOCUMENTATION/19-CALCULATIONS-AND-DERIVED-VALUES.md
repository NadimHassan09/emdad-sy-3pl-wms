# 19 — Calculations and Derived Values

**Staging only.** Document only implemented formulas. Kane should compute expected values from visible inputs and compare to UI/API-visible totals.

---

## CALC-OMS-001 — Line Total

### Purpose
Monetary value of one OMS line.

### Inputs
`requestedQuantity`, `unitPrice`, optional explicit `lineTotal`, optional `discountAmount` (stored only).

### Formula
```text
if lineTotal provided:
  stored_line_total = lineTotal
else if unitPrice provided:
  stored_line_total = unitPrice × requestedQuantity
else:
  stored_line_total = null
```
**Discount is NOT subtracted** from line total in create/update math.

### Rounding
Prisma Decimal; client portal uses whole number qty and whole number unit price validation. Exact display rounding: **UNKNOWN / NEEDS VERIFICATION**.

### Timing
Order create (and import). Lines are not updated via OMS update DTO.

### UI Representation
Online order create/detail line price × qty; admin OMS detail lines.

### Cross-Module Representation
Copied onto outbound lines when outbound is provisioned from OMS.

### QA Check
Enter qty=2, price=50 → expect line total 100 if shown; confirm discount field (if any) does not reduce total unless product owner documents otherwise.

### Edge Cases
Missing price → null line total; fractional qty allowed for some admin/non-discrete UOMs; client requires integers.

### Confidence
High

---

## CALC-OMS-002 — Lines Sum and Subtotal

### Purpose
Order merchandise + shipping fee.

### Inputs
All line totals; `shippingFee` (optional).

### Formula
```text
linesSum = Σ(lineTotal) for lines with non-null lineTotal
  (on approve/update, if lineTotal null: add unitPrice × qty when unitPrice set)

shippingFeeForMath = shippingFee if provided else 0

subtotal = linesSum + shippingFeeForMath
```
On create, DTO `subtotal` input is **ignored**; system writes computed subtotal.  
API serialization may **recompute** `subtotal_api = linesSum_api + (shippingFee ?? 0)` and `total_api = subtotal_api`.

### Timing
Create; approve when fee set; update when fee/lines/subtotal patched.

### Double-calculation risk
Stored subtotal vs recomputed API/UI total — should match. If UI shows both and they differ → investigate. Shipping fee is **not** auto-derived from carrier rates into OMS fee (rates are quotes only).

### QA Check
Lines 100 + 50, shipping fee 10 → subtotal/total 160. Omit fee → merchandise-only math with fee 0.

### Confidence
High

---

## CALC-OMS-003 — COD Amount

### Purpose
Cash-on-delivery collection amount (merchandise collected from the receiver).

### Inputs
`paymentMethod`, optional `codAmount`, merchandise `linesSum`, optional `shippingFee` (billing only).

### Formula
```text
subtotal = linesSum + shippingFee   # order total / client billing basis
COD is NOT equal to subtotal when a shipping fee exists.

on create:
  if codAmount provided → use it
  else if paymentMethod === COD → codAmount = linesSum   # merchandise only
  else → null

on approve / update with shippingFee change:
  if paymentMethod === COD and codAmount not explicitly patched → codAmount = linesSum
  else keep / use explicit codAmount

Shipping fee is charged to the client via billing — it is not added into COD.
```
`deriveCodStatus`: COD + non-zero amount → `pending`; else null.

At Mark delivered, COD record `originalAmount = order.codAmount` (rejects zero; does not fall back to `subtotal`).

On delivery revert, any COD record for the order is voided/deleted so portals no longer show it; a later Mark delivered may regenerate.

### Timing
Create; approve fee change; update patches; delivery COD generation; void on delivery revert.

### QA Check
COD order with lines 50 + shipping 10 → `subtotal=60`, `codAmount=50`. Prepaid → no COD amount. Mark delivered → COD record appears for non-zero COD. Delivery revert → COD record gone from admin/client.

### Confidence
High (aligned to fix-sprint business rule: COD ≠ billing shipping)

---

## CALC-OMS-004 — Carrier Weight / Volume Prefill

### Purpose
Default shipping weight/volume for carrier config.

### Inputs
Per product `weightKg` / `volumeCbm`, line qtys, optional explicit shipping weight/volume, shipping method.

### Formula
```text
sumWeights = Σ(weightKg × qty)  // round 4 dp; null if none usable
sumVolumes = Σ(volumeCbm × qty) // round 6 dp

if explicit provided → use explicit
else if method !== carrier → undefined
else → sumWeights / sumVolumes
```

### Timing
OMS create/update when shipping fields applied; outbound shipping details.

### Edge Cases
Envelope carrier path forces **1 kg**; box max **200 kg** (Babel readiness).

### Confidence
High

---

## CALC-INV-001 — Available Stock

### Purpose
Free stock that can be promised/picked.

### Inputs
`quantity_on_hand`, `quantity_reserved`.

### Formula
```text
quantity_available = quantity_on_hand − quantity_reserved
```
(Generated stored column.)

Pickable aggregates typically filter `status = available` (exclude awaiting_putaway / quarantined).

Availability API with outbound id may credit that order’s own reservations:
```text
availableForOrder = available + reservedByThisOrder
```

### Timing
Continuous via DB; UI reads currentStock.

### QA Check
On inventory screens: Available + Reserved = On hand (for a row).

### Confidence
High

---

## CALC-INV-002 — OMS Stock Sufficiency

### Purpose
Block create/confirm/approve when not enough free stock.

### Inputs
Requested qty per product (summed across lines); Σ available for that product.

### Formula
```text
if requested > available → reject
(message includes SKU, requested, available)
```

### Timing
OMS create; admin confirm→processing; approve.

### Confidence
High

---

## CALC-OUT-001 — Returnable (WMS)

### Purpose
Max qty for a warehouse return line against a shipped outbound.

### Inputs
Outbound line `pickedQuantity`; sum of expected qty on active returns (`draft|confirmed|receiving|inspecting|completed`).

### Formula
```text
remaining = max(pickedQuantity − alreadyReturnedExpected, 0)
```
API may label shipped quantity as pickedQuantity.

### Timing
Return create validation.

### Confidence
High

---

## CALC-OUT-002 — Returnable (OMS)

### Purpose
Max qty for OMS return line.

### Inputs
OMS line `requestedQuantity`; prior OMS return qtys for that product/order.

### Formula
```text
already + this ≤ ordered.requestedQuantity
```

### Confidence
High

---

## CALC-INB-001 — Over-Receive Limit

### Purpose
Cap received vs expected.

### Formula
```text
received_quantity ≤ expected_quantity × 1.10   // DB
```
Some app paths reject `received > expected` (100%) unless short-close flags apply.

### Confidence
High for 110% DB; Medium for UI path variance.

---

## CALC-BIL-001 — Cycle Draft System Lines

### Purpose
Usage + subscription for a billing cycle draft.

### Inputs
Plan fees; counts of inbound `completed` with `completedAt` in window; outbound `shipped` with `shippedAt` in window; `windowEnd = min(cycle.endsAt, now)`.

### Formula
```text
subscription_line = 1 × fixedSubscriptionFee
inbound_line      = completedInboundCount × inboundOrderFee
outbound_line     = shippedOutboundCount × outboundOrderFee
```
Tier fields `outboundBaseFee`, `outboundIncludedItems`, `outboundAdditionalItemFee` are **not** used in this computation.

### Timing
Invoice recalculation for active/renewed cycle.

### Double-charge risks
- Concurrent draft creation for same cycle (no unique draft constraint) → possible duplicate drafts → double finalize (**code risk**).
- Recalc after issue does not rewrite issued invoices.
- Ad-hoc invoices coexist intentionally.

### QA Check
Complete N inbounds / ship M outbounds in cycle → draft lines reflect N and M × fees + subscription.

### Confidence
High

---

## CALC-BIL-002 — Invoice Totals (Discount + VAT)

### Purpose
Invoice payable amount.

### Inputs
Sum of line totals; discount type/value; `vatPercentage` (default 0).

### Formula
```text
subtotalAmount = Σ line.totalPrice          // 2 dp
discountAmount =
  fixed → min(discountValue, subtotal)
  percentage → subtotal × discountValue / 100
taxableAmount = subtotalAmount − discountAmount
vatAmount = taxableAmount × vatPercentage / 100
grandTotal = taxableAmount + vatAmount
totalAmount = grandTotal
```

### Timing
Draft edit; ad-hoc create; display on invoice detail/PDF.

### QA Check
With known lines and VAT%, recompute grand total from invoice UI fields.

### Confidence
High

---

## CALC-BIL-003 — Days Remaining / Expiring

### Purpose
Account status banner.

### Formula
```text
daysRemaining = ceil((endsAt − now) / 1 day)
if daysRemaining ≤ 7 and cycle live → accountStatus expiring (ops still allowed)
```
Reminder notifications at 30/14/7/3/1 days.

### Confidence
High

---

## Values That Must Stay Consistent Across Screens

| Value | Screens to reconcile |
|-------|----------------------|
| OMS line qty / SKU | OMS detail ↔ Outbound detail lines after approve |
| OMS subtotal / shipping fee / COD | OMS detail ↔ (after delivery) COD record amount |
| Outbound status | Outbound detail ↔ OMS commercial label (via sync map) |
| On hand / reserved / available | Inventory stock ↔ product client available |
| Invoice line counts | Billing draft ↔ count of completed inbound / shipped outbound in cycle |

If values diverge without a documented timing lag, classify as **data-consistency failure** (after confirming sync map expectations in `20-CROSS-MODULE-INVARIANTS.md`).
