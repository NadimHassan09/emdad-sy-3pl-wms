import { describe, expect, it } from 'vitest';

import { auditLogsFiltersToParams, type AuditLogFilters } from './audit-logs-filters';
import { buildInboundListParams } from './inbound-list-params';
import { buildOmsOrdersListParams, OMS_ORDERS_FILTER_DEFAULTS } from './oms-orders-list-filters';
import { buildOutboundListParams } from './outbound-list-params';

const appliedInbound = {
  orderSearch: ' IN-1 ',
  status: 'completed',
  createdFrom: '2026-01-01',
  createdTo: '2026-01-31',
};

const appliedOutbound = {
  orderSearch: ' OUT-1 ',
  status: 'shipped',
  createdFrom: '2026-02-01',
  createdTo: '2026-02-28',
};

const appliedAudit: AuditLogFilters = {
  search: ' login ',
  companyId: 'c1',
  actorEmail: 'a@b.com',
  actorRole: 'super_admin',
  action: 'USER_LOGIN',
  resourceType: 'user',
  dateFrom: '2026-03-01',
  dateTo: '2026-03-31',
};

describe('export/table applied-filter parity', () => {
  it('OMS list and export share buildOmsOrdersListParams(applied)', () => {
    const applied = {
      ...OMS_ORDERS_FILTER_DEFAULTS,
      orderSearch: 'OMS',
      status: 'processing',
      city: 'Damascus',
    };
    const listParams = buildOmsOrdersListParams(applied);
    const exportParams = buildOmsOrdersListParams(applied);
    expect(exportParams).toEqual(listParams);
    expect(listParams).toEqual(
      expect.objectContaining({
        orderSearch: 'OMS',
        status: 'processing',
        city: 'Damascus',
      }),
    );
  });

  it('inbound list and export share buildInboundListParams(applied)', () => {
    const listParams = buildInboundListParams(appliedInbound, 'wh-1');
    const exportParams = buildInboundListParams(appliedInbound, 'wh-1');
    expect(exportParams).toEqual(listParams);
    expect(listParams).toEqual({
      warehouseId: 'wh-1',
      status: 'completed',
      orderSearch: 'IN-1',
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
    });
  });

  it('outbound list and export share buildOutboundListParams(applied)', () => {
    const listParams = buildOutboundListParams(appliedOutbound, 'wh-1');
    const exportParams = buildOutboundListParams(appliedOutbound, 'wh-1');
    expect(exportParams).toEqual(listParams);
    expect(listParams).toEqual({
      warehouseId: 'wh-1',
      status: 'shipped',
      orderSearch: 'OUT-1',
      createdFrom: '2026-02-01',
      createdTo: '2026-02-28',
      quickDirectedOnly: false,
    });
  });

  it('audit list and export share applied filters (paging may differ)', () => {
    const listParams = auditLogsFiltersToParams(appliedAudit, 50, 50);
    const exportParams = auditLogsFiltersToParams(appliedAudit, 500, 0);
    const { limit: _listLimit, offset: _listOffset, ...listFilters } = listParams;
    const { limit: _exportLimit, offset: _exportOffset, ...exportFilters } = exportParams;
    expect(exportFilters).toEqual(listFilters);
    expect(exportParams.search).toBe('login');
    expect(exportParams.date_from).toBe('2026-03-01');
    expect(exportParams.limit).toBe(500);
    expect(exportParams.offset).toBe(0);
  });
});
