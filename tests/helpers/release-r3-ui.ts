import { expect, type APIRequestContext, type Page } from '@playwright/test';

import { STAGING } from './constants';
import { adminLogin } from './ui';

export async function switchAdminUser(
  page: Page,
  email: string,
  password = STAGING.password,
  request?: APIRequestContext,
) {
  if (request) {
    const res = await request.post(`${STAGING.adminUrl}/api/auth/login`, {
      data: { email, password },
    });
    const body = await res.json();
    if (!body.success) {
      throw new Error(`Login failed for ${email}: ${body.error?.message ?? 'unknown'}`);
    }
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((token) => {
      sessionStorage.clear();
      localStorage.removeItem('wms.access_token');
      sessionStorage.setItem('wms.access_token', token);
    }, body.data.access_token);
    await page.reload({ waitUntil: 'networkidle' });
    await expect
      .poll(async () => {
        const token = await page.evaluate(() => sessionStorage.getItem('wms.access_token'));
        if (!token) return '';
        const me = await request.get(`${STAGING.adminUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meBody = await me.json();
        return meBody.data?.email ?? '';
      }, { timeout: 30_000 })
      .toMatch(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    return;
  }
  await page.context().clearCookies();
  await adminLogin(page, email, password);
}

export async function fillOrderDraftLine(page: Page, sku: string, qty: string) {
  const dialog = page.getByRole('dialog');
  const row = dialog.locator('tbody tr').first();
  const productInput = row.locator('input').first();
  await productInput.click();
  await productInput.fill(sku);
  await dialog.getByRole('option', { name: new RegExp(sku) }).first().click();
  await expect(row.locator('input')).toHaveCount(2, { timeout: 10_000 });
  await row.locator('input').nth(1).fill(qty);
}

function comboboxRoot(page: Page) {
  return page.getByRole('dialog');
}

export async function selectComboboxByLabel(page: Page, label: string | RegExp, optionLabel: string | RegExp) {
  const root = (await comboboxRoot(page).count()) > 0 ? comboboxRoot(page) : page;
  const field = root.getByLabel(label);
  await field.click({ force: true });
  await field.fill(typeof optionLabel === 'string' ? optionLabel.slice(0, 8) : '');
  await root.locator('[role="listbox"] [role="option"]').filter({ hasText: typeof optionLabel === 'string' ? optionLabel : '' }).first().click().catch(async () => {
    await root.locator('[role="listbox"] [role="option"]').first().click();
  });
}

export async function selectFirstComboboxOption(page: Page, label: string | RegExp) {
  const root = (await comboboxRoot(page).count()) > 0 ? comboboxRoot(page) : page;
  const field = root.getByLabel(label);
  await field.click({ force: true });
  await root.locator('[role="listbox"] [role="option"]').first().click();
}

export async function openTimelineTask(page: Page, stepTitle: string) {
  const timeline = page.locator('section').filter({ hasText: 'Workflow timeline' });
  await expect(timeline).toBeVisible({ timeout: 30_000 });
  const card = timeline.locator('li').filter({ hasText: stepTitle }).first();
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.getByRole('link', { name: 'Open task' }).click();
  await page.waitForURL(/\/tasks\//, { timeout: 30_000 });
}

export async function assignWorkerAndStart(page: Page, workerLabel: string) {
  const workerField = page.getByLabel(/Assign worker/i);
  await workerField.click();
  await workerField.fill(workerLabel.split(/\s+/)[0] ?? workerLabel);
  const option = page.locator('[role="listbox"] [role="option"]').filter({
    hasText: new RegExp(workerLabel.split(/\s+/)[0] ?? workerLabel, 'i'),
  });
  if (await option.count()) {
    await option.first().click();
  } else {
    await page.locator('[role="listbox"] [role="option"]').first().click();
  }
  await page.getByRole('button', { name: /^Assign$/i }).click();
  await expect(page.getByText(/Assigned/i).first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
  const start = page.getByRole('button', { name: /^Start$/i });
  await expect(start).toBeEnabled({ timeout: 15_000 });
  await start.click();
  await expect(page.getByRole('button', { name: /Complete/i }).first()).toBeVisible({ timeout: 30_000 });
}

export async function completeReceiving(page: Page, qty: string) {
  const openLineMenu = async () => {
    await page.locator('[data-receiving-line-action-trigger="true"]').first().click();
  };

  await openLineMenu();
  const validateBtn = page
    .locator('[data-receiving-line-action-menu="true"]')
    .getByRole('button', { name: /Validate specs/i });
  if (await validateBtn.isVisible()) {
    await validateBtn.click();
    const specs = page.getByRole('dialog', { name: /Validate product specs/i });
    await specs.getByRole('checkbox').check();
    await specs.getByRole('button', { name: /Confirm validation/i }).click();
    await openLineMenu();
  }

  const receiveExpected = page
    .locator('[data-receiving-line-action-menu="true"]')
    .getByRole('button', { name: /Receive expected qty/i });
  if (await receiveExpected.isVisible()) {
    await receiveExpected.click();
  } else if (await page.locator('table tbody tr').count()) {
    await page.locator('table tbody tr').first().locator('input').nth(1).fill(qty);
  } else {
    await page.locator('input[inputmode="decimal"]').first().fill(qty);
  }

  const expiryInput = page.locator('table tbody tr').first().locator('input').last();
  if (await expiryInput.isVisible()) {
    const expiryVal = await expiryInput.inputValue();
    if (!expiryVal.trim()) {
      const future = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      await expiryInput.fill(future);
    }
  }

  await page.getByRole('button', { name: /^Complete receiving$/i }).click();
  await expect
    .poll(async () => !(await page.getByRole('button', { name: /^Complete receiving$/i }).isVisible()), {
      timeout: 45_000,
    })
    .toBe(true);
}

export async function completeQcPass(page: Page) {
  const passRadio = page.getByRole('radio').first();
  if (await passRadio.isVisible()) {
    await passRadio.check();
  }
  await page.getByRole('button', { name: /^Submit QC$/i }).click();
  await expect
    .poll(async () => !(await page.getByRole('button', { name: /^Submit QC$/i }).isVisible()), {
      timeout: 45_000,
    })
    .toBe(true);
}

export async function completePutaway(page: Page, locationSearch: string, qty: string) {
  const destInput = page.getByPlaceholder(/Search path or barcode/i);
  await destInput.click();
  await destInput.fill(locationSearch);
  await page.locator('[role="listbox"] [role="option"]').first().click({ timeout: 15_000 });

  const movedInput = page.locator('table tbody tr').first().locator('input').last();
  if (await movedInput.isVisible()) {
    const current = await movedInput.inputValue();
    if (!current.trim()) await movedInput.fill(qty);
  }

  await page.getByRole('button', { name: /^Complete putaway$/i }).click();
  await expect
    .poll(async () => !(await page.getByRole('button', { name: /^Complete putaway$/i }).isVisible()), {
      timeout: 45_000,
    })
    .toBe(true);
}

export async function completePick(page: Page, qty: string) {
  const picked = page.locator('table tbody tr').first().locator('input').first();
  await picked.fill(qty);

  const dropOff = page.getByPlaceholder(/Select packing location|Select delivery area/i);
  if (await dropOff.isVisible()) {
    await dropOff.click();
    await page.locator('[role="listbox"] [role="option"]').first().click({ timeout: 15_000 });
  }

  await page.getByRole('button', { name: /^Complete picking$/i }).click();
  await expect
    .poll(async () => !(await page.getByRole('button', { name: /^Complete picking$/i }).isVisible()), {
      timeout: 45_000,
    })
    .toBe(true);
}

export async function completePack(page: Page, qty: string) {
  const newPackage = page.getByRole('button', { name: /\+ New package/i });
  await expect(newPackage).toBeVisible({ timeout: 15_000 });
  await newPackage.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  const qtyInput = dialog.locator('input[inputmode="decimal"]').first();
  if (await qtyInput.isVisible()) await qtyInput.fill(qty);
  await dialog.getByRole('button', { name: /^Add$/i }).click();
  await dialog.getByRole('button', { name: /Finalize package/i }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });

  await page.getByRole('button', { name: /^Complete packing$/i }).click();
  await expect
    .poll(async () => !(await page.getByRole('button', { name: /^Complete packing$/i }).isVisible()), {
      timeout: 45_000,
    })
    .toBe(true);
}

export async function completeDispatch(page: Page, qty: string, productSku?: string) {
  await expect
    .poll(async () => {
      const hero = page.locator('section').filter({ hasText: 'Movement path' });
      if (!(await hero.count())) return false;
      const text = await hero.innerText();
      return !/To be selected by the system/i.test(text);
    }, { timeout: 90_000 })
    .toBe(true);

  const verification = page.locator('section').filter({ hasText: 'Shipment verification' });
  const tbodyRows = verification.locator('tbody tr');

  if ((await tbodyRows.count()) === 0) {
    await verification.getByRole('button', { name: /^Add$/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const byPackage = dialog.getByRole('button', { name: /By package/i });
    if (await byPackage.isVisible()) {
      await byPackage.click();
      const pendingPkg = dialog.locator('ul button').filter({ hasText: /^PKG-/ }).first();
      if (await pendingPkg.count()) {
        await pendingPkg.click();
      } else {
        await dialog.getByLabel(/Package label/i).fill('PKG-001');
      }
    } else if (productSku) {
      await dialog.getByLabel(/^Product$/i).fill(productSku);
      await dialog.getByLabel(/Quantity to ship/i).fill(qty);
    }

    await dialog.getByRole('button', { name: /^Add$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  }

  if ((await tbodyRows.count()) > 0) {
    const shipRow = tbodyRows.first();
    const shipInput = shipRow.locator('input:not([type="checkbox"])').first();
    if (await shipInput.isVisible()) {
      const current = await shipInput.inputValue();
      if (!current.trim()) await shipInput.fill(qty);
    }
    const checkbox = shipRow.locator('input[type="checkbox"]');
    if (!(await checkbox.isChecked())) await checkbox.check();
  }

  const carrier = page.getByLabel(/^Carrier$/i);
  if (await carrier.isVisible()) await carrier.fill('R3 E2E Carrier');
  const tracking = page.getByLabel(/Tracking Number/i);
  if (await tracking.isVisible()) await tracking.fill(`R3-TRK-${Date.now()}`);

  await page.getByRole('button', { name: /^Complete dispatch$/i }).click();
  await expect
    .poll(async () => !(await page.getByRole('button', { name: /^Complete dispatch$/i }).isVisible()), {
      timeout: 45_000,
    })
    .toBe(true);
}

export async function waitForOrderStatus(page: Page, statusPattern: RegExp) {
  await expect.poll(async () => {
    const text = await page.locator('body').innerText();
    return statusPattern.test(text);
  }, { timeout: 45_000 }).toBe(true);
}
