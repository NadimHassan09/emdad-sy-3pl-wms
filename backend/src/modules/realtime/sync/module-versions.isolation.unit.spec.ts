/**
 * Dual-domain isolation invariants for Module Versions (Architecture 2.2).
 * Client company A bumps must not appear in company B snapshots.
 */
import { ModuleVersionsService } from './module-versions.service';

class MemRedis {
  enabled = false;
  isEnabled() {
    return this.enabled;
  }
}

describe('ModuleVersionsService isolation', () => {
  it('client bumps are per-company', async () => {
    const versions = new ModuleVersionsService(new MemRedis() as never);
    await versions.bumpClient('company-a', ['inbound', 'inventory']);
    await versions.bumpClient('company-b', ['outbound']);

    const a = await versions.snapshotClient('company-a');
    const b = await versions.snapshotClient('company-b');

    expect(a.moduleVersions.inbound).toBe(1);
    expect(a.moduleVersions.inventory).toBe(1);
    expect(a.moduleVersions.outbound).toBeUndefined();

    expect(b.moduleVersions.outbound).toBe(1);
    expect(b.moduleVersions.inbound).toBeUndefined();
    expect(b.sequence).toBe(1);
    expect(a.sequence).toBe(1);
  });

  it('admin bumps are global and independent of client stores', async () => {
    const versions = new ModuleVersionsService(new MemRedis() as never);
    await versions.bumpClient('company-a', ['inbound']);
    await versions.bumpAdmin(['inbound', 'dashboard']);

    const admin = await versions.snapshotAdmin();
    const client = await versions.snapshotClient('company-a');

    expect(admin.moduleVersions.inbound).toBe(1);
    expect(admin.moduleVersions.dashboard).toBe(1);
    expect(client.moduleVersions.inbound).toBe(1);
    expect(client.moduleVersions.dashboard).toBeUndefined();
  });
});
