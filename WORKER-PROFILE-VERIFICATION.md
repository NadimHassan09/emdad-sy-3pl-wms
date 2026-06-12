# Worker profile workflow — verification report

**Date:** 2026-06-11  
**Branch:** `staging`

## Automated checks

| Check | Command | Result |
|-------|---------|--------|
| Worker profile unit tests | `npm run test:unit -- --testPathPattern=users.worker-profile` | Pass |
| Users list regression | `npm run test:unit -- --testPathPattern=users-list` | Pass |
| Frontend production build | `cd frontend && npm run build` | Pass |

## Feature matrix

| Requirement | Implementation | Verified |
|-------------|----------------|----------|
| Link operators to worker profiles | `PUT /users/:id/worker-profile`, auto-provision on create, link orphan via `linkWorkerId` | Unit tests + API |
| User management UI | Worker profile column, detail panel, edit modal section | Manual / build |
| Cycle count onboarding | `WorkerProfileOnboardingBanner` on My tasks + Execute | Manual / build |
| Validation | Role, tenant, warehouse, roles, link conflicts | Unit tests |
| Error messaging | Cycle count 403 text, API 400/404/409 messages | Code review |

## Manual QA checklist

- [ ] Create warehouse operator with tenant selected → list shows **Linked** worker profile
- [ ] Create operator without tenant → UI blocks with tenant message
- [ ] Open operator detail → provision panel saves roles and warehouse
- [ ] Operator without profile opens **My cycle counts** → sees step-by-step banner
- [ ] Admin on same page sees **Manage warehouse users** button
- [ ] After provision, operator re-login → `/auth/me` includes `workerId` → execute page loads
- [ ] Link orphan worker (`/workers/unlinked`) to operator without existing profile

## Files touched

**Backend:** `users.service.ts`, `users.controller.ts`, `upsert-user-worker-profile.dto.ts`, `user-worker-profile.util.ts`, `workflow-workers.service.ts`, `cycle-count-execution.service.ts`, unit specs

**Frontend:** `WorkerProfilePanel.tsx`, `WorkerProfileOnboardingBanner.tsx`, `UsersPage.tsx`, `UserDetailPage.tsx`, `UserDetailsCard.tsx`, cycle count pages, `api/users.ts`, `api/workers.ts`, `lib/worker-profile.ts`
