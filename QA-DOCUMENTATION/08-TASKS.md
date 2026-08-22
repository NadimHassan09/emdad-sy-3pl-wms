# 08 — Tasks and Cycle Count

**Confidence:** High for task types/statuses and outbound stage linkage. Medium for every execute-screen control and cycle-count creation entry.

---

## Warehouse tasks

### Purpose

Operational work units that move inbound/outbound (and related) processes forward.

### Entry

Admin → **Tasks** (`/tasks`). Operators land here after login.

### Task type filters / tabs

Receiving · Quality check · Putaway · Quarantine putaway · Pick · Pack · Shipping details · Dispatch · (plus general Tasks)

Internal transfer is a separate page for managers.

### Task statuses

| Status | Meaning |
|--------|---------|
| Pending | Not started |
| Assigned | Assigned to worker |
| In progress | Actively worked |
| Completed | Done |
| Blocked | Cannot proceed |
| Retry pending | Needs retry |
| Cancelled | Cancelled |
| Failed | Failed |

### Pages

| Path | Purpose |
|------|---------|
| `/tasks` | List / filter |
| `/tasks/:id` | Detail |
| `/tasks/:id/execute` | Execution UI (scan, qty, complete) |

### User actions (execute)

Typical patterns:

1. Open task → Execute.
2. Scan / enter quantities for lines.
3. Complete task or mark lines short/damaged as UI allows.
4. Parent order status advances when stage completes.

### Documents from tasks

- **Export PDF** on some execute screens (may be hidden for pure worker accounts)
- **Print documents** on dispatch
- **Print label** on pack package modal

### Line-level statuses (examples)

- Receiving: pending / partial / complete / shortage / overage / damaged
- Pick / putaway: pending / scanning / ready / complete / short
- Pack: similar progress states

### Failure cases

- Completing with invalid qty → validation errors (over-receive, pack > pick, etc.)
- Working a cancelled task → blocked
- Lease / concurrency: another user may hold the task — **NEEDS VERIFICATION** exact message

### Realtime

Task lists and dashboards may refresh when other users complete work (`system.version` sync). Prefer observing list updates without manual refresh; if stuck, refresh once and note whether live update failed.

---

## Internal transfer

### Entry

`/internal` — **super_admin** and **wh_manager** only.

### Purpose

Move stock between locations inside the warehouse.

Exact form fields: verify on screen (**Confidence:** Medium).

---

## Cycle count

### Purpose

Physical count sessions to compare system vs counted quantities; managers review variances.

### Entry

- `/cycle-count` — sessions & product schedule pills
- `/cycle-count/my-tasks` — only if user has linked worker profile
- `/cycle-count/:id` — detail / approve-reject variance
- `/cycle-count/:id/execute` — blind count execution

### Session statuses

scheduled · in_progress · pending_review · completed · cancelled

### Line statuses

pending · counted · skipped

### Variance review

pending_review · approved · rejected · posted

### Actor flow

1. Manager schedules / opens session (**creation CTA:** UNKNOWN / NEEDS VERIFICATION from list chrome).
2. Worker opens My tasks / execute and enters counts.
3. Session moves to pending review.
4. Manager approves or rejects variances.
5. Approved variances post inventory corrections.

### Permissions

- Admin stages: manager / super admin
- Execution: operators with worker link (and admin group roles allowed by backend)

---

## Relation to outbound/inbound

| Parent stage | Typical task types |
|--------------|--------------------|
| Inbound in progress | Receiving, QC, Putaway |
| Outbound picking | Pick |
| Outbound packing | Pack |
| Waiting shipping details | Shipping details |
| Ready to ship | Dispatch |

Completing the wrong task type out of sequence should be prevented by status gates.
