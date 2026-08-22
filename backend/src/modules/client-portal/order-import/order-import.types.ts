export type ImportRowError = {
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
  errors: ImportRowError[];
};

export type SpreadsheetRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type GroupedImportOrder = {
  orderNumber: string;
  rowNumbers: number[];
  fields: Record<string, string>;
  lines: SpreadsheetRow[];
  conflict?: { field: string; error: string };
};
