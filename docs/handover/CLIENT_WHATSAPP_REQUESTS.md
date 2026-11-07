# Client WhatsApp requests — checklist for final review

Source: two WhatsApp exports the owner shared on 2 Nov 2026 (text messages only; voice notes and calls were not available).
- Chat A = the client owner (Yousef), 6 Oct – 31 Oct 2026.
- Chat B = the client's operations contact, 10 Oct – 2 Nov 2026.
Phone numbers and every password/username shared in the chats are removed on purpose. Never copy credentials into the repo.

Status: ✅ built · 🔍 built, must be verified in the browser · ⬜ not built · 🔴 not possible / blocked (reason) · ❓ needs the owner to clarify.
**Every ✅ and 🔍 row must be checked in the real UI (browser) before handover.** Write the result in the "Verified" column with date and evidence (order code, screenshot name).

## 1. The messages (verbatim text, Arabic)

### Chat A — client owner
| # | Date | Message |
|---|---|---|
| A1 | 6 Oct | "زي طباعة البوليصة خربت / و import excel خربت / و الربط مع بابل خرب" (waybill printing broken, Excel import broken, Babel integration broken) |
| A2 | 9 Oct | "بالنسبة لصلة يجب رفع حالات التعقب مثل بابل و ليس الحالات الرئيسية مثل processing" (for Sila, show the detailed tracking statuses like Babel, not only top-level ones like processing) |
| A3 | 10 Oct | Forwarded Sena API PDF: "ممكن اضافة هذه الشركة" (add Sena) |
| A4 | 10 Oct | Forwarded Sila integration guidance (9 points): create returns 201 without courier code; read courier code by `GET /cargos/{id}` or webhook `cargo.courier_barcode_assigned`; never query by courier code; cancel only `PUT /cargos/{id}/cancel`; COD amount must equal what the recipient pays incl. shipping, in the stated currency; TARABUT prices in USD; send `recipient.area_id` (leaf areas); check `GET /cargos?reference=` before re-sending; do not test on the live account; show `error.message` and keep `request_id` |
| A5 | 15 Oct | "هكذا بابل تستلم الطلبيات بشكل سهل جدا فقط تمرير" (video: Babel receives orders by simple scanning) |
| A6 | 19 Oct | Forwarded "دليل الربط مع صلة لمبرمج إمداد" PDF (Sila integration guide) |
| A7 | 31 Oct | Sena portal access shared (credentials removed) + Sena Merchant API PDF |
| A8 | 31 Oct | Owner (Nadim) sent the client the "EMDAD Financial Management System" proposal: per-client current account (credit/debit, net balance), only Delivered/Returned shipments count, operations log, Current Balance page in the client portal, statements/invoices any time for any period with PDF, no double counting, admin sees carrier cost vs client charge and margin (hidden from client), carrier cost updates kept with history, separate balances per currency. 7 open questions (credit/debit model? only final statuses? COD due when delivered or when collected? return fee round-trip or return only? invoices any time? client vs admin visibility? other charges?) |

