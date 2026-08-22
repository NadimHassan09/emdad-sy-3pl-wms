# 11 — Notifications and Realtime

**Confidence:** High for in-app notification inbox and socket-driven refresh patterns. Medium for which events always create a row and whether email is sent.

---

## Notifications (both portals)

### Entry

- Sidebar **Notifications**
- Topbar notifications dropdown → View all

### UI behaviors

| Control | Effect |
|---------|--------|
| Filters All / Unread / Read | Filters list |
| Mark all read | Clears unread state |
| Click notification | Often navigates to related order/invoice |
| Unread badge | Shows on nav / topbar |

### Loading / empty

- Loading indicator while fetching
- Empty inbox message when none

---

## Notification types users may see

### Admin examples

- Inbound pending approval
- Outbound pending approval
- Client product added
- SLA breach escalations
- Billing invoice generated / overdue
- Billing cycle expiring (multiple day thresholds)
- Billing account suspended / renewed

### Client examples

- Inbound / outbound confirmed
- Inbound completed / outbound shipped (completed notification)
- Billing invoice generated / overdue
- Cycle expiring
- Account suspended / renewed

**Confidence:** High these types exist in the product; Medium that every type is enabled in staging configuration.

Channels conceptually include in-app and email; creators observed primarily use **in-app**. Email delivery: **UNKNOWN / NEEDS VERIFICATION**.

---

## Realtime behavior (admin especially)

When logged in, the app maintains a live connection.

### What users can observe without refresh

- Notification badge / list updates
- Lists, dashboards, inventory, orders, tasks refreshing after other users’ changes
- User online/offline presence on Users screens
- Backup job progress
- Bulk shipping progress
- Forced logout when session is invalidated

### Client portal

Realtime is less emphasized than admin; notifications still update via polling/fetch after actions. Whether full live sync matches admin: **NEEDS VERIFICATION**.

### QA guidance

1. Perform an action as User A.
2. Observe User B’s open list/detail without refresh.
3. If UI updates within a short time → pass realtime.
4. If not → one manual refresh; if data then appears, classify as “realtime miss” not necessarily data bug.
5. Forced logout tests require an admin action that invalidates sessions — only if such a control exists in staging.

---

## Negative / edge

| Attempt | Expected |
|---------|----------|
| Mark all read with empty inbox | No error; stays empty |
| Open notification for deleted entity | Error or fallback page — **NEEDS VERIFICATION** |
| Offline network | Connection retries / degraded mode; user may see stale data until reconnect |
