# Port log (logic copied from the classic apps; UI rebuilt)

Logic is **copied**, never imported. Source → destination (both under the repo root).

| Area | Classic source | V2 destination |
|---|---|---|
| API client, refresh interceptor | `frontend|client-frontend/src/{api,services}/apiClient*` | `apps/{admin,client}/src/{api,services}` |
| Auth, RBAC, storage | `…/auth`, `…/lib/rbac*` | `apps/*/src/auth`, `lib/rbac.ts` |
| Realtime (Socket.IO, module sync) | `…/realtime` | `apps/*/src/realtime` (route sync uses the data-router subscription) |
| Filters / chunked pagination / list cache | `shared/design-system-next/hooks`, `…/hooks` | `apps/*/src/hooks/base` |
| Update detector (`/version.json`) | `…/hooks/useUpdateDetector` | `apps/*/src/hooks`, `layout/AppUpdateDialog.tsx` |
| OMS status/stage decision tree | admin OMS components | `apps/admin/src/features/oms/oms-ui.tsx` |
| OMS commercial status labels | `client-frontend/src/lib/client-oms-commercial-status.ts` | `apps/client/src/lib/` (+ `oms-tone.ts`) |
| Carrier logos | `frontend/public/carrier-logos` | `apps/admin/public/carrier-logos` |
| Route table | `App.tsx` | `routes.manifest.json` (+ frozen `docs/legacy-routes.snapshot.json`) |
