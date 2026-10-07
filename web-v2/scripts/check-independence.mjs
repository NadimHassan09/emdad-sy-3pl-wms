// web-v2 must not depend in ANY way on the classic UI (frontend/, client-frontend/, shared/design-system*).
// Checks: forbidden strings, relative imports escaping web-v2, workspace/config references.
import { existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { ROOT, walk, read, rel, report } from './_lib.mjs'

const FORBIDDEN = [
  [/@ds\b/, 'imports/aliases the legacy @ds design system'],
  [/shared\/design-system/, 'references shared/design-system*'],
  [/client-frontend/, 'references client-frontend/'],
  [/(?:\.\.\/)+frontend(?:\/|['"`])/, 'relative path into legacy frontend/'],
  [/(?:\.\.\/)+shared(?:\/|['"`])/, 'relative path into legacy shared/'],
  [/\/var\/www\/emdad-sy-3pl-wms(?!-staging\/web-v2)/, 'absolute path outside web-v2'],
  [/@emdad\/wms-task-execution/, 'uses the vendored legacy task-execution package'],
]

const files = [
  ...walk(join(ROOT, 'apps'), ['.ts', '.tsx', '.css', '.html', '.json', '.mjs']),
  ...walk(join(ROOT, 'packages'), ['.ts', '.tsx', '.css', '.html', '.json', '.mjs']),
  join(ROOT, 'package.json'),
  join(ROOT, 'tsconfig.base.json'),
]

const problems = []
for (const f of files) {
  const text = read(f)
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (/independence-ok/.test(line)) return
    for (const [re, why] of FORBIDDEN) if (re.test(line)) problems.push(`${rel(f)}:${i + 1} ${why}`)
  })
  if (/\.(tsx?|mjs)$/.test(f)) {
    const re = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]*)['"]/g
    let m
    while ((m = re.exec(text))) {
      const target = resolve(dirname(f), m[1])
      if (!target.startsWith(ROOT)) problems.push(`${rel(f)} relative import escapes web-v2: ${m[1]}`)
    }
  }
}
// every workspace dependency must be a web-v2 workspace
report('independence (no legacy frontend dependency)', problems)
