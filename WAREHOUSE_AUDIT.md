# Warehouse Audit — Floor Speed

**Role:** Experienced warehouse operator  
**Lens:** Speed only — clicks, scans, repetition, missing shortcuts  
**Scope:** Receiving · Putaway · Picking · Packing · Inventory · Transfers · Cycle Count · Task Management  
**Baseline:** Staging Admin WMS (`HEAD`)  
**Not in scope:** Visual design, branding, “pretty UI”

---

## Bottom line

Floor work is slowed by the same tax on every job: **find the task → Assign → Start**, then **type or menu per line**, with **barcode that opens a camera modal** instead of driving the gun. Confirm on the order does not put you on the work screen. Packing and dispatch add modal mazes on top.

---

## Shared killers (hit every task)

| Slowdown | What happens | Cost |
|----------|----------------|------|
| **Confirm ≠ work** | After Confirm, you stay on the order. Hunt timeline “Open task” or Tasks list. | +1–3 clicks every order |
| **Assign then Start** | Combobox worker → **Assign** → **Start**. Panel only appears when `in_progress`. | +3–4 clicks **per stage** |
| **Chain tax** | Receive → (QC) → Putaway → Pick → Pack → Delivery: Assign+Start again each time. | Inbound ~8 gate clicks; outbound pick→pack→dispatch ~12 before line work |
| **Apply filters** | Typed search/status sit in draft until **Apply**. | +1 every filter change |
| **Camera scan modal** | “Scan” opens camera UI, not a always-focused wedge field. Gun users leave the gun flow. | +2–3 vs scan-and-go |
| **Save progress** | Sticky **Save** beside **Complete** — extra click if treated as required; pick path also patches before submit. | +0–1 + wait |

---

## 1. Receiving

### Unnecessary clicks
- Dock picker + Confirm before any qty work.
- Task hunt after Confirm.
- Assign → Start.
- **Receive expected qty** buried in per-line ⋮ (open menu → choose) instead of one tap on the line.
- **Validate specs** = ⋮ → modal → Confirm (per new SKU).
- Line filters: type → Apply (scan path auto-applies; typing does not).

### Repetitive actions
- Enter received / damaged / missing **per line** by hand.
- Expiry date **per line** when required.
- Notes via `window.prompt` in the menu when needed.
- Re-Assign/Start if you bounce to the next task after complete.

### Missing shortcuts
- No **scan SKU → land on line → confirm qty** (scan matching exists in utils; panel uses scan mainly for filters).
- No **Enter** = confirm line and jump to next (Enter risks form Complete).
- No **bulk receive expected** for clean ASN.
- No one-tap “receive expected” on the qty cell.
- No keyboard-only path for a full dock without mouse menus.

### Speed cost (rough)
Gate **~6–10** + **~2× lines** if using ⋮ for expected qty (or typing every qty).

---

## 2. Putaway

### Unnecessary clicks
- Assign → Start again after receiving (and often after QC).
- Per line: open destination combobox → type (≥2 chars) → select.
- Per-row scan icon → camera modal for destination.
- Filters Apply; Save → Complete.

### Repetitive actions
- Destination search+select **every line** (no remembered last bin / zone default beyond what you retype).
- Qty re-check/type per row; Split is a mouse action.
- Same Assign/Start ritual for quarantine putaway (not even on Tasks sub-nav — extra hunting).

### Missing shortcuts
- No **suggested bin one-tap**.
- No always-on gun field: scan dest → commit → next line.
- No scan-to-advance queue.
- Source verify is not a clean gun step in the UI (`sourceVerified` stays false while dest gets verified) — no fast “confirm from staging” scan.

### Speed cost (rough)
Assign+Start **~4** + **~3–5× lines** for dest+qty.

---

## 3. Picking

### Unnecessary clicks
- Confirm & start workflow → still not on pick task.
- Assign → Start (reservations appear only after Start — dead time before you can pick).
- Type **picked** qty on every line.
- Drop-off: combobox **or** barcode + **Apply** **or** camera scan — mandatory before Complete.
- Filter Apply to find a SKU mid-pick.

