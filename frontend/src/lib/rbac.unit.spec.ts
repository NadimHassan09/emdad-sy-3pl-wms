import { describe, expect, it } from 'vitest';

import {
  canAccessInternalTransfer,
  canAccessPath,
  defaultHomePath,
  INTERNAL_TRANSFER_ROLES,
  navItemsForRole,
} from './rbac';
import { filterSectionSubNavItems, SECTION_SUB_NAV_CONFIGS } from './section-sub-nav';

const tasksSection = SECTION_SUB_NAV_CONFIGS.find((c) => c.ariaLabelKey === 'Tasks navigation')!;

describe('internal transfer RBAC', () => {
  it('allows only manager roles for /internal route group', () => {
    expect(INTERNAL_TRANSFER_ROLES).toEqual(['super_admin', 'wh_manager']);
    expect(canAccessInternalTransfer('wh_manager')).toBe(true);
    expect(canAccessInternalTransfer('super_admin')).toBe(true);
    expect(canAccessInternalTransfer('wh_operator')).toBe(false);
    expect(canAccessInternalTransfer('finance')).toBe(false);
  });

  it('blocks wh_operator from /internal path', () => {
    expect(canAccessPath('wh_operator', '/internal')).toBe(false);
    expect(canAccessPath('wh_manager', '/internal')).toBe(true);
  });

  it('redirects wh_operator home to tasks', () => {
    expect(defaultHomePath('wh_operator')).toBe('/tasks');
  });
});

describe('tasks sub-nav', () => {
  it('hides Internal transfer tab for wh_operator', () => {
    const items = filterSectionSubNavItems(tasksSection.items, {
      role: 'wh_operator',
      workerId: 'worker-1',
    });
    expect(items.some((item) => item.to === '/internal')).toBe(false);
    expect(items.some((item) => item.labelKey === 'Tasks')).toBe(true);
  });

  it('shows Internal transfer tab for wh_manager', () => {
    const items = filterSectionSubNavItems(tasksSection.items, {
      role: 'wh_manager',
      workerId: null,
    });
    expect(items.some((item) => item.to === '/internal')).toBe(true);
  });
});

describe('sidebar nav', () => {
  it('includes Tasks but not Inventory for wh_operator', () => {
    const labels = navItemsForRole('wh_operator').map((item) => item.labelKey);
    expect(labels).toContain('Tasks');
    expect(labels).not.toContain('Inventory');
    expect(labels).not.toContain('Dashboard');
  });
});
