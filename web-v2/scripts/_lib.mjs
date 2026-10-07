import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'reference', '.vite', 'test-results'].includes(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, exts, out)
    else if (exts.some((e) => name.endsWith(e))) out.push(p)
  }
  return out
}

export const read = (p) => readFileSync(p, 'utf8')
export const rel = (p) => p.slice(ROOT.length + 1)

export function report(name, problems) {
  if (problems.length) {
    console.error(`\n✖ ${name}: ${problems.length} problem(s)`)
    for (const p of problems.slice(0, 80)) console.error('  - ' + p)
    if (problems.length > 80) console.error(`  … and ${problems.length - 80} more`)
    process.exit(1)
  }
  console.log(`✔ ${name}`)
}