### Repetitive actions
- Qty typing for every line with no “pick required” one-shot.
- Scan product/location only **filters** the list — still find the row and type qty.
- Next-stage Assign+Start for pack/delivery.

### Missing shortcuts
- **Next bin** banner is display-only — no scan-to-confirm that bin/SKU.
- No scan-increment / scan-complete line.
- No Enter → next line.
- No “pick all remaining on this bin” for single-SKU bins.

### Speed cost (rough)
Gate **~4** + **~1–2× lines** qty + drop-off **~2–3**.

---

## 4. Packing (+ delivery/dispatch)

### Unnecessary clicks
- Assign → Start.
- Open package **modal** to do real work.
- Per product: filter/scan → set qty → **Add** (scan does not add).
- **Finalize package** then **Complete packing** (two finishes).
- Finalize can spawn another empty package → dismiss/close before Complete.
- Print via ⋮ or modal button (extra open).
- Next task **Delivery**: Assign → Start again.
- Dispatch: **Add** opens another modal; scan fills field but still click Add; **Verify** checkbox after already adding; carrier/tracking fields; print HTML popup.

### Repetitive actions
- Modal open/close per package.
- Add line-by-line with qty+button.
- Dims/weight typing when used (four fields).
- Verify every dispatch line/package after add.

### Missing shortcuts
- No scan-SKU → auto-add 1 (or expected) to open package.
- No gun-driven pack without modal.
- No single “finalize & complete” when one carton.
- No scan-and-commit on dispatch (scan should load the shipment).
- Sub-nav says **Delivery** while work is **dispatch** — slows finding the queue.

### Speed cost (rough)
One carton, M lines: **~6 + 3M** pack; dispatch gate+add+verify **~10–15+** more.

---

## 5. Inventory

### Unnecessary clicks
- Every typed lookup: **Apply filters** (SKU/name/client/dates).
- Change “Search by” + type → still Apply.
- Stock list → row click → product detail (no bin action on the list).
- Detail has **no** adjust / transfer / count from a lot row → back out and start another workflow.
- Ledger: Apply + row → entry detail → maybe another reference hop.
- Adjustments: Apply filters; New = **Step 1 → Next → Step 2** before first qty; confirm returns to list (restart for next adjust).

### Repetitive actions
- Adjustment lines: search by → type → pick product → location → lot → qty → **Add line** — full loop per SKU.
- Scan only fills search text — **does not select the product**.
- Pasting UUIDs into filters + Apply for “find this adjustment.”

### Missing shortcuts
- No always-on gun listen on stock page (camera modal instead).
- No scan bin → see contents / jump to bin.
- No “adjust this lot” from product detail.
- No Enter-to-Apply on filter panels.
- Keyboard path slower than scan path (scan auto-applies; typing does not).

---

## 6. Transfers (internal)

### Unnecessary clicks
- **Create Internal Transfer** modal; one move per open — reopen and refill for the next move.
- Long sequence: client → search → product → lot → source type → dest type → source → dest (blocked until source) → qty → Create.
- History shows truncated location IDs — click Ref → ledger to see real bins.

### Repetitive actions
- Full form reset every consecutive move.
- Scan fills product search only — still combobox-select product.
- Source then dest order forced every time.

### Missing shortcuts
- No scan **source bin** / **dest bin**.
- No scan product → qty → Enter to post.
- No transfer **task** / queue for operators (managers use a modal page; no `internal_transfer` under Tasks).
- Closest floor analogue is putaway — wrong tool for bin-to-bin moves, same Apply/modal scan friction.

---

## 7. Cycle Count

### Unnecessary clicks
- List filters → Apply.
- Manager path: list → **Detail** (shows expected — slows “just count”) → **Execute**.
- Execute: Scan button → camera modal → select product → type qty → **Save count** (button only).
- Finish → **ConfirmModal** → lands on Detail (leave execute).
- Variance: Approve/Reject → ConfirmModal + reason **per line**.
- Reconciliation: **Build** then **Post** as two actions.

