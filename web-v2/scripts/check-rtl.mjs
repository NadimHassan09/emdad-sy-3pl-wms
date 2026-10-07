// Bans physical-direction utilities and arbitrary px font sizes. Use logical utilities (ms-/me-/ps-/pe-/start-/end-/text-start …).
import { ROOT, walk, read, rel, report } from './_lib.mjs'
import { join } from 'node:path'

const BANNED = /^(?:(?:ml|mr|pl|pr|left|right|scroll-ml|scroll-mr)-.+|text-left|text-right|float-left|float-right|border-l(?:-.+)?|border-r(?:-.+)?|rounded-(?:l|r|tl|tr|bl|br)(?:-.+)?|space-x-reverse|divide-x-reverse)$/
const ARBITRARY_PX_FONT = /(?:^|[\s"'`:])text-\[\d+(?:\.\d+)?px\]/

// Side-driven primitives: their physical classes are chosen by a `side`/direction PROP (the app derives it from `dir`).
const SIDE_DRIVEN = [/components\/ui\/(sheet|drawer|sidebar)\.tsx$/]
const CENTERING = /(?:^|:)left-1\/2$/

const files = [...walk(join(ROOT, 'apps'), ['.ts', '.tsx']), ...walk(join(ROOT, 'packages'), ['.ts', '.tsx', '.css'])]
const problems = []

for (const f of files) {
  const sideDriven = SIDE_DRIVEN.some((r) => r.test(f))
  read(f).split('\n').forEach((line, i) => {
    if (/rtl-ok/.test(line)) return
    if (ARBITRARY_PX_FONT.test(line)) problems.push(`${rel(f)}:${i + 1} arbitrary px font size (use the type scale)`)
    for (const raw of line.split(/[\s"'`{}(),]+/)) {
      if (!raw || raw.length > 80) continue
      // strip variants: hover:, md:, rtl:, data-[x=y]:, group-data-[...]/name: …
      const base = raw.replace(/^(?:[a-z0-9-]+(?:\[[^\]]*\])?(?:\/[a-z0-9-]+)?:)+/, '').replace(/^[-!]/, '')
      if (!sideDriven && !CENTERING.test(base) && BANNED.test(base) && !/^(?:left|right)-\[?(?:calc|50)/.test(base) && !/^right-0\b.*rtl-ok/.test(line)) {
        problems.push(`${rel(f)}:${i + 1} physical utility "${raw}"`)
      }
    }
  })
}
report('rtl (logical properties only)', problems)
