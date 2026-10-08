import { runPool } from './async-pool';

describe('runPool', () => {
  it('runs with controlled concurrency and isolates failures', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);

    const { successes, failures } = await runPool(items, 5, async (n) => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 5));
      inflight--;
      if (n === 7) return { ok: false as const, value: n };
      return { ok: true as const, value: n * 2 };
    });

    expect(maxInflight).toBeLessThanOrEqual(5);
    expect(successes).toHaveLength(19);
    expect(failures).toEqual([7]);
  });
});
