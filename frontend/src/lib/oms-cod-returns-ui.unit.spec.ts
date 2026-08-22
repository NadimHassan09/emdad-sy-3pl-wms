import { describe, expect, it, vi } from 'vitest';

import { isOmsCodReturnsPath } from './oms-cod-returns-ui';

describe('oms-cod-returns-ui', () => {
  it('recognizes OMS COD and Returns paths (including legacy report aliases)', () => {
    expect(isOmsCodReturnsPath('/oms/cod')).toBe(true);
    expect(isOmsCodReturnsPath('/oms/returns')).toBe(true);
    expect(isOmsCodReturnsPath('/reports/oms/cod')).toBe(true);
    expect(isOmsCodReturnsPath('/reports/oms/returns')).toBe(true);
    expect(isOmsCodReturnsPath('/reports/cod-report')).toBe(true);
    expect(isOmsCodReturnsPath('/reports/returns-report')).toBe(true);
    expect(isOmsCodReturnsPath('/oms/dashboard')).toBe(false);
    expect(isOmsCodReturnsPath('/orders/oms')).toBe(false);
    expect(isOmsCodReturnsPath('/returns')).toBe(false);
  });
});

describe('navItemsForRole with OMS COD/Returns hidden', () => {
  it('omits COD and OMS Returns sidebar items when UI flag is off', async () => {
    vi.resetModules();
    vi.doMock('./oms-cod-returns-ui', () => ({
      isOmsCodReturnsUiEnabled: () => false,
      isOmsCodReturnsPath: (pathname: string) =>
        pathname === '/oms/cod' ||
        pathname.startsWith('/oms/cod/') ||
        pathname === '/oms/returns' ||
        pathname.startsWith('/oms/returns/') ||
        pathname.startsWith('/reports/oms/cod') ||
        pathname.startsWith('/reports/oms/returns') ||
        pathname === '/reports/cod-report' ||
        pathname === '/reports/returns-report',
    }));
    const { navItemsForRole } = await import('./rbac');
    const labels = navItemsForRole('super_admin').map((i) => i.labelKey);
    expect(labels).not.toContain('COD');
    expect(labels).not.toContain('OMS Returns');
    expect(labels).toContain('OMS Dashboard');
    expect(labels).toContain('OMS Orders');
    vi.resetModules();
    vi.doUnmock('./oms-cod-returns-ui');
  });
});
