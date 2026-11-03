# EMDAD — Client Requests, Findings & Decisions Log

Living document. Each entry records what the client asked (from the WhatsApp text export, 1 Sep – 2 Nov 2026), what was found, the decision taken, and the evidence. Voice messages and calls are **not** covered (not available in the export).
Environment for all checks: **staging only** (`wms_db_staging`, PM2 `emdad-wms-backend-staging`).

---

## 1. Findings with evidence

### 1.1 "Raqqa / Deir ez-Zor / Hasakah / Suwayda orders do not go through" — NOT an EMDAD defect

- **Client claim (29 Oct):** orders linked from a Google Sheet that contain Raqqa (الرقة) do not go through; later the client assumed these governorates exist at Babel and the system fails them.
- **Finding:** Babel Express does not serve these four governorates at all.
- **Evidence (2 Nov 2026, staging):**
  - Babel `getCities` returns 10 governorates only: Damascus, Aleppo, Rif Dimashq, Homs, Hama, Latakia, Idlib, Tartus, Daraa, Quneitra (catalogue synced into `babel_cities/areas/neighbourhoods`: 10 cities, 218 areas, 5,421 neighbourhoods).
  - Babel `findNeighbourhoodByCoordinates` for the centre of Raqqa, Deir ez-Zor, Hasakah and Suwayda returns `not found a close neighbourhood to the provided coordinates`. Control points (Aleppo, Damascus) resolve normally.
  - Babel admin portal ("تكوين شحنة" → المحافظة dropdown, opened read-only, nothing filled or submitted) lists exactly the same 10 governorates, so API and portal agree.
