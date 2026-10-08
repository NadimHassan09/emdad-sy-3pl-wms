# Emdad WMS staging — agent notes

## Scope

- Mutate **staging only**: `/var/www/emdad-sy-3pl-wms-staging`
- Never deploy/restart production (`emdad-wms-backend`); use `emdad-wms-backend-staging`
- Smoke tests: staging domains / port `3001` only

## Frontend design

- Legacy apps (`frontend/`, `client-frontend/`): preserve Emdad brand and `@ds` / `shared/design-system*` unless the user asks for a redesign
- New apps (`web-v2/`): follow `web-v2/DESIGN.md` and `.cursor/rules/frontend-v2.mdc`; brand = Emdad green; **no imports from legacy code**; run `npm run check` in `web-v2/`
- Prefer installed skills: `frontend-design`, `react`, `tailwind`, `ui`, `better-design`, `shadcn`/`shadcn-ui`, `react-vite-dashboard`, `aidesigner-frontend`
- When Better Design MCP is connected: use it for UI/UX principles and review (`get-ui-principle`, `get-ux-principle`, `get-review-rules`, `check-comprehension`, `inspect-spacing`). Do **not** swap in a catalog design system without an explicit ask
- Reference libs for new UI work: shadcn/ui + Radix, TanStack Table, Recharts, lucide-react
- Playwright MCP is restricted to `staging-admin.emdadsy.com` and `staging-client.emdadsy.com`

## Skills locations

- Project: `.agents/skills/`, `.cursor/skills/`, `.claude/skills/`
- Lockfile: `skills-lock.json`
- User-level: `~/.cursor/skills/ui` (also copied into the project)
