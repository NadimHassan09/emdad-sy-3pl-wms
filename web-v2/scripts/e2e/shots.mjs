/**
 * Local dev-server screenshot runner (staging backend via the Vite proxy).
 * usage: BASE=http://127.0.0.1:5273 EMAIL=... PASSWORD=... node scripts/e2e/shots.mjs <outDir> <path[,path]> [themes] [langs] [widths]
 * Credentials come from env only (never written to disk).
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [outDir, pathsArg = '/dashboard/overview', themesArg = 'light', langsArg = 'en', widthsArg = '1440'] = process.argv.slice(2)
const BASE = process.env.BASE ?? 'http://127.0.0.1:5273'
const { EMAIL, PASSWORD } = process.env
if (!EMAIL || !PASSWORD) throw new Error('EMAIL and PASSWORD env vars are required')
mkdirSync(outDir, { recursive: true })

const paths = pathsArg.split(',')
const themes = themesArg.split(',')
const langs = langsArg.split(',')
const widths = widthsArg.split(',').map(Number)

const browser = await chromium.launch()
const issues = []
for (const theme of themes) for (const lang of langs) for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: width < 600, isMobile: width < 600 })
  await ctx.addInitScript(([th, lg]) => {
    localStorage.setItem('wms-ui-language', lg === 'ar' ? 'AR' : 'EN')
    localStorage.setItem('admin-ui-theme', th)
    localStorage.setItem('client-ui-theme', th)
  }, [theme, lang])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => issues.push(`[pageerror ${theme}/${lang}/${width}] ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') issues.push(`[console ${theme}/${lang}/${width}] ${m.text().slice(0, 200)}`) })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  if (await page.locator('input[type=password]').count()) {
    await page.locator('input[type=email], input[name=email], input[autocomplete=username], input[type=text]').first().fill(EMAIL)
    await page.locator('input[type=password]').first().fill(PASSWORD)
    await page.locator('button[type=submit]').first().click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => issues.push('login did not leave /login'))
  }
  for (const p of paths) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' }).catch(() => undefined)
    await page.waitForTimeout(1200)
    const name = `${p.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'root'}-${theme}-${lang}-${width}.png`
    await page.screenshot({ path: `${outDir}/${name}`, fullPage: process.env.FULL === '1' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    if (overflow) issues.push(`[overflow] ${name}: page scrolls horizontally`)
  }
  await ctx.close()
}
await browser.close()
console.log(issues.length ? issues.join('\n') : 'no issues')
