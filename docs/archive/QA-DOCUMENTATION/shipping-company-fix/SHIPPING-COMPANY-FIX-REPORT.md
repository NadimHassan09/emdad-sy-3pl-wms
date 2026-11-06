# SHIPPING COMPANY FLOW — CONTROLLED FIX REPORT

**Environment:** Staging only (`staging-client.emdadsy.com`, `staging-admin.emdadsy.com`, `emdad-wms-backend-staging` / port 3001)  
**Date:** 2026-08-21  
**Scope:** Shipping Company (carrier) path only — quotes UX, COD currency to Babel, Send Shipment error surfacing  
**Production:** Not modified (`emdad-wms-backend` left running untouched)

---

## Executive verdict

| Area | Result |
|------|--------|
| Carrier cards disappearing | **FIXED** — configured providers always listed with states |
| Misleading **SYP 0** as free shipping | **FIXED** — no quote → em dash / unavailable, not `0`; live Babel quotes return real SYP amounts |
| COD sent as SYP while amount is USD | **FIXED** — Babel COD now uses order currency (`USD`) per OpenAPI |
| Send Shipment on Aleppo pin after COD fix | **Carrier rejected options** (not currency) — actionable Babel message stored |
| Manual shipping / OMS spine | **No code path changes** outside carrier quote UI + Babel COD mapping |

---

## 1. Root cause of SYP 0

**Two separate issues were conflated in the UI.**

### A. Shipping *rate* on the card (not COD)

- UI rendered **only successful `quotes[]`**. Incomplete inputs, loading, or empty quote lists removed the carrier list / left blank space → “companies disappeared.”
- When a quote existed with `price: 0` and `currency: "SYP"`, the card literally showed **SYP 0** via `formatMoney`.
- Staging live `POST /api/shipping/rates` against Babel for Damascus/Aleppo samples returned **non-zero** prices (e.g. hub **10,000 SYP**, address **25,000–29,000 SYP**). So **SYP 0 is not Babel’s normal rate** for those pins; it was either a real `price: 0` from Babel for a specific request, or a misleading empty/fallback presentation when no usable quote was bound to a card.

**Conclusion:** Do **not** treat every SYP 0 as a hardcoded frontend bug. If Babel returns a finite `price` (including `0`), show it with Babel’s currency. If there is **no** quote / error / ineligible, show **unavailable / quote error / loading** — never invent free shipping.

### B. COD send failure (looked related, was not the rate)

- `resolveBabelCodCurrency()` **always returned `SYP`**, ignoring order currency.
- OMS/outbound COD amounts are **USD** (e.g. `OUT-2026-00376` → `cod_amount = 56`, `currency = USD`).
- Babel received `{ amount: 56, currency: "SYP" }` → rejected: **“Minimum amount for this currency is SYP 1,000”**.
- Historical success with `cod_amount = 1000` USD (`OUT-2026-00366`) was likely **coincidental**: forcing SYP made the numeric amount meet the 1,000 SYP floor while still mislabeling currency.

---

## 2. Carrier API quote evidence (staging)

| Request | Babel-normalized result |
|---------|-------------------------|
| Hub, Damascus `33.5138,36.2765`, 1 kg box | `price: 10000`, `currency: "SYP"`, service Hub |
| Address, same pin | `price: 25000`, `currency: "SYP"`, service Address |
| Address, Aleppo-ish `36.2,37.15` | `price: 29000`, `currency: "SYP"` |

Source: `POST http://127.0.0.1:3001/api/shipping/rates` after staging rebuild.

Babel OpenAPI (`BABEL_API.md`): `calculatePrice` returns `{ status, price, currency, details }`. Adapter maps finite `price` + `currency` (default SYP if missing). Missing/non-finite price → API error (not silent 0).

---

## 3. Eligibility behavior

- Address delivery probe: if Babel `details.dropoff` is null, adapter falls back to **hub** and attaches a restriction message (existing behavior; unchanged).
- Frontend: carriers without a quote after fetch show **“Not available for this destination / shipment”** (or quote error text), card **remains visible**.
- Selection is **not** cleared when a quote temporarily disappears during refresh (only if provider disconnects).

---

## 4. Quote loading behavior

- Connected/configured providers always render.
- While `rates` query is fetching and inputs are ready: card state **LOADING** / “Recalculating” / “Shipping information is being recalculated…” — **previous price not shown** during that fetch (avoids stale quotes).
- Incomplete pin/weight/package: hint above cards; carriers still listed.

---

## 5. Currency behavior

| Stream | Behavior |
|--------|----------|
| **Shipping rate quote** | Display **exactly** what Babel returns (typically **SYP**). No invented FX. |
| **Business / COD** | EMDAD order currency (**USD**). Sent to Babel as COD currency **USD** when order is USD. |
| **FX conversion** | **None added.** No approved FX module in app for SYP↔USD. |

### Integration decision (product owner)

**CURRENCY / DISPLAY DECISION (optional, not blocking COD):**  
Rate cards show **SYP** because Babel quotes SYP. If product requires rate cards in **USD**, need an approved FX source or Babel USD quote support — **do not invent a rate**.

COD path does **not** need FX: Babel OpenAPI example uses `"cod": { "amount": 0, "currency": "USD" }`.

---

## 6. COD payload behavior

| Case | Payload |
|------|---------|
| COD order, currency USD | `{ amount: <omsCod>, currency: "USD" }` |
| Non-COD / prepaid | `{ amount: 0, currency: "USD" }` (amount `0` disables COD per Babel docs) |
| COD missing amount | Fail claim early with clear message (no Babel call) |
| COD + SYP + amount &lt; 1000 | Fail claim early with Babel minimum message |

