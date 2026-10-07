import { apiClient } from './apiClient';

export type ClientOrderImportError = {
  rowNumber: number;
  orderNumber: string | null;
  error: string;
  field?: string | null;
};

export type ClientOrderImportSummary = {
  batchId: string;
  totalRows: number;
  ordersDetected: number;
  created: number;
  incomplete: number;
  invalid: number;
  duplicate: number;
  createdOrderNumbers: string[];
  incompleteOrderNumbers: string[];
  errors: ClientOrderImportError[];
};

export type ClientOrderImportKind = 'oms' | 'inbound' | 'outbound';

const TEMPLATE_PATH: Record<ClientOrderImportKind, string> = {
  oms: '/oms/orders/import/template',
  inbound: '/inbound-orders/import/template',
  outbound: '/outbound-orders/import/template',
};

const IMPORT_PATH: Record<ClientOrderImportKind, string> = {
  oms: '/oms/orders/import',
  inbound: '/inbound-orders/import',
  outbound: '/outbound-orders/import',
};

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function errorsToCsv(errors: ClientOrderImportError[]): string {
  const lines = ['row_number,order_number,field,error'];
  for (const e of errors) {
    const order = (e.orderNumber ?? '').replace(/"/g, '""');
    const field = (e.field ?? '').replace(/"/g, '""');
    const error = e.error.replace(/"/g, '""');
    lines.push(`${e.rowNumber},"${order}","${field}","${error}"`);
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadImportErrors(kind: ClientOrderImportKind, errors: ClientOrderImportError[]): void {
  triggerDownload(
    new Blob([errorsToCsv(errors)], { type: 'text/csv;charset=utf-8' }),
    `${kind}-import-errors.csv`,
  );
}

export async function downloadClientImportTemplate(kind: ClientOrderImportKind): Promise<void> {
  const response = await apiClient.get<Blob>(TEMPLATE_PATH[kind], { responseType: 'blob' });
  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `${kind}-orders-import-template.csv`;
  triggerDownload(response.data, filename);
}

export async function importClientOrders(
  kind: ClientOrderImportKind,
  file: File,
): Promise<ClientOrderImportSummary> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<ClientOrderImportSummary>(IMPORT_PATH[kind], form);
  return data;
}
