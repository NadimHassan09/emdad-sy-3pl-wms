import type { Page } from '@playwright/test';

const DEFAULT_RETENTION_POLICIES = {
  keepLastDaily: 7,
  keepLastWeekly: 4,
  keepLastMonthly: 6,
  preSnapshotProtectDays: 3,
  retentionCleanupEnabled: true,
};

const DEFAULT_DRIVE_RETENTION_POLICIES = {
  keepLastDaily: 7,
  keepLastWeekly: 4,
  keepLastMonthly: 6,
  driveRetentionCleanupEnabled: true,
};

const DEFAULT_RETENTION_PREVIEW = {
  dryRun: true,
  policies: {
    keepLastDaily: 7,
    keepLastWeekly: 4,
    keepLastMonthly: 6,
    preSnapshotProtectDays: 3,
  },
  buckets: [],
  protected: [],
  deletedCount: 0,
  bytesReclaimed: 0,
  deletedJobIds: [],
};

const DEFAULT_DRIVE_RETENTION_PREVIEW = {
  dryRun: true,
  policies: { keepLastDaily: 7, keepLastWeekly: 4, keepLastMonthly: 6 },
  buckets: [],
  protected: [],
  deletedDriveCount: 0,
  deletedJobCount: 0,
  deletedDriveJobIds: [],
  deletedJobIds: [],
};

const MOCK_WAREHOUSES = [
  {
    id: '00000000-0000-4000-8000-00000000w001',
    name: 'Riyadh Main DC',
    code: 'WH-001',
    address: 'Industrial Area',
    city: 'Riyadh',
    country: 'SA',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

function isApiRequest(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/');
  } catch {
    return false;
  }
}

/** Shell APIs required by Layout / WorkflowUxProvider on every authenticated page. */
export async function mockAppShellApis(page: Page) {
  await page.route((url) => isApiRequest(url.toString()), async (route) => {
    const url = route.request().url();

    if (url.includes('/warehouses')) {
      const includeInactive = url.includes('includeInactive=true');
      const data = includeInactive
        ? MOCK_WAREHOUSES
        : MOCK_WAREHOUSES.filter((w) => w.status === 'active');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      });
      return;
    }

    if (url.includes('/workflows/context-settings')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            taskOnlyFlows: false,
            warehouseId: MOCK_WAREHOUSES[0].id,
            effective: { showAdvancedJson: false, confirmUnsavedDraft: true },
          },
        }),
      });
      return;
    }

    if (url.includes('/notifications')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], unreadCount: 0 } }),
      });
      return;
    }

    if (url.includes('/presence/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
      return;
    }

    if (url.includes('/dashboard/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
      return;
    }

    await route.continue();
  });
}

export async function mockBackupAdminApis(page: Page) {
  await page.route((url) => isApiRequest(url.toString()), async (route) => {
    const url = route.request().url();

    if (url.includes('/backups/operations/active')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            busy: false,
            activeJobId: null,
            maintenance: false,
            maintenanceReason: null,
          },
        }),
      });
      return;
    }

    if (url.includes('/backups/schedules')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [] } }),
      });
      return;
    }

    if (url.includes('/backups/retention/drive/policies')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: DEFAULT_DRIVE_RETENTION_POLICIES }),
      });
      return;
    }

    if (url.includes('/backups/retention/drive/preview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: DEFAULT_DRIVE_RETENTION_PREVIEW }),
      });
      return;
    }

    if (url.includes('/backups/retention/policies')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: DEFAULT_RETENTION_POLICIES }),
      });
      return;
    }

    if (url.includes('/backups/retention/preview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: DEFAULT_RETENTION_PREVIEW }),
      });
      return;
    }

    if (url.includes('/backups/health')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            lastSuccessfulBackupAt: null,
            lastFailedBackupAt: null,
            runningOperation: {
              busy: false,
              activeJobId: null,
              maintenance: false,
              maintenanceReason: null,
              job: null,
            },
            backupCount: 0,
            storageUsedBytes: 0,
            nextScheduledBackupAt: null,
            retentionStatus: {
              policies: DEFAULT_RETENTION_POLICIES,
              eligibleCompletedCount: 0,
              pendingDeletionCount: 0,
              lastCleanupAt: null,
              lastCleanupDeletedCount: null,
            },
            metrics: {
              hoursSinceLastSuccessfulBackup: null,
              hoursSinceLastFailedBackup: null,
              storageUsedBytes: 0,
              oldestBackupAgeHours: null,
              recentFailureCount: 0,
            },
            healthStatus: 'healthy',
            alerts: [],
          },
        }),
      });
      return;
    }

    if (url.includes('/backups/storage-policy')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            defaultPolicy: 'local_only',
            envFallbackPolicy: 'local_only',
            effectiveDefaultPolicy: 'local_only',
            updatedAt: '2026-06-09T00:00:00.000Z',
            updatedByUserId: null,
          },
        }),
      });
      return;
    }

    if (url.includes('/backups')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], total: 0 } }),
      });
      return;
    }

    if (url.includes('/integrations/google-drive/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            connected: false,
            folderId: null,
            connectedAt: null,
            connectedBy: null,
            rootFolderName: 'EMDAD WMS Backups',
            gdriveEnabled: true,
            gdriveConfigured: false,
            lastSyncedAt: null,
            pendingSyncCount: 0,
            failedSyncCount: 0,
            syncFailures: [],
          },
        }),
      });
      return;
    }

    if (url.includes('/audit-logs')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], total: 0 } }),
      });
      return;
    }

    if (url.includes('/warehouses')) {
      const includeInactive = url.includes('includeInactive=true');
      const data = includeInactive
        ? MOCK_WAREHOUSES
        : MOCK_WAREHOUSES.filter((w) => w.status === 'active');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      });
      return;
    }

    if (url.includes('/workflows/context-settings')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            taskOnlyFlows: false,
            warehouseId: MOCK_WAREHOUSES[0].id,
            effective: { showAdvancedJson: false, confirmUnsavedDraft: true },
          },
        }),
      });
      return;
    }

    if (url.includes('/dashboard/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
      return;
    }

    if (url.includes('/presence/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
      return;
    }

    if (url.includes('/notifications')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], unreadCount: 0 } }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}
