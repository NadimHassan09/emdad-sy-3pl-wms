# Pending Decisions — يحتاج المالك يجاوب عليهم

Generated: 13 Nov 2026 · **Owner final answers recorded 14 Nov 2026**

---

## Resolved by owner — 14 Nov 2026

### 1. B3 — ربط الـ Inbound بالـ OMS

**القرار:** المقصود = **traceability فقط**: على صفحة OMS order details، لكل منتج يظهر الـ inbound order اللي جت منه الكمية. **مش** return flow، ومش إنشاء inbound عند الـ return (الـ return بيزوّد الكمية أصلاً — inbound إضافي = double).

**التنفيذ:** التأكد إن `InboundTraceability` الموجود شغّال صح في الـ UI (مش بناء feature جديد من صفر).

---

### 2. B12 — In-transit float & carrier reconciliation (+ client shield)

**القرار:** ابنِ **كل** الأنظمة دلوقتي. مش disabled ثابت — **admin/super-admin settings** يفعّل/يلغي كل جزء (in-transit float، carrier reconciliation، client shield) مع مرونة في الـ financial model.

---

### 3. B15 — COD Due Moment / Liquidity / Prep Fee

**القرار:** نفس الأسلوب — **admin/super-admin settings** لاختيار: متى يستحق الـ COD، كيف تتغطى الـ liquidity gap، وفي prep fee ولا لأ.

---

### 4. O-11 — Custom Roles / Editable Permissions

**القرار:** وافق على **DB migration على staging** وتنفيذ الـ feature. احذر من فقدان data. Production لا يُلمس.

---

### 5. D-040 — Sila Webhook Registration

**القرار:** الوكيل يسجّل الـ webhook عبر **API** (مش بوابة Sila UI — عندهم bug إن الـ FE مش بيورّي التسجيل). يتحقّق إن التسجيل ناجح عبر API.

---

### 6. B17 — Picking / Packing List Visual

**القرار:** تصميم المالك (صورة 14 Nov):
- **Picking list** منفصلة عن **Packing list** (مش مدموجين).
- منظمة حسب **الأوردرات** (كل أوردر ممكن صفحة أو أكتر).
- داخل كل أوردر: بنود/منتجات، بيانات العميل، كميات، إجمالي قطع، توقيع.
- أسلوب منظم زي الـ screenshot (أعمدة SKU / منتج / كمية، grouping واضح).

---

### 7. O-13 — Google Sheet Real Credentials

**القرار / الدليل:** المالك جرّب → **403 access_denied**:  
`emdadsy.com has not completed the Google verification process` — التطبيق في **Testing**.

**متابعة 14 Nov (مساءً):** إخفاء كل واجهات Google OAuth + forgot-password / Sheets Google من الـ UI (`GOOGLE_AUTH_UI_ENABLED=false`) حتى ينشر العميل التطبيق أو يكملها مبرمج لاحقًا. الكود موجود — مش محذوف. انظر `GOOGLE_AUTH_UI_HIDDEN.md`.

---

### 8. F16 — COD remittance

**القرار:** مسموح الاتنين على staging: (A) COD جديد عبر **Sena sandbox**، و/أو (B) استخدام COD موجود لـ **Madino / Acme** (staging مش production data).

---

### B6 follow-up

لم يُذكر في جلسة 14 Nov → يبقى كما هو (company-wide عند Approve) إلا لو المالك طلب غير كده لاحقاً.

---

## Answered earlier (unchanged)

### S1-2 — `storage_cbm` vs `storage_fee`
Maps to existing `BillingInvoiceLineType.storage_fee` — no migration.

### B6 — Stock visibility
Company-wide `currentStock` at Approve; warehouse filter only later at allocation.

### Sila COD + Recipient Pays (I-6)
Resolved 13 Nov — AWB `7f01f3f5-…` on OUT-2026-04466.