- **Decision (project owner):** EMDAD keeps all 14 governorates; EMDAD's hierarchy intentionally covers more than any single carrier. Locations are **not** removed to match a carrier. Orders for uncovered areas go to another integrated carrier or to **Manual Shipping**.
- **Correction of earlier internal audit:** the audit claimed Babel lacks Latakia, Tartus, Suwayda, Daraa and Quneitra. Only Suwayda is actually missing; the missing set is Raqqa, Deir ez-Zor, Hasakah, Suwayda. `BABEL_CITY_PRIMARY_DISTRICT` is only a tie-breaker for coordinate matching, not a coverage list.
- **Still to check:** coverage of Sila SY, Sena Express and Delivery Joud for these four governorates; (Babel's list was confirmed in the Babel portal.)

### 1.2 Carrier choice happens at "Ready to ship", not at order creation

- Clients enter only the recipient address; they do not know carriers exist. Staff pick the carrier when the order is `ready_to_ship` (confirmed in the OMS "New online order" form: no carrier field).
- Single-order shipping (`CarrierShippingDetailsForm` → `ShippingCarrierCards`) is quote-driven: a carrier is selectable only if it returned a quote.
- **Gap found and fixed:** the Bulk Shipping Processing review table (`BulkShippingProcessingModal.tsx`) listed every connected carrier in each order's dropdown, even a carrier that returned no quote for that address. A carrier with no quote for the order is now disabled with "— not available for this address" (Manual stays available). Status: implemented, type-checked, built on staging; **not yet verified in the UI with a real uncovered-address order**.

### 1.3 Company selector reverting to "Acme Imports"

- Root cause: the same "select the first company when the field is empty" effect existed in three admin pages (Products create modal, Inbound create, Outbound create).
- Fix: pre-select only when unambiguous (configured default or a single client). Commit `fe1cfc87` on `staging`. Verified on staging (Products → New product: Client field stays empty). Not verified on a phone/touch device.

### 1.4 Location data hygiene in EMDAD hierarchy (open)

- Hierarchy (`syria-address-hierarchy.json`): one city key with an embedded CRLF (`قدسيا\r\n`, Rif Dimashq) and 13 neighbourhoods with trailing spaces (e.g. Homs / القصير). These produce "unknown city/area" mismatches. Fix pending approval (the file exists in five copies).

### 1.5 Babel catalogue vs EMDAD hierarchy (10 shared governorates)

- City/area names match almost one-to-one; EMDAD adds `مركز X` entries and has more neighbourhoods than Babel (e.g. Aleppo 2,185 vs 1,856; Homs 791 vs 604; Hama 813 vs 692; Damascus 225 vs 101). For neighbourhoods Babel does not know, the system falls back to coordinates.

### 1.6 Policies are already configurable

- Finance policy keys (`cutover_active`, `cod_eligibility`, `cod_holding_days`, `shipping_fee_timing`, `minimum_payout_amount`) exist with API and admin page `finance/policies`. `cod_eligibility` covers the client's question "when does COD become due to the client" (`on_delivered`, `on_collection`, `on_remittance`). Features not yet agreed with the client (carrier reconciliation, in-transit float, client edit before confirmation) will be built behind admin-controlled flags, disabled by default.

### 1.8 Carrier environments and published constraints (3 Nov 2026)

**Sena Express — sandbox confirmed (safe for full E2E).** Sena portal → API settings has two tabs, *Live* and *Sandbox*. Live has no API key. Sandbox has an active `sena_test_…` key (last used 2026-11-03 03:20 by staging); the key prefix selects the environment on the same base URL (`syria.sena-express.com/api/v1/merchant`). Sandbox shipments are separate from real pickup/delivery/collection/settlement. Sandbox provides `POST /sandbox/shipments/{number}/status` to simulate statuses and a webhook delivery log (events from staging already acknowledged with HTTP 200: `order_delivered`, `order_out_for_delivery`, `pre_dispatch_carrier_failure_unlocked`, plus several stale `unmatched_awb`). Rate limit: 50 requests / 60 s per store, shared by Live and Sandbox. Create requires `reference` (duplicate-safe) and `delivery_zone_id` from `GET /zones`.

**Sila SY — public courier catalogue (https://sila-sy.com/couriers).** Six couriers are reachable through Sila; limits that the system must respect before offering a courier:

| Courier | Delivery | Currencies | COD fee | Return fee | Other |
|---|---|---|---|---|---|
| BABEL | home / branch pickup | SYP, USD | 1% of COD | 150% of delivery fee | per-parcel pricing |
| DELIVEROO JOUD | home | SYP, USD | — | 100% of delivery fee | price per zone |
| TARABUT | home | USD, SYP | 1% of COD | 100% of delivery fee | USD pricing |
| Fatih Cargo | home / branch pickup | USD, SYP | — | 1.5 USD per shipment | per-parcel pricing |
| Karam | via branches (119) | SYP, USD | 2% of COD | free | **max 10 kg per shipment** |
| Mersal | home | **USD only** | — | free | price per zone |

All: target delivery 72 h, up to 3 attempts, proof-of-delivery photo. A courier with no price tier covering the parcel weight returns no price. Delivery Joud is therefore also reachable as a Sila courier, in addition to its own API/portal.
*Not yet visible:* Sila merchant portal (not logged in on this browser); per-courier minimum COD values; per-zone coverage.

### 1.7 Test-suite baseline (incomplete)

- Backend Jest run aborted with out-of-memory after 23 of 144 suites; of those, 14 passed and 9 failed (stale specs or drifted code, e.g. CSV template spec expecting `external_reference`). Full baseline still to be produced in batches.

---

## 2. Client requests (text only) and status

Status values: **Verified** / **Implemented, not verified** / **Open** / **Not a defect** / **Needs decision**.

| Date | Request (client) | Status | Notes |
|---|---|---|---|
| 6 Oct | Waybill printing, Excel import and Babel link "broken" | Open | Re-verify each in UI |
| 9 Oct | Sila: show carrier tracking statuses like Babel, not only main statuses | Open | Migration exists; persistence/display to verify |
| 10 Oct | Add Sena Express | Implemented, not verified | Adapter exists; sandbox available |
| 10 Oct | Sila integration guide (9 points: courier code via GET/webhook, cancel path, COD amount incl. shipping, USD for TARABUT, `area_id`, duplicate-reference check, do not test on live account) | Open | Adapter appears to cover several points; needs point-by-point check |
| 20 Oct | Cancel/edit button disabled in admin before approval | Open | Admin cancel allowed in most statuses; needs repro |
| 20 Oct | Link inbound to OMS order | Implemented, not verified | `InboundSourceAllocation` model |
| 20 Oct | Filters + Excel export for all sections (COD, inventory, inbound, product) by store and date | Implemented, not verified | Reported across 17 pages |
| 20 Oct | New warehouse: cannot add storage locations; per-warehouse stock visibility question | Open | Needs repro |
| 25 Oct | Client edit/cancel before confirmation; super admin edits COD/quantity | Needs decision | Client cancel already allowed in two pre-approval statuses; will be policy-controlled |
| 29 Oct | Raqqa orders from Google Sheet fail | **Not a defect** | See 1.1 |
| 29 Oct | Address validation errors (`address neighborhood`, `Unknown city/area`) | Open | Owner reports fixed on staging; verify, incl. 1.4 |
| 31 Oct | Carrier reconciliation module and in-transit float indicator | Needs decision | Build behind disabled-by-default flags |
| 31 Oct | Set carrier after "ready to ship"; edit price/quantity/details at any stage | Needs decision | Shipping config locks at `ready_to_ship` today |
| 1 Nov | COD due trigger, liquidity gap, preparation fee | Needs decision | COD trigger configurable (1.6) |
| 2 Nov | Excel import simpler, template instructions, drop-downs for governorates/areas | Open | Parser is strict (country code, date) |
| 2 Nov | Picking list solved? | Open | Batch PDF exists; single WMS order slip absent |
| 2 Nov | Company name reverts to Acme on mobile | Implemented, not verified on mobile | See 1.3 |
| 2 Nov | Shipment contents column and copy buttons in OMS list | Open | |
| 2 Nov | Filters and group-by (Olivery ideas) | Open | |
| 2 Nov | Delivery Joud integration | Open | No adapter yet; no sandbox confirmed |

---

## 3. Operating rules agreed for testing

- Test orders only under the "Test company" client, recipient **Nadim Hassan**, notes "TEST ORDER".
- No real carrier shipments, cancellations or edits without explicit per-order approval. Only Sena offers a sandbox; Babel, Sila (and probably Delivery Joud) are live accounts with real orders.
- Production is never touched.
