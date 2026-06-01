// PostgREST `in.(...)` filters are passed in the request URL. With 100-200
// UUIDs, a single filter can run 3,000-7,000+ characters — long enough to be
// rejected by proxies/gateways that cap URL length (common caps: 2,048 or
// 8,192). Batching the IDs keeps every generated URL short.
export const MAX_IDS_PER_QUERY = 50;

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be greater than 0");
  if (items.length <= size) return items.length ? [items] : [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Runs `request` once per batch of ids and flattens the results. `request`
 * receives the ready-to-use `in.(...)` filter string for its batch, so each call
 * site keeps its exact select/order/fallback logic and only the filter value is
 * batched. Returns [] for an empty id list. Batches run concurrently.
 */
export async function fetchInBatches<T>(
  ids: string[],
  request: (inFilter: string) => Promise<T[]>,
  batchSize: number = MAX_IDS_PER_QUERY,
): Promise<T[]> {
  if (!ids.length) return [];
  const batches = chunkArray(ids, batchSize);
  const results = await Promise.all(batches.map((batch) => request(`in.(${batch.join(",")})`)));
  return results.flat();
}