### Chat B — client operations
| # | Date | Message |
|---|---|---|
| B1 | 20 Oct | "ليش ملغي زر الالغاء في الادمن … او التعديل قبل الموافقة" (why is the cancel button / edit-before-approval missing in admin?) |
| B2 | 20 Oct | "ممكن موعد نهائي لرفع التعديلات او تقسيمها على مرحلتين" (deadline, or split delivery into two phases) |
| B3 | 20 Oct | "هل من الممكن ربط ال inbound order بل oms عشان مش عم نعرف ده وارد من اي طلبية" (link inbound orders to OMS — we cannot tell which order an inbound came from) |
| B4 | 20 Oct | "هل ممكن اضافة اغلبية انواع الفلاتر و التصدير excel لجميع الاقسام مثل cod, Inventory, Inbound, Product … اهمها الفلترة عن طريق اسم المتجر و التواريخ" (filters + Excel export on all sections; most important: filter by store name and dates) |
| B5 | 20 Oct | "جربت اضافة مستودع جديد نجح و لكن لم اتمكن اضافة اماكن خاصة فيه لحفظ المنتجات" (created a new warehouse but could not add storage locations in it) |
| B6 | 20 Oct | "هل الطلبية مخزونها اذا غير موجود في مستودع معين هل يظهر المخزون ام يظهر فقط المخزون المتوفر في المستودع المعين" (when stock is not in a given warehouse, does the order show all stock or only that warehouse's stock?) — a question, not a change |
| B7 | 21 Oct | Babel admin portal + Babel webhooks doc link shared (credentials removed) |
| B8 | 25 Oct | "ممكن نضيف تعديل من طرف العميل او الغاء من طرف العميل قبل التأكيد من طرفنا" (client can edit or cancel before EMDAD confirms) |
| B9 | 25 Oct | "و تعديل كل الامور مثل قيمة التحصيل و العدد من طرف ال super admin" (super admin can edit everything: COD amount, quantity…) |
| B10 | 29 Oct | Connected a Google Sheet; "الطلبات الي فيهم (الرقة) مابيمشو شو سبب؟" (Raqqa orders do not go through — why?) |
| B11 | 29 Oct | Address problem: customers type the address by hand, choose the wrong governorate or a neighbourhood not in the list (e.g. chose Damascus but lives in Jdeidet al-Fadl, Rural Damascus) → API rejects with `VALIDATION_ERROR: address neighborhood` / `Unknown city/area`. Owner replied he had fixed it on staging. |
| B12 | 31 Oct | Long note on the cash-flow gap: Babel bills EMDAD per movement, EMDAD bills the client on the final result. Proposes for admin: **in-transit float indicator** (shipping cost of shipments still on the way, alert near the limit), **carrier reconciliation** module (compare Babel's statement with EMDAD shipments, catch double billing), **client shield** (client account untouched until a shipment is final). Asks whether to add these. |
| B13 | 31 Oct | "ممكن حالة جاهزة للشحن تصير بعدها بإمكاننا نحدد شركة الشحن … الطلبيات قيد المعالجة مع انه هية جاهزة فقط بانتظار الشحن" (a "ready to ship" status, after which we choose the carrier; today orders sit in "processing" although they are ready) |
| B14 | 31 Oct | "و امكاننا نغير السعر و العدد و كافة تفاصيل الشحنة من قبل السوبر ادمن باي مرحلة" (super admin can change price, quantity and all shipment details at any stage) |
| B15 | 1 Nov | Owner's three decisions to discuss with the company owner: when COD becomes due (delivered / carrier confirms collection / carrier remits); how to cover the liquidity gap (EMDAD working capital / delay client payout / client prepaid balance / mix); order preparation fee (charge upfront / none now / later). **Still undecided.** |
| B16 | 2 Nov | "الزبائن عم تعاني من موضوع الربط و موضوع رفع الطلبات … errors بسبب مشاكل بسيطة متل تنسيق … ال excel template يكون اله مثل instructions بسيط يوضح" (import errors from simple formatting issues; the Excel template should include simple instructions) |
| B17 | 2 Nov | "هل موضوع ال picking list انحل؟" (is the picking list issue solved?) |
| B18 | 2 Nov | "مشاكل ايضا عند اختيار اسماء الزبائن من الهاتف عند رفع منتجات مثلا. او مخزون اسم الشركة بتغير تلقائيا و برجع ل acme import" (on the phone, when choosing the client while adding products or stock, the company name changes by itself back to "Acme Import") |
| B19 | 2 Nov | "عامود محتوى الشحنة يكون موجود بسطر الطلبيات من الخارج … اضافة زر ال copy للأمور الاساسية مثل العنوان و الاسم و الرقم و رقم الطلبية … مثل copy الخاصة بل tracking number" (shipment-contents column in the orders list; copy buttons for address, name, phone, order number, like the tracking-number copy) |
| B20 | 2 Nov | "نظام olivery … groupby للطلبيات عن طريق كتير امور" (look at Olivery; group-by on orders by many fields; filters) |
| B21 | 2 Nov | Delivery Joud (Olivery) integration group: Postman API docs `https://documenter.getpostman.com/view/34576774/2sBXc8q4GM`, account shared (credentials removed), Android/iOS apps |
| B22 | 2 Nov | Sent `oms-orders-import-template (10).csv`, `emdad cities.xlsx`, and the Babel "قالب ادخال الوسيط" Excel: "هاد الملف … يكون ابسط … شوف نظام بابل بقبل الطلبات كلها و بتقدر تعدل" (make our template simpler, like Babel's which accepts all orders and lets you fix them) |
| B23 | 2 Nov | "هدول المدن نضيف بقية المحافظات مع مناطقهم و يكونوا drop down list" (add the other governorates with their areas, as drop-down lists, in the template) |

## 2. Checklist

| Ref | Request | Status | Where / how to verify | Verified |
|---|---|---|---|---|
| A1 | Waybill printing works | 🔍 | `/orders/oms/:id/waybill`, batch waybills PDF/Excel (F08). Print one Test company order. | |
| A1 | Excel import works | 🔍 | `/orders/oms` → Import; client portal import. Use the template, then a messy file (F03). | |
| A1 | Babel integration works | ✅ | Live E2E 3 Nov (OUT-2026-04464). Re-check quote + create on one test order only after owner approval. | 3 Nov |
| A2 | Sila detailed tracking statuses (not just "processing") | 🔍 | Sila adapter maps `statusLabel` (Arabic). Check OMS list "last carrier status" column and order timeline for a Sila order. | |
| A3/A7 | Sena integrated | ✅ | Sandbox E2E 3 Nov (OUT-2026-04463). Remaining: cancel, return, label, failed delivery (F17). | 3 Nov |
| A4 | Sila guidance implemented (area_id leaf, COD incl. shipping, reference check before resend, cancel path, show Sila error + request_id) | 🔍 | Read `backend/src/modules/shipping/providers/sila-sy/`; confirm each of the 9 points in code and in one live test after approval. | |
| A5 | Simple scanning to receive/handle orders (like Babel video) | 🔍 | OMS list QR scanner accumulates many orders (built). Confirm it fits the scanning flow the client showed. | |
| A8 | Financial system per the proposal | ✅ / ❓ | Built (see HANDOVER §6). Open questions 3, 4 and B15 decisions remain configurable in `/finance/policies` — owner decides defaults. | |
| B1/B8 | Client edit/cancel before EMDAD confirmation; admin cancel visible | 🔍 | Client portal: edit and delete a draft order; after admin approval the client must be refused (UI and API, also via Sheets/Google Sheet). | |
| B2 | Delivery deadline / phases | — | Owner's call (communication, not code). | |
| B3 | Link inbound order to OMS order | ❓ | Not built. Ask the owner what "linked" means (inbound created from an OMS return? purchase for an OMS order?) before building. | |
| B4 | Filters (store name + date range) and Excel export on all sections: COD, inventory, inbound, products, outbound, OMS, finance | ⬜ partly | Excel/CSV exist on main lists. Audit every list for store filter + date range + CSV + branded Excel; fill the gaps. | |
| B5 | Add storage locations in a newly created warehouse | 🔍 | Create warehouse → add zone/rack/shelf/bin → receive into it. Fix if it fails. | |
| B6 | Stock shown per warehouse in an order | ❓ | Answer from code (which warehouse's stock the order form shows), write the answer in DECISIONS. | |
| B9/B14 | Super admin edits everything at any stage (COD amount, qty, price, shipment details) | 🔍 / ⬜ | `PATCH /oms/orders/:id` exists. Verify scope per status, including after shipment. Carriers have no edit API: the UI must say the change is local and offer cancel + resend. Fill gaps. | |
| B10 | Raqqa orders fail | ✅ (not a defect) | Babel does not serve Raqqa/Deir ez-Zor/Hasakah/Suwayda; EMDAD keeps them and routes to other carriers or Manual. Evidence DECISIONS §1.1. | 2 Nov |
| B11 | Tolerant address matching (wrong governorate, unknown neighbourhood) | 🔍 | Client API + import: send Damascus + "جديدة الفضل"; expect a clear correction/suggestion, not a raw validation error. | |
| B12 | In-transit float, carrier reconciliation, client shield | ❓ | Owner said 2 Nov these are not agreed; must be modular settings, disabled by default. Verify what exists; build behind flags only if the owner confirms. | |
| B13 | "Ready to ship" status, carrier chosen after | ✅ | `ready_to_ship` exists; carrier chosen there. Verify in UI. | |
| B15 | COD due moment / liquidity / prep fee | ❓ | Owner decision pending with the company owner. | |
| B16/B22 | Simpler import template with instructions; tolerant import (format problems) | 🔍 | xlsx template with Instructions (AR+EN); tolerant phone/date/Arabic fold. CSV via `?format=csv`. | 6 Nov — client download `oms-orders-import-template.xlsx` (ZIP magic, 132800 B); tolerant import created OMS-2026-03727 (`+963`/`09…`/`اتارب`) |
| B17 | Picking list | ✅ | Redesigned 6 Nov (45828e197). Owner must approve the look. | |
| B18 | Company selector resets to "Acme Import" (phone) | 🔍 | Fixed on desktop (D-001). Re-test at phone width on products, inbound, outbound, stock forms. | |
| B19 | Contents column + copy buttons | ✅ | OMS list contents column; copy shipment info on order details. Verify copy of address, name, phone, order number individually. | |
| B20 | Group-by like Olivery | ✅ partly | Group by city/client/product/carrier/status on the current page. Whole-result grouping needs a server query. | |
| B21 | Delivery Joud integration | 🔍 | Adapter `DELIVERY_JOUD` wired (create/quote via areas/track/poll). Unit mappers green. First live shipment + connect credentials need owner approval. Fatih Cargo (`FATIH_CARGO`) also added from store API v2. | 7 Nov |
| B23 | Template drop-downs: all governorates + cities + areas | 🔍 | Hidden Lists/Areas sheets + named ranges; city depends on governorate; area flat list for typo guard. | 6 Nov — template endpoint returns xlsx; unit test meta 14 govs / 286+ cities / 8k areas |
