export async function runInChunks<T>(
  ids: string[],
  size: number,
  run: (chunk: string[]) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (let index = 0; index < ids.length; index += size) {
    results.push(await run(ids.slice(index, index + size)));
  }
  return results;
}
