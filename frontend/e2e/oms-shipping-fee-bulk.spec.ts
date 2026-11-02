import { test, expect } from '@playwright/test';
import { mockInternalAuth, SUPER_USER } from './helpers/mock-internal-auth';

test.use({ ignoreHTTPSErrors: true });

test.describe('OMS Shipping Fee Adjustment (Single & Bulk UI)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('wms.access_token', 'mock-token');
      window.sessionStorage.setItem('wms.access_token', 'mock-token');
      window.localStorage.setItem('wms-ui-language', 'EN');
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-0000000000ab',
          email: 'superadmin@emdad.example',
          fullName: 'Demo Super Admin',
          role: 'super_admin',
          authGroup: 'ADMIN',
          tenantCompanyId: '00000000-0000-4000-8000-000000000001',
          workerId: null,
        }),
      });
    });
  });

  test('OMS Orders: shows Edit Shipping Fee on single and multiple order selection, and opens modal', async ({
    page,
  }) => {
    // Mock OMS orders list
    await page.route('**/api/oms/orders?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: 'order-1',
                orderNumber: 'ORD-001',
                status: 'waiting_for_confirmation',
                shippingFee: '5.00',
                currency: 'USD',
                company: { name: 'Client A' },
              },
              {
                id: 'order-2',
                orderNumber: 'ORD-002',
                status: 'delivered',
                shippingFee: '10.00',
                currency: 'USD',
                company: { name: 'Client B' },
              },
              {
                id: 'order-3',
                orderNumber: 'ORD-003',
                status: 'cancelled',
                shippingFee: '8.00',
                currency: 'USD',
                company: { name: 'Client A' },
              },
              {
                id: 'order-4',
                orderNumber: 'ORD-004',
                status: 'out_for_delivery',
                shippingFee: '12.00',
                currency: 'USD',
                company: { name: 'Client C' },
              },
              {
                id: 'order-5',
                orderNumber: 'ORD-005',
                status: 'returned',
                shippingFee: '15.00',
                currency: 'USD',
                company: { name: 'Client B' },
              },
              {
                id: 'order-6',
                orderNumber: 'ORD-006',
                status: 'ready_to_ship',
                shippingFee: '7.50',
                currency: 'USD',
                company: { name: 'Client D' },
              },
            ],
            total: 6,
            page: 1,
            pageSize: 50,
          },
        }),
      });
    });

    // Mock bulk adjustment endpoint
    let lastBulkPayload: any = null;
    await page.route('**/api/oms/orders/adjust-shipping-fee-bulk', async (route) => {
      lastBulkPayload = JSON.parse(route.request().postData() || '{}');
      const items = lastBulkPayload.items || lastBulkPayload.ids?.map((id: string) => ({ id, shippingFee: 4 })) || [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requested: items.length,
          updated: items.length,
          failed: 0,
          updatedOrders: items.map((it: any, idx: number) => ({
            id: it.id || `order-${idx + 1}`,
            orderNumber: `ORD-00${idx + 1}`,
            previousShippingFee: 5,
            newShippingFee: it.shippingFee ?? 4,
            difference: (it.shippingFee ?? 4) - 5,
          })),
          failures: [],
        }),
      });
    });

    await page.goto('/orders/oms');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Step 1: Check 1 order
    const checkboxes = page.locator('tbody tr input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();
    await checkboxes.nth(0).check();

    // Verify Edit Shipping Fee action is visible in bulk toolbar and floating bar
    const editFeeBtn = page.locator('#btn-edit-shipping-fee-bulk');
    await expect(editFeeBtn).toBeVisible();
    await expect(editFeeBtn).toContainText(/Edit Shipping Fee|تعديل رسوم الشحن/);

    const floatingBtn = page.locator('#btn-edit-shipping-fee-floating');
    await expect(floatingBtn).toBeVisible();

    // Step 2: Check 4 more orders (5 total)
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();
    await checkboxes.nth(3).check();
    await checkboxes.nth(4).check();

    await expect(page.locator('#btn-edit-shipping-fee-bulk')).toBeVisible();

    // Step 3: Open Modal via bulk action
    await editFeeBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toContainText(/5/);

    // Verify current fee is accurately displayed (e.g. 5.00 USD, 10.00 USD, not 0.00 USD)
    await expect(page.locator('[role="dialog"] table')).toBeVisible();
    await expect(page.locator('[role="dialog"] table')).toContainText(/5\.00\s*USD/);

    // Verify per-row inputs exist
    const rowInputs = page.locator('[role="dialog"] table tbody input[type="number"]');
    await expect(rowInputs).toHaveCount(5);

    // Edit the first order's fee
    await rowInputs.first().fill('6.50');

    // Test removing 1 order from the modal (row 5) via trash button
    const removeBtns = page.locator('[role="dialog"] table tbody tr button');
    await expect(removeBtns).toHaveCount(5);
    await removeBtns.last().click();

    // Modal should now have 4 active orders
    await expect(page.locator('[role="dialog"] table tbody tr')).toHaveCount(4);
    await expect(page.locator('[role="dialog"]')).toContainText(/4/);

    // Confirm step
    const reviewBtn = page.locator('button:has-text("Review & Confirm"), button:has-text("متابعة للتأكيد")');
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // In confirmation view
    const confirmBtn = page.locator('button:has-text("Confirm Adjustments"), button:has-text("تأكيد التعديل")');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Wait for results view
    const closeBtn = page.locator('button:has-text("Close"), button:has-text("إغلاق")');
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    expect(lastBulkPayload).toBeDefined();
    expect(lastBulkPayload.items).toHaveLength(4);
    expect(lastBulkPayload.items[0].shippingFee).toBe(6.5);

    // Close modal
    await closeBtn.click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('Batches: shows Edit Shipping Fee when selecting orders inside a batch', async ({
    page,
  }) => {
    // Mock Batch Detail API
    await page.route('**/api/oms/batches/batch-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'batch-123',
            batchNumber: 'BATCH-2026-001',
            name: 'Damascus Express Run',
            status: 'in_progress',
            orderCount: 3,
            completedCount: 0,
            pendingCount: 3,
            issueCount: 0,
            orders: [
              {
                membershipId: 'mem-1',
                issueNote: null,
                order: {
                  id: 'order-b1',
                  orderNumber: 'ORD-B1',
                  status: 'ready_to_ship',
                  shippingFee: '6.00',
                  currency: 'USD',
                  company: { name: 'Merchant One' },
                },
              },
              {
                membershipId: 'mem-2',
                issueNote: null,
                order: {
                  id: 'order-b2',
                  orderNumber: 'ORD-B2',
                  status: 'shipped',
                  shippingFee: '8.50',
                  currency: 'USD',
                  company: { name: 'Merchant Two' },
                },
              },
              {
                membershipId: 'mem-3',
                issueNote: null,
                order: {
                  id: 'order-b3',
                  orderNumber: 'ORD-B3',
                  status: 'delivered',
                  shippingFee: '12.00',
                  currency: 'USD',
                  company: { name: 'Merchant One' },
                },
              },
            ],
          },
        }),
      });
    });

    await page.goto('/oms/batches/batch-123');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Select orders in batch table
    const batchCheckboxes = page.locator('tbody tr input[type="checkbox"]');
    await expect(batchCheckboxes.first()).toBeVisible();
    await batchCheckboxes.nth(0).check();
    await batchCheckboxes.nth(1).check();

    // Verify Edit Shipping Fee action is visible both above table and floating
    const batchTopBtn = page.locator('#btn-batch-edit-shipping-fee-top');
    const batchTableBtn = page.locator('#btn-batch-edit-shipping-fee-table');
    const batchFloatingBtn = page.locator('#btn-batch-edit-shipping-fee-floating');

    await expect(batchTableBtn).toBeVisible();
    await expect(batchTopBtn).toBeVisible();
    await expect(batchFloatingBtn).toBeVisible();

    // Click table button
    await batchTableBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toContainText(/2/);

    // Cancel modal
    await page.locator('[role="dialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("إلغاء")').first().click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});
