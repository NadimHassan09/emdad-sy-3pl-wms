// WCAG contrast verification over tokens.css (light + dark). Fails if any text pair < 4.5:1 or UI pair < 3:1.
import { join } from 'node:path'
import { ROOT, read, report } from './_lib.mjs'

const css = read(join(ROOT, 'packages/ui/src/styles/tokens.css'))

function parseBlock(selector) {
  const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm')
  const m = css.match(re)
  if (!m) throw new Error(`block ${selector} not found`)
  const vars = {}
  for (const v of m[1].matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) vars[v[1]] = v[2]
  return vars
}
const light = parseBlock(':root')
const dark = { ...light, ...parseBlock('\\.dark') }

const lum = (hex) => {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const TONES = ['neutral', 'pending', 'progress', 'ready', 'transit', 'success', 'warning', 'danger', 'returned']
const pairs = [
  // text on surfaces
  ['foreground', 'background', 4.5], ['foreground', 'sheet', 4.5], ['card-foreground', 'card', 4.5], ['popover-foreground', 'popover', 4.5],
  ['muted-foreground', 'background', 4.5], ['muted-foreground', 'sheet', 4.5], ['muted-foreground', 'card', 4.5], ['muted-foreground', 'muted', 4.5],
  ['primary-foreground', 'primary', 4.5], ['primary-foreground', 'primary-hover', 4.5],
  ['secondary-foreground', 'secondary', 4.5], ['accent-foreground', 'accent', 4.5],
  ['destructive-foreground', 'destructive', 4.5], ['destructive', 'card', 4.5], ['destructive', 'sheet', 4.5],
  ['success', 'card', 4.5], ['warning', 'card', 4.5], ['info', 'card', 4.5],
  ['brand-800', 'brand-100', 4.5], ['brand-900', 'brand-50', 4.5],
  // sidebar
  ['sidebar-foreground', 'sidebar', 4.5], ['sidebar-foreground', 'sidebar-gradient-from', 4.5], ['sidebar-foreground', 'sidebar-gradient-to', 4.5],
  ['sidebar-muted', 'sidebar-gradient-from', 4.5], ['sidebar-muted', 'sidebar-gradient-to', 4.5],
  ['sidebar-primary-foreground', 'sidebar-primary', 4.5], ['sidebar-accent-foreground', 'sidebar-accent', 4.5],
  // non-text UI
  ['ring', 'card', 3], ['ring', 'background', 3], ['input', 'card', 3],
  // status tones
  // tone dots are decorative: status is always also conveyed by text
  ...TONES.map((t) => [`tone-${t}-fg`, `tone-${t}-bg`, 4.5]),
]

const problems = []
let n = 0
for (const [mode, vars] of [['light', light], ['dark', dark]]) {
  for (const [fg, bg, min] of pairs) {
    if (!vars[fg] || !vars[bg]) { problems.push(`[${mode}] missing token ${!vars[fg] ? fg : bg}`); continue }
    n++
    const r = ratio(vars[fg], vars[bg])
    if (r < min) problems.push(`[${mode}] ${fg} ${vars[fg]} on ${bg} ${vars[bg]} = ${r.toFixed(2)}:1 (< ${min}:1)`)
  }
}
console.log(`  ${n} pairs checked (light + dark)`)
report('contrast (WCAG AA)', problems)
