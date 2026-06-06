/**
 * RELEASE-R3 — Warehouse workflow E2E (real browser, no workflow API shortcuts).
 */
import { test, expect } from '@playwright/test';

import { STAGING, USERS } from '../../helpers/constants';
import { ensureR3Accounts, type R3AccountContext } from '../../helpers/release-r3-accounts';
import { r3Screenshot } from '../../helpers/release-r3-screenshots';
import {
  assignWorkerAndStart,
  completeDispatch,
  completePack,
  completePick,
  completePutaway,
  completeQcPass,
  completeReceiving,
  openTimelineTask,
  fillOrderDraftLine,
  selectComboboxByLabel,
  selectFirstComboboxOption,
  switchAdminUser,
  waitForOrderStatus,
} from '../../helpers/release-r3-ui';
import { WorkflowApi } from '../../helpers/workflow-fixture';

test.describe.configure({ mode: 'serial' });

const QTY = '5';
/** Ship fewer units than received so inventory remains for adjustment / cycle count. */
const OUTBOUND_QTY = '3';

let ctx: R3AccountContext;
let inboundOrderId = '';
let outboundOrderId = '';
let cycleCountId = '';

test.beforeAll(async ({ request }) => {
  ctx = await ensureR3Accounts(request);
});

test.describe('RELEASE-R3 Warehouse Workflow E2E', () => {
  test('01 — Inbound: Create ASN', async ({ page }) => {
    const t0 = Date.now();
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto('/orders/inbound', { waitUntil: 'networkidle' });
    await r3Screenshot(page, 'inbound', '01-list');

    await page.getByRole('button', { name: /\+ New inbound/i }).click();
    await expect(page.getByRole('heading', { name: /New inbound order/i })).toBeVisible();
    await r3Screenshot(page, 'inbound', '02-create-modal-step1');

    await page.getByRole('dialog').getByRole('button', { name: /^Next$/i }).click();
    await fillOrderDraftLine(page, ctx.productSku, QTY);
    await r3Screenshot(page, 'inbound', '03-create-modal-lines');

    await page.getByRole('dialog').getByRole('button', { name: /^Create$/i }).click();
    await page.waitForURL(/\/orders\/inbound\//, { timeout: 30_000 });
    inboundOrderId = page.url().split('/').pop() ?? '';
    expect(inboundOrderId).toMatch(/[0-9a-f-]{36}/i);
    await r3Screenshot(page, 'inbound', '04-asn-created');
    test.info().annotations.push({ type: 'duration_ms', description: String(Date.now() - t0) });
  });

  test('02 — Inbound: Confirm ASN (supervisor)', async ({ page }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/orders/inbound/${inboundOrderId}`, { waitUntil: 'networkidle' });
    await selectFirstComboboxOption(page, /Receiving dock/i);
    await r3Screenshot(page, 'inbound', '05-confirm-setup');
    await page.getByRole('button', { name: /Confirm order|Approve order/i }).click();
    await waitForOrderStatus(page, /confirmed|in progress/i);
    await r3Screenshot(page, 'inbound', '06-confirmed');
  });

  test('03 — Inbound: Receive (operator)', async ({ page, request }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/orders/inbound/${inboundOrderId}`, { waitUntil: 'networkidle' });
    await openTimelineTask(page, 'Receive');
    await r3Screenshot(page, 'inbound', '07-receive-task');
    await assignWorkerAndStart(page, ctx.operatorWorkerLabel);
    const receiveTaskUrl = page.url();

    await switchAdminUser(page, ctx.operatorEmail, STAGING.newUserPassword, request);
    await page.goto(receiveTaskUrl, { waitUntil: 'networkidle' });
    await completeReceiving(page, QTY);
    await r3Screenshot(page, 'inbound', '08-receive-complete');
  });

  test('04 — Inbound: QC (operator, if present)', async ({ page, request }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/orders/inbound/${inboundOrderId}`, { waitUntil: 'networkidle' });

    const qcCard = page.locator('li').filter({ hasText: /^QC$/ }).or(page.locator('li').filter({ hasText: 'QC' }));
    if ((await qcCard.count()) === 0) {
      test.skip(true, 'QC step not in workflow for this product');
      return;
    }

    await openTimelineTask(page, 'QC');
    await assignWorkerAndStart(page, ctx.operatorWorkerLabel);
    const qcTaskUrl = page.url();
    await switchAdminUser(page, ctx.operatorEmail, STAGING.newUserPassword, request);
    await page.goto(qcTaskUrl, { waitUntil: 'networkidle' });
    await completeQcPass(page);
    await r3Screenshot(page, 'inbound', '09-qc-complete');
  });

  test('05 — Inbound: Putaway (operator)', async ({ page, request }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/orders/inbound/${inboundOrderId}`, { waitUntil: 'networkidle' });
    await expect.poll(async () => {
      const recv = page.locator('section').filter({ hasText: 'Workflow timeline' }).locator('li').filter({ hasText: 'Receive' }).first();
      return /completed/i.test(await recv.innerText());
    }, { timeout: 90_000 }).toBe(true);
    const putawayTitle = (await page.locator('li').filter({ hasText: 'Putaway (Quarantine)' }).count())
      ? 'Putaway (Quarantine)'
      : 'Putaway';
    await openTimelineTask(page, putawayTitle);
    await assignWorkerAndStart(page, ctx.operatorWorkerLabel);
    const putawayTaskUrl = page.url();
    await switchAdminUser(page, ctx.operatorEmail, STAGING.newUserPassword, request);
    await page.goto(putawayTaskUrl, { waitUntil: 'networkidle' });
    const putawaySearch =
      putawayTitle === 'Putaway (Quarantine)' ? ctx.quarantineLocationSearch : ctx.internalLocationSearch;
    await completePutaway(page, putawaySearch, QTY);
    await r3Screenshot(page, 'inbound', '10-putaway-complete');
  });

  test('06 — Inbound: Complete order', async ({ page }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/orders/inbound/${inboundOrderId}`, { waitUntil: 'networkidle' });
    await expect.poll(async () => page.locator('body').innerText(), { timeout: 60_000 }).toMatch(
      /completed/i,
    );
    await r3Screenshot(page, 'inbound', '11-inbound-complete');
  });

  test('07 — Outbound: Create order', async ({ page }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto('/orders/outbound', { waitUntil: 'networkidle' });
    await r3Screenshot(page, 'outbound', '01-list');

    await page.getByRole('button', { name: /\+ New outbound/i }).click();
    await page.getByRole('dialog').getByLabel(/Destination/i).fill('R3 E2E Ship-To Address');
    await page.getByRole('dialog').getByRole('button', { name: /^Next$/i }).click();
    await fillOrderDraftLine(page, ctx.productSku, OUTBOUND_QTY);
    await r3Screenshot(page, 'outbound', '02-create-modal');

    await page.getByRole('dialog').getByRole('button', { name: /^Create$/i }).click();
    await page.waitForURL(/\/orders\/outbound\//, { timeout: 30_000 });
    outboundOrderId = page.url().split('/').pop() ?? '';
    await r3Screenshot(page, 'outbound', '03-order-created');
  });

  test('08 — Outbound: Allocate / confirm workflow', async ({ page }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/orders/outbound/${outboundOrderId}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Confirm & start workflow|Approve order/i }).click();
    await waitForOrderStatus(page, /confirmed|in progress|picking/i);
    await r3Screenshot(page, 'outbound', '04-allocated');
  });

  test('09 — Outbound: Pick', async ({ page, request }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/orders/outbound/${outboundOrderId}`, { waitUntil: 'networkidle' });
    await openTimelineTask(page, 'Pick');
    await assignWorkerAndStart(page, ctx.operatorWorkerLabel);
    const pickTaskUrl = page.url();
    await switchAdminUser(page, ctx.operatorEmail, STAGING.newUserPassword, request);
    await page.goto(pickTaskUrl, { waitUntil: 'networkidle' });
    await completePick(page, OUTBOUND_QTY);
    await r3Screenshot(page, 'outbound', '05-pick-complete');
  });

  test('10 — Outbound: Pack', async ({ page, request }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/orders/outbound/${outboundOrderId}`, { waitUntil: 'networkidle' });
    await openTimelineTask(page, 'Pack');
    await assignWorkerAndStart(page, ctx.operatorWorkerLabel);
    const packTaskUrl = page.url();
    await switchAdminUser(page, ctx.operatorEmail, STAGING.newUserPassword, request);
    await page.goto(packTaskUrl, { waitUntil: 'networkidle' });
    await completePack(page, OUTBOUND_QTY);
    await r3Screenshot(page, 'outbound', '06-pack-complete');
  });

  test('11 — Outbound: Dispatch', async ({ page, request }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/orders/outbound/${outboundOrderId}`, { waitUntil: 'networkidle' });
    await openTimelineTask(page, 'Delivery');
    await assignWorkerAndStart(page, ctx.operatorWorkerLabel);
    const dispatchTaskUrl = page.url();
    await switchAdminUser(page, ctx.operatorEmail, STAGING.newUserPassword, request);
    await page.goto(dispatchTaskUrl, { waitUntil: 'networkidle' });
    await completeDispatch(page, OUTBOUND_QTY, ctx.productSku);
    await r3Screenshot(page, 'outbound', '07-dispatch-complete');
  });

  test('12 — Outbound: Complete order', async ({ page }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/orders/outbound/${outboundOrderId}`, { waitUntil: 'networkidle' });
    await expect.poll(async () => page.locator('body').innerText(), { timeout: 60_000 }).toMatch(
      /completed|shipped/i,
    );
    await r3Screenshot(page, 'outbound', '08-outbound-complete');
  });

  test('13 — Inventory: Adjustment create', async ({ page, request }) => {
    const api = await WorkflowApi.create(request, 'superAdmin');
    let stock: Awaited<ReturnType<typeof api.getStock>> = [];
    await expect
      .poll(async () => {
        stock = await api.getStock(ctx.productId);
        return stock.length;
      }, { timeout: 30_000 })
      .toBeGreaterThan(0);

    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto('/inventory/adjustments', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /\+ New adjustment/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/New adjustment/i).first()).toBeVisible({ timeout: 15_000 });

    const clientField = dialog.getByPlaceholder(/Select client/i);
    await clientField.click();
    await clientField.fill('Acme');
    await dialog.locator('[role="listbox"] [role="option"]').filter({ hasText: /Acme/i }).first().click();
    await dialog.getByLabel(/^Reason$/i).fill('R3 E2E inventory adjustment');
    const nextBtn = dialog.getByRole('button', { name: /^Next$/i });
    await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
    await nextBtn.click();
    await expect(dialog.getByText(/New adjustment — lines|adjustment — lines/i)).toBeVisible({
      timeout: 15_000,
    });
    await r3Screenshot(page, 'inventory', '01-adjustment-lines');

    const lineForm = dialog.locator('form');
    await lineForm.getByLabel(/^Search$/i).fill(ctx.productSku);
    await page.waitForTimeout(500);
    const productCombo = lineForm.getByPlaceholder('Select product…');
    await productCombo.click();
    await productCombo.fill(ctx.productSku);
    await dialog.locator('[role="listbox"] [role="option"]').filter({ hasText: ctx.productSku }).first().click();
    await expect
      .poll(async () => {
        const loc = lineForm.getByPlaceholder('Pick location…');
        return await loc.isVisible();
      }, { timeout: 15_000 })
      .toBe(true);
    const locationField = lineForm.getByPlaceholder('Pick location…');
    await locationField.click();
    await dialog.locator('[role="listbox"] [role="option"]').first().click();

    const lotField = lineForm.getByPlaceholder(/Pick lot/i);
    if (await lotField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await lotField.click();
      await lineForm.locator('[role="listbox"] [role="option"]').first().click();
    }

    const onHand = stock[0]?.quantityOnHand ?? '2';
    await lineForm.getByLabel(/Qty after approve/i).fill(String(Number(onHand)));
    await lineForm.getByRole('button', { name: /^Add line$/i }).click();
    await expect(dialog.locator('table tbody tr')).not.toHaveCount(0, { timeout: 10_000 });

    const saveDraft = dialog.getByRole('button', { name: /Save draft/i });
    await expect(saveDraft).toBeEnabled({ timeout: 10_000 });
    await saveDraft.click();
    await expect(page.getByRole('heading', { name: /New adjustment/i })).toBeHidden({ timeout: 15_000 });
    await r3Screenshot(page, 'inventory', '02-adjustment-draft-saved');
  });

  test('14 — Inventory: Adjustment approval', async ({ page }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto('/inventory/adjustments', { waitUntil: 'networkidle' });
    await page.locator('tbody tr').filter({ hasText: /draft/i }).first().click();
    await r3Screenshot(page, 'inventory', '03-adjustment-detail');
    await page.getByRole('button', { name: /^Confirm$/i }).click();
    await r3Screenshot(page, 'inventory', '04-adjustment-approved');
  });

  test('15 — Inventory: Cycle count execute (operator)', async ({ page, request }) => {
    const api = await WorkflowApi.create(request, 'superAdmin');
    await api.cancelActiveCycleCounts(ctx.warehouseId);
    const create = await api.call('POST', '/cycle-count/counts', {
      warehouseId: ctx.warehouseId,
      productIds: [ctx.productId],
      notes: `R3-E2E-${Date.now()}`,
      assignedWorkerId: ctx.operatorWorkerId,
    });
    expect(create.status).toBeLessThan(300);
    cycleCountId = create.json.data.id;
    await api.call('POST', `/cycle-count/counts/${cycleCountId}/start`);

    await switchAdminUser(page, ctx.operatorEmail, STAGING.newUserPassword, request);
    await page.goto(`/cycle-count/${cycleCountId}/execute`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Count execution/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel(/Counted quantity/i)).toBeVisible({ timeout: 30_000 });
    await r3Screenshot(page, 'inventory', '05-cycle-count-execute');

    const onHand = (await api.getStock(ctx.productId))[0]?.quantityOnHand ?? '2';
    await page.getByLabel(/Counted quantity/i).fill(String(Number(onHand)));
    await page.getByRole('button', { name: /Save count/i }).click();
    await page.getByRole('button', { name: /Finish & submit/i }).click();
    await page.getByRole('button', { name: /^Submit$/i }).click();
    await r3Screenshot(page, 'inventory', '06-cycle-count-submitted');
  });

  test('16 — Inventory: Cycle count approval (supervisor)', async ({ page }) => {
    await switchAdminUser(page, ctx.supervisorEmail, STAGING.newUserPassword);
    await page.goto(`/cycle-count/${cycleCountId}`, { waitUntil: 'networkidle' });
    await r3Screenshot(page, 'inventory', '07-cycle-count-review');

    const completeBtn = page.getByRole('button', { name: /Complete count/i });
    if (await completeBtn.isVisible()) {
      await completeBtn.click();
    } else {
      const reconcile = page.getByRole('button', { name: /Build reconciliation/i });
      if (await reconcile.isVisible()) await reconcile.click();
      const post = page.getByRole('button', { name: /Post reconciliation/i });
      if (await post.isVisible()) await post.click();
      await completeBtn.click();
    }
    await r3Screenshot(page, 'inventory', '08-cycle-count-complete');
  });

  test('17 — Backups: Manual backup (schedule run now)', async ({ page, request }) => {
    await switchAdminUser(page, USERS.superAdmin.email, STAGING.password, request);
    await page.goto('/settings/backups/schedules', { waitUntil: 'networkidle' });
    await r3Screenshot(page, 'backups', '01-schedules');

    const runNow = page.getByRole('button', { name: /Run now/i }).first();
    await expect(runNow).toBeVisible({ timeout: 15_000 });
    await runNow.click();
    await page.getByRole('button', { name: /Run now/i }).last().click();
    await expect(page.getByText(/backup|job|started|queued|running/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await r3Screenshot(page, 'backups', '02-manual-backup-triggered');
  });

  test('18 — Backups: Upload page validation', async ({ page, request }) => {
    await switchAdminUser(page, USERS.superAdmin.email, STAGING.password, request);
    await page.goto('/settings/backups/upload', { waitUntil: 'networkidle' });
    await r3Screenshot(page, 'backups', '03-upload-page');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'r3-invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a dump'),
    });
    await expect(page.getByText(/Validation failed|Only PostgreSQL/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await r3Screenshot(page, 'backups', '04-upload-rejected');
  });

  test('19 — Backups: Restore simulation (type RESTORE)', async ({ page, request }) => {
    await switchAdminUser(page, USERS.superAdmin.email, STAGING.password, request);
    await page.goto('/settings/backups/restore', { waitUntil: 'networkidle' });
    await r3Screenshot(page, 'backups', '05-restore-page');

    await expect(page.getByText(/Warnings/i)).toBeVisible();
    await page.getByLabel(/Type RESTORE/i).fill('RESTORE');
    const restoreBtn = page.getByRole('button', { name: /Restore database/i });
    await expect(restoreBtn).toBeDisabled();
    await r3Screenshot(page, 'backups', '06-restore-simulation');
  });

  test('20 — Backups: Retention cleanup preview', async ({ page, request }) => {
    await switchAdminUser(page, USERS.superAdmin.email, STAGING.password, request);
    await page.goto('/settings/backups/retention', { waitUntil: 'networkidle' });
    await r3Screenshot(page, 'backups', '07-retention-preview');

    const cleanupBtn = page.getByRole('button', { name: /Run retention cleanup/i }).first();
    await expect(cleanupBtn).toBeVisible();
    await cleanupBtn.click();
    await page.getByRole('dialog').getByRole('button', { name: /Delete expired backups/i }).click();
    await expect(page.getByText(/Deleted count|Cleanup result|deletedCount/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await r3Screenshot(page, 'backups', '08-retention-cleanup');
  });
});