### Repetitive actions
- Save count click every line (no Enter-to-save).
- Notes field in the count path adds tabbing.
- Product switching via list tap instead of scan-only queue.

### Missing shortcuts
- No scan → qty → Enter → next line loop.
- No continuous gun mode.
- My Tasks has no search when many sessions assigned — scroll only.
- No skip-expected blind count mode from the execute entry (detail already leaked expected on the other path).

---

## 8. Task Management

### Unnecessary clicks
- Type/status/search → **Apply** (no Enter submit on FilterPanel).
- List → detail before any work.
- Assign → Start even when you are the only worker.
- After complete: choose Next / Back to order / All tasks — easy to leave the queue and re-hunt.

### Repetitive actions
- Same Assign+Start on every task type.
- Re-filter Tasks list between Receive / Putaway / Pick / Pack / Delivery.
- Resolve blocked: dropdown + note ≥4 chars + Apply (manager) — no fast floor “Block” control in the same view.

### Missing shortcuts
- Search claims order/task/worker id but only sends `referenceId` — **pasting task UUID fails** (dead lookup, wasted time).
- Reference column is truncated UUID — cannot eyeball the order number; must open the row.
- No “my next runnable task” one-tap queue (always list + filter + open).
- No Start-and-go for self-assigned operators (skip Assign click).
- No keyboard: j/k next task, Enter start, Esc back.

---

## Click tax scoreboard (operator view)

| Workflow | Biggest time thieves |
|----------|----------------------|
| **Receiving** | Confirm handoff; Assign+Start; ⋮ for expected qty; no scan-to-receive |
| **Putaway** | Assign+Start; dest search every line; camera scan; no suggested bin |
| **Picking** | Assign+Start; type every qty; drop-off ritual; scan only filters |
| **Packing** | Modal pack; Add not scan-commit; finalize then complete; then Delivery Assign+Start |
| **Inventory** | Apply tax; no actions from detail; scan ≠ select on adjustments |
| **Transfers** | Modal marathon; no bin scan; one transfer per open; no task queue |
| **Cycle count** | Camera→qty→Save button; confirm on finish; detail hop / expected leak |
| **Tasks** | Apply; UUID search lie; Assign+Start; truncated refs |

---

## Missing shortcuts operators expect (checklist)

These are **absent** today and force slower paths:

1. Confirm order → **land on first task already Startable** (or auto-started for self).  
2. **One-click Start** when worker is me / already assigned.  
3. Gun: **scan → action** (receive +1 / pick +1 / add to pack / set dest) without camera modal.  
4. **Enter** confirms line and advances.  
5. Receiving: **Receive expected** on the line (and bulk).  
6. Putaway: **suggested bin** tap.  
7. Pick: **scan bin/SKU confirms** Next bin; pick-required one-shot.  
8. Pack/Dispatch: **scan commits**; single finish when one package.  
9. Filters: **Enter applies**; typed search as fast as scan.  
10. Tasks: search by **order number** and **task id**; show order # not UUID stub.  
11. Transfers: scan from/to bin; rapid consecutive moves without full modal reset.  
12. Cycle count: scan → qty → Enter → next; finish without bouncing to detail.

---

## Worst offenders (fix time)

1. **Assign + Start on every stage** of a multi-step order.  
2. **Confirm does not open work.**  
3. **Camera modal instead of wedge/gun field.**  
4. **Per-line menus and modals** (receive expected, pack add, dispatch add).  
5. **Apply filters** everywhere typed input exists.  
6. **Task list identity** (truncated UUID + broken task-id search).  
7. **Pack finalize + complete + Delivery restart.**  
8. **Internal transfer modal** unfit for rapid bin moves.

---

*End of warehouse speed audit. Findings only — no implementation plan.*
