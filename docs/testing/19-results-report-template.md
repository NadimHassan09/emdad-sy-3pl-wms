# 19 — Mandatory format of the results report (phase 3)

The owner's requirement: *a result is not "passed/failed" only — it must say why, so that a wrong assumption can be found afterwards.*

## 1. Per-test record

```
ID:            E2E-OMS-006
Title:         Edit order data before/after approval; super-admin edit after shipment
Run:           2026-11-20 14:05, build <git sha>, env staging, browser Chrome 130, device laptop, language EN, role super_admin
Result:        PASS | FAIL(D-050) | BLOCKED(reason) | N/A(reason)
Observed:      exact values/texts/screens (numbers, status chips, toast text, API status+body excerpt, SQL result)
Expected:      what the plan says
Oracle:        S/D/C/I + reference (file, chat, doc, code line)
Assumptions:   A-xx used (or "none")
Why PASS:      the specific facts that satisfy each expectation ("COD changed 20→25 on detail, list, waybill, client portal; ledger unchanged")
Why FAIL:      which expectation broke, reproduction steps, screenshot name(s), suspected cause
Evidence:      files (screenshot/trace/har/sql output) with paths
Side effects:  data created/changed + cleanup done (Y/N)
```

## 2. Per-component / per-element explanation (UX, UI and visual tests)

For every interactive element exercised, one line: `element (page, selector or label) — purpose understood as — expected behaviour — observed — verdict`. Example:

> `Button "Mark Paid" (/finance/carrier-costs row 3)` — purpose: record that EMDAD paid the carrier — expected: status Unpaid→Paid once, audit row, button disabled afterwards — observed: status changed, audit row present, button hidden — **PASS (oracle C, assumption none)**

If the executor had to interpret the purpose (no spec), the line ends with `(assumption A-xx proposed)` so the owner can correct it.

## 3. Summary tables (generated from the records)

1. **Coverage** — inventory-based % per test type (see `00` §5) with numerator/denominator, and *list of uncovered inventory items* (must be empty for release).
2. **Pass / fail / blocked / N/A** counts per type, per module, per device, per role.
3. **Defects**: id, severity, page/module, first seen test id, status, fix commit, regression test id.
4. **Assumptions register status**: each A-xx → confirmed / corrected (and which tests were re-run).
5. **Risk list**: anything not tested and why.
6. **Release verdict**: GO / NO-GO with rule "no open S1/S2, P0 all pass, P1 ≥ 98 %, no unconfirmed *blocking* assumption".

## 4. Where results are stored

`docs/testing/results/<yyyy-mm-dd>/<type>/<id>.md` (one file per test, generated from JSON) + `results/<date>/SUMMARY.md` + raw artefacts (`traces/`, `screenshots/`, `har/`, `sql/`). Screenshots of failures and of every UX/visual state go into the numbered folders in `docs/testing/screenshots/` with suffix `_<state>`.
