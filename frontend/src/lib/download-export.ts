import { api } from '../api/client';

export type ExportFormat = 'xlsx' | 'csv';

function filenameFromDisposition(disposition: unknown, fallback: string): string {
  const header = typeof disposition === 'string' ? disposition : '';
  const match = header.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

export function saveBlob(data: Blob, filename: string): void {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * GET a list-export endpoint (`?format=xlsx|csv` + the list filters) and save the file.
 * Empty / undefined filter values are dropped so the server sees exactly the list filters.
 */
export async function downloadListExport(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
  format: ExportFormat,
  fallbackBaseName: string,
): Promise<void> {
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    // Paging is irrelevant for an export of the full filtered set.
    if (key === 'limit' || key === 'offset' || key === 'page') continue;
    clean[key] = value;
  }
  const response = await api.get<Blob>(path, {
    params: { ...clean, format },
    responseType: 'blob',
  });
  const stamp = new Date().toISOString().slice(0, 10);
  saveBlob(
    response.data,
    filenameFromDisposition(
      response.headers['content-disposition'],
      `${fallbackBaseName}-${stamp}.${format}`,
    ),
  );
}
