import { resolveRegistry } from './module-registry.data';

/**
 * Isolation invariants (Architecture 2.2):
 * - Client domain modules never imply another company's bump
 * - Admin domain is global (intentional)
 * - Domains are separate lists on each registry row
 */
describe('Module Registry dual domains', () => {
  it('InboundCreated declares both client and admin modules', () => {
    const row = resolveRegistry('InboundCreated');
    expect(row.client.length).toBeGreaterThan(0);
    expect(row.admin.length).toBeGreaterThan(0);
    expect(row.client).toContain('inbound');
    expect(row.admin).toContain('inbound');
  });

  it('TaskUpdated is admin-only (no client fan-out)', () => {
    const row = resolveRegistry('TaskUpdated');
    expect(row.client).toEqual([]);
    expect(row.admin).toContain('tasks');
  });

  it('unknown mutation resolves to empty domains (safe no-op)', () => {
    expect(resolveRegistry('DoesNotExist')).toEqual({ client: [], admin: [] });
  });

  it('WarehouseCreated is admin-only', () => {
    const row = resolveRegistry('WarehouseCreated');
    expect(row.client).toEqual([]);
    expect(row.admin.length).toBeGreaterThan(0);
  });
});