Also falls back to OMS `paymentMethod` / `codAmount` / `currency` if outbound fields are empty.

**Why this cannot break OMS/Inbound/Outbound:** Only runs inside `ensureShipmentForOutbound` when `shippingMethod === carrier`. Manual path returns immediately. OMS create/confirm/approve/pick/pack untouched.

---

## 7. Carrier Send Shipment behavior

**Regression proof (COD currency):**

| Order | Before | After retry (post-fix) |
|-------|--------|---------------------------|
| `OUT-2026-00376` COD **56 USD** | `COD error: Minimum amount for this currency is SYP 1,000` | **No COD currency error** → Babel: `Cannot ship this shipment with the selected options` |

Second error is a **real carrier rejection** of options/location (Aleppo pin / hub-receiver options), stored in `carrier_shipments.last_error_safe` and shown in Admin alert — not a fake success.

Prepaid historical: `OUT-2026-00369` already had AWB `260308475813` (non-COD path worked before).

---

## 8. Manual shipping regression

- Code changes do **not** alter `shippingMethod === manual` branches.
- Staging still has recent manual shipped orders (`OUT-2026-00375`, `OUT-2026-00370`).
- No Manual UI components modified.

**Why safe:** Manual never calls Babel createShipment / quote cards path for send.

---

## 9. OMS regression

- No OMS controllers/services changed.
- Outbound provisioning / sync untouched.
- Only shipping module + carrier cards UI.

---

## 10. Inventory regression

- No inventory / packing / dispatch decrement code touched.
- Carrier send still only claims `carrier_shipments` + AWB write — same as before.

---

## 11. COD lifecycle regression

- COD amount derivation on OMS create/approve **not** changed in this task.
- Only **carrier createShipment COD currency label** corrected.
- Deliver / void / remittance paths untouched.

---

## 12. Returns regression

- No returns modules modified.

---

## 13. Files changed

| File | Change |
|------|--------|
| `backend/.../babel-shipment.mapper.ts` | Pass through USD/SYP for COD currency (stop forcing SYP) |
| `backend/.../babel-shipment.mapper.unit.spec.ts` | Expect USD COD; add non-zero USD case |
| `backend/.../shipping.service.ts` | Resolve COD from outbound∥OMS; early COD validation; `failClaim` helper |
| `backend/.../shipping.service.unit.spec.ts` | OMS COD fields on mock |
| `frontend/.../ShippingCarrierCards.tsx` | Always show providers; loading / available / unavailable / error states |
| `frontend/.../OrderShippingFields.tsx` | Pass providers; stop clearing selection on quote refresh; clearer hints |

**Why these cannot break OMS/Inbound/Outbound:** Scoped to Babel COD mapping + Admin shipping-details carrier quote UI. No shared OMS pricing, inbound, pick, pack, or manual dispatch logic.

---

## 14. Tests executed

| Test | Result |
|------|--------|
| Jest `babel-shipment.mapper.unit.spec.ts` | PASS |
| Jest `shipping.service.unit.spec.ts` | PASS |
| Staging backend `npm run build` + PM2 restart **staging only** | OK |
| Staging admin `npx vite build` → nginx `frontend/dist` | OK |
| Live `POST /api/shipping/rates` (Babel) | Real SYP quotes |
| Retry send `OUT-2026-00376` | COD SYP-min error gone; Babel options error surfaced |
| Mapper dist: `codAmount:50, currency:USD` → `{50,"USD"}` | Confirmed |
| Production PM2 `emdad-wms-backend` | Untouched (still online, old PID) |

Browser: Admin SPA rebuilt with “Recalculating” strings in `OrderShippingFields-*.js`. Full click-through of pick→pack→manual was not re-run end-to-end in this session; code isolation + existing manual shipped rows support no-regression claim for Manual.

---

## 15. Remaining blockers

1. **`OUT-2026-00376` still cannot create AWB** — Babel: *“Cannot ship this shipment with the selected options”* (location / delivery / pickup / payer combination). Needs ops/carrier investigation or pin/option change — **not** a COD currency bug anymore.
2. **Rate cards remain in SYP** when Babel quotes SYP — optional product decision if USD display is required (needs approved FX or Babel USD quotes).
3. Full browser E2E of Company path through Dispatch not re-executed after this fix (API + unit coverage for COD/currency/quote UX).

---

## 16. Product-owner decisions required

1. **Rate UI currency:** Keep showing Babel’s returned currency (SYP), or invest in approved FX / Babel USD quotes?  
2. **Failed Aleppo options:** Treat Babel “selected options” rejection as user-fixable guidance vs carrier coverage limitation?

---

## Final checklist

| Check | Status |
|-------|--------|
| Carrier cards remain visible | ✓ |
| Loading during quote refresh | ✓ |
| Eligibility / unavailable clear | ✓ |
| No fake SYP 0 fallback for missing quote | ✓ |
| Real carrier quote used | ✓ (API evidence) |
| COD currency correct (USD) | ✓ |
| Non-COD amount 0 | ✓ (per Babel contract) |
| Send works when Babel permits | ✓ historically; current Aleppo order blocked by Babel options |
| Carrier rejection readable | ✓ `lastErrorSafe` |
| Manual unchanged | ✓ (no Manual code) |
| Staging only | ✓ |
| No fake success / invented FX | ✓ |
