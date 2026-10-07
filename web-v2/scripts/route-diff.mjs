// Compares each app's route manifest against the FROZEN snapshot of the classic route table.
// Never reads legacy source. Every classic path must exist in the manifest with the same redirect target.
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { ROOT, read, report } from './_lib.mjs'

const snap = JSON.parse(read(join(ROOT, 'docs/legacy-routes.snapshot.json')))
const problems = []
const summary = []
for (const app of ['admin', 'client']) {
  const mf = join(ROOT, `apps/${app}/src/routes.manifest.json`)
  if (!existsSync(mf)) { problems.push(`${app}: routes.manifest.json missing`); continue }
  const manifest = JSON.parse(read(mf)).routes
  const byPath = new Map(manifest.map((r) => [r.path, r]))
  const counts = { native: 0, redirect: 0, notMigrated: 0 }
  for (const old of snap[app]) {
    const m = byPath.get(old.path)
    if (!m) { problems.push(`${app}: route ${old.path} missing in V2 manifest`); continue }
    counts[m.status] = (counts[m.status] ?? 0) + 1
    if (old.redirectTo && old.redirectTo !== '(role home)' && m.status === 'redirect' && m.redirectTo !== old.redirectTo)
      problems.push(`${app}: ${old.path} redirects to ${m.redirectTo}, classic redirects to ${old.redirectTo}`)
  }
  const known = new Set(snap[app].map((r) => r.path))
  for (const m of manifest) if (!known.has(m.path)) problems.push(`${app}: manifest has ${m.path} that does not exist in the classic UI (new route not allowed in this phase)`)
  summary.push(`${app}: ${snap[app].length} classic routes → native ${counts.native}, redirect ${counts.redirect}, not-migrated ${counts.notMigrated}`)
}
summary.forEach((s) => console.log('  ' + s))
report('route-diff (no route lost)', problems)
