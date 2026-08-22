import { BadRequestException } from '@nestjs/common';

import { normalizeHeader } from '../../oms/oms-orders-csv.util';
import {
  CLIENT_IMPORT_MAX_ORDERS,
  CLIENT_IMPORT_MAX_ROWS,
} from './order-import.limits';
import type { GroupedImportOrder, SpreadsheetRow } from './order-import.types';

export type HeaderAliasMap = Record<string, readonly string[]>;

export function normalizeCompare(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function mapHeaderRow(
  headerRow: string[],
  aliasMap: HeaderAliasMap,
): { indexByField: Record<string, number>; unknown: string[] } {
  const aliasToCanonical = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(aliasMap)) {
    aliasToCanonical.set(normalizeHeader(canonical), canonical);
    for (const alias of aliases) {
      aliasToCanonical.set(normalizeHeader(alias), canonical);
    }
  }
  const indexByField: Record<string, number> = {};
  const unknown: string[] = [];
  headerRow.forEach((raw, idx) => {
    const key = normalizeHeader(raw);
    if (!key) return;
    const canonical = aliasToCanonical.get(key);
    if (!canonical) {
      unknown.push(raw.trim());
      return;
    }
    if (indexByField[canonical] == null) indexByField[canonical] = idx;
  });
  return { indexByField, unknown };
}

export function rowValues(
  cells: string[],
  indexByField: Record<string, number>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [field, idx] of Object.entries(indexByField)) {
    values[field] = (cells[idx] ?? '').trim();
  }
  return values;
}

export function assertImportTable(
  table: string[][],
  aliasMap: HeaderAliasMap,
  requiredFields: string[],
): { indexByField: Record<string, number>; dataRows: SpreadsheetRow[] } {
  if (table.length < 2) {
    throw new BadRequestException(
      'Import file must include a header row and at least one data row.',
    );
  }
  const { indexByField } = mapHeaderRow(table[0] ?? [], aliasMap);
  for (const field of requiredFields) {
    if (indexByField[field] == null) {
      throw new BadRequestException(
        `Missing required column: ${field}. Download the import template for the supported format.`,
      );
    }
  }
  const dataRows: SpreadsheetRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i] ?? [];
    if (!cells.some((c) => c.trim() !== '')) continue;
    dataRows.push({ rowNumber: i + 1, values: rowValues(cells, indexByField) });
  }
  if (dataRows.length === 0) {
    throw new BadRequestException('Import file has no data rows.');
  }
  if (dataRows.length > CLIENT_IMPORT_MAX_ROWS) {
    throw new BadRequestException(
      `Import has ${dataRows.length} data rows; maximum is ${CLIENT_IMPORT_MAX_ROWS}.`,
    );
  }
  return { indexByField, dataRows };
}

/**
 * Group spreadsheet rows by external order number.
 * Blank order-level fields inherit from the first populated value.
 * Conflicting populated values reject the whole order.
 */
export function groupRowsByOrderNumber(
  rows: SpreadsheetRow[],
  orderNumberField: string,
  orderLevelFields: readonly string[],
): GroupedImportOrder[] {
  const groups = new Map<string, GroupedImportOrder>();
  const order: string[] = [];

  for (const row of rows) {
    const orderNumber = row.values[orderNumberField]?.trim() ?? '';
    if (!orderNumber) {
      const orphan: GroupedImportOrder = {
        orderNumber: '',
        rowNumbers: [row.rowNumber],
        fields: { ...row.values },
        lines: [row],
        conflict: { field: orderNumberField, error: 'Order number is required.' },
      };
      groups.set(`__missing__:${row.rowNumber}`, orphan);
      order.push(`__missing__:${row.rowNumber}`);
      continue;
    }
    const key = normalizeCompare(orderNumber);
    let group = groups.get(key);
    if (!group) {
      group = {
        orderNumber,
        rowNumbers: [],
        fields: {},
        lines: [],
      };
      groups.set(key, group);
      order.push(key);
    }
    group.rowNumbers.push(row.rowNumber);
    group.lines.push(row);
    if (group.conflict) continue;

    for (const field of orderLevelFields) {
      const incoming = (row.values[field] ?? '').trim();
      if (!incoming) continue;
      const existing = (group.fields[field] ?? '').trim();
      if (!existing) {
        group.fields[field] = incoming;
        continue;
      }
      if (normalizeCompare(existing) !== normalizeCompare(incoming)) {
        group.conflict = {
          field,
          error: `Conflicting ${field} for order ${orderNumber}: "${existing}" vs "${incoming}".`,
        };
      }
    }
  }

  if (groups.size > CLIENT_IMPORT_MAX_ORDERS) {
    throw new BadRequestException(
      `Import has ${groups.size} orders; maximum is ${CLIENT_IMPORT_MAX_ORDERS}.`,
    );
  }

  return order.map((k) => groups.get(k)!);
}
