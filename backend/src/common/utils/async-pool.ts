/**
 * Run async work over items with a fixed worker-pool size.
 * Failures are isolated per item; peers are never rolled back.
 */
export async function runPool<TItem, TOk, TFail>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem) => Promise<{ ok: true; value: TOk } | { ok: false; value: TFail }>,
): Promise<{ successes: TOk[]; failures: TFail[] }> {
  const successes: TOk[] = [];
  const failures: TFail[] = [];
  if (items.length === 0) return { successes, failures };

  const limit = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      const result = await worker(item);
      if (result.ok) successes.push(result.value);
      else failures.push(result.value);
    }
  });

  await Promise.all(runners);
  return { successes, failures };
}
