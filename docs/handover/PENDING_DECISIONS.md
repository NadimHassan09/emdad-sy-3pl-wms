# Pending Decisions — يحتاج المالك يجاوب عليهم

Generated: 13 Nov 2026

## 1. B3 — ربط الـ Inbound بالـ OMS

**الطلب (العميل):** "هل من الممكن ربط الـ inbound order بالـ OMS عشان مش عم نعرف ده وارد من اي طلبية"

**الخيارات:**
- A: inbound created automatically when an OMS order returns (return flow triggers inbound)
- B: admin manually links an existing inbound to an OMS order (FK field on inbound)
- C: inbound is created from a purchase order that the admin attached to an OMS order
- **يحتاج المالك يوضّح** القصد الدقيق قبل البناء.

---

## 2. B12 — In-transit float & carrier reconciliation

**الطلب (العميل):** in-transit float indicator + carrier reconciliation module + client shield

**الموقف:** المالك قال 2 Nov مش متفق عليها.

**الخيارات:**
- A: ابنيهم دلوقتي وراء disabled settings (يشغّلهم المالك لما يقرر)
- B: مفيش دلوقتي، ممكن Sprint 3
- **يحتاج قرار المالك.**

---

## 3. B15 — COD Due Moment / Liquidity / Prep Fee

**الطلب:** متى يستحق الـ COD (delivered / carrier confirms collection / carrier remits)؟
كيف تتغطى الـ liquidity gap؟
في prep fee ولا لأ؟

**الموقف:** المالك قال محتاج يتفاهم مع صاحب الشركة. لسه مقرّرش.

**الأثر:** الـ COD settlement flow في الـ billing مش هيتكتمل غير بعد القرار ده.

---

## 4. O-11 — Custom Roles / Editable Permissions

**الطلب (المالك):** super admin يعمل custom roles مع editable permission sets per module × action

**الموقف:** يحتاج DB migration.

**خطوة المالك:** وافق على الـ design والـ migration (نعرضها عليه)؟

---

## 5. D-040 — Sila Webhook Registration

**المطلوب:** المالك يضغط "Register webhook" في Shipping Companies → Sila

**الأثر:** بدون ده، Sila webhook events (tracking updates, delivered, failed) مش بتوصل.

---

## 6. B17 — Picking List Visual Approval

**المطلوب:** المالك يشوف الـ picking list الجديد (commit 45828e197) ويوافق على التصميم.

**الأثر:** لو مش موافق بنعمل revision.

---

## 7. O-13 — Google Sheet Real Credentials Verify

**المطلوب:** المالك يتأكد إن الـ Google OAuth credentials (اللي دخلها 6 Nov) شغّالة صح مع real Google Sheet.

**الخطوات:** client يعمل sign-in بـ Google → ينشئ real sheet → يحاول يعدّل بعد الـ approval (المفروض يترفض).

---

## Answered — no decision needed

### S1-2 — `storage_cbm` charge-line type vs existing enum

**Answer (13 Nov 2026):** Spec names the type `storage_cbm`; Prisma already has `BillingInvoiceLineType.storage_fee`. No migration — calculator writes `storage_fee` (see `billing-automation.service.ts` `chargeLineType` and `billing-invoices.service.ts` addLine). Incentive discount uses a **manual** negative line (no `incentive_discount` enum) until owner approves a migration.

### B6 — Stock visibility per warehouse (OMS order form)

**Answer (code, 13 Nov 2026):** On the OMS order **create/confirm** path there is **no per-warehouse stock preview** in the form. Stock is gated only at **Approve** via `OmsOrdersService.assertSufficientStockForLines` (`backend/src/modules/oms/oms-orders.service.ts`), which `groupBy`s `currentStock.quantityAvailable` by `productId` for the **whole company** (all warehouses / locations) — there is **no `warehouseId` filter**.

Warehouse-scoped allocation happens later when the outbound plan runs (`order-allocation.service.ts` can filter by `warehouseId`).

**Implication:** Admin approving an OMS order sees company-wide available qty, not a single warehouse. If the owner wants “stock of the selected warehouse only” on the form or at approve, that would be a product decision (see Needs owner decision below).

### Needs owner decision (follow-up from B6)

- Keep company-wide stock at Approve (current), or require a warehouse on the OMS order and gate stock to that warehouse only?

---

## Blocked — needs Test company data (not a product decision)

### F16 — COD remittance mutation

Owner approved money mutation. Staging has **0** COD records for client “Test company” and **0** delivered OMS orders for that client (safety: Test company / Nadim Hassan only). Cannot remittance without fabricating another client’s COD.

**Owner options:** (A) allow creating/delivering one Test company COD via Sena sandbox then remittance, or (B) name one Madino/Acme Available COD as disposable test exception.

---

## Answered in Sprint 1 live work

### Sila COD + Recipient Pays (I-6)

**Resolved 13 Nov 2026:** Live OUT-2026-04466 / OMS-2026-03729 — Recipient Pays + COD folds carrier fee into `pay_on_delivery` (`payer=merchant`, `codAmount=23.5`), leaf `area_id`, duplicate `reference` → unique suffix retry → AWB `7f01f3f5-…`. See `qa-scripts/out/sila_live_i6_20261113.txt`.
