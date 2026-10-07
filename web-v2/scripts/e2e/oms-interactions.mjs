/** Interaction smoke for the OMS list (no mutations are confirmed). Credentials via env. */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? '/tmp/v2int'
const lang = process.argv[3] ?? 'en'
const BASE = process.env.BASE ?? 'http://127.0.0.1:5273'
mkdirSync(out, { recursive: true })
const issues = []
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: [] })
await ctx.addInitScript((lg) => { localStorage.setItem('wms-ui-language', lg === 'ar' ? 'AR' : 'EN') }, lang)
const page = await ctx.newPage()
page.on('pageerror', (e) => issues.push(`[pageerror] ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error' && !/getUserMedia|NotAllowed|NotFound|camera/i.test(m.text())) issues.push(`[console] ${m.text().slice(0, 160)}`) })
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('input[type=email], input[name=email], input[type=text]').first().fill(process.env.EMAIL)
await page.locator('input[type=password]').first().fill(process.env.PASSWORD)
await page.locator('button[type=submit]').first().click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'))
await page.goto(`${BASE}/orders/oms`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const shot = (n) => page.screenshot({ path: `${out}/${n}-${lang}.png` })

// advanced filters
await page.getByRole('button', { name: /Advanced filters|تصفية متقدمة/ }).click()
await page.waitForTimeout(300)
await shot('1-advanced')
await page.getByRole('combobox').first().click().catch(() => undefined)
await page.waitForTimeout(300)
await shot('2-combobox')
await page.keyboard.press('Escape')
await page.getByRole('button', { name: /Advanced filters|تصفية متقدمة/ }).click()

// status card filter -> waiting for confirmation, then row menu -> cancel dialog
await page.getByRole('button', { name: /Waiting for confirmation|بانتظار التأكيد/ }).first().click()
await page.waitForTimeout(1500)
await shot('3-filtered')
await page.getByRole('button', { name: /Actions for|إجراءات/ }).first().click()
await page.waitForTimeout(300)
await shot('4-rowmenu')
await page.getByRole('menuitem', { name: /Cancel order|إلغاء الطلب/ }).first().click()
await page.waitForTimeout(400)
await shot('5-cancel-dialog')
await page.getByRole('button', { name: /Keep order|تراجع/ }).click()

// processing -> stages
await page.getByRole('button', { name: /^2,517|Processing|قيد المعالجة/ }).first().click().catch(() => undefined)
await page.waitForTimeout(1500)
await shot('6-processing-stages')

// dialogs
await page.getByRole('button', { name: /Export CSV|تصدير CSV/ }).click(); await page.waitForTimeout(500); await shot('7-export'); await page.keyboard.press('Escape')
await page.getByRole('button', { name: /^Import|^استيراد/ }).click(); await page.waitForTimeout(500); await shot('8-import'); await page.keyboard.press('Escape')
await page.getByRole('button', { name: /Confirm by QR|تأكيد بالـ QR/ }).click(); await page.waitForTimeout(1500); await shot('9-scan'); await page.keyboard.press('Escape')

// selection toolbar
await page.locator('tbody input[type=checkbox], tbody button[role=checkbox]').first().click().catch(() => undefined)
await page.waitForTimeout(400)
await shot('10-selection')
await b.close()
console.log(issues.length ? issues.join('\n') : 'no issues')
