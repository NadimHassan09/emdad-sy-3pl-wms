import { calendarTodayYmdServerLocal } from '../../../common/utils/order-planning-date';
import {
  parseImportMdYDate,
  validateImportOrderNumber,
} from '../order-import/oms-client-import.validation';
import { throwApiValidation } from './api-validation';

/** Accept YYYY-MM-DD or M/DD/YYYY for external APIs. */
export function parseExternalApiDate(
  raw: string,
  fieldName: string,
): string {
  const t = raw.trim();
  const iso = /^(\d{4}-\d{2}-\d{2})$/.exec(t);
  if (iso) {
    const ymd = iso[1]!;
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== m! - 1 ||
      dt.getUTCDate() !== d
    ) {
      throwApiValidation('Order payload is invalid.', {
        [fieldName]: `${fieldName} is not a valid calendar date.`,
      });
    }
    return ymd;
  }
  const mdY = parseImportMdYDate(t, fieldName);
  if (!mdY.ok) {
    throwApiValidation('Order payload is invalid.', {
      [fieldName]: mdY.message,
    });
  }
  return mdY.ymd;
}

export function assertExternalApiDateNotBeforeToday(ymd: string, fieldName: string): void {
  if (ymd < calendarTodayYmdServerLocal()) {
    throwApiValidation('Order payload is invalid.', {
      [fieldName]: `${fieldName} cannot be before today.`,
    });
  }
}

export function assertExternalOrderId(raw: string): string {
  const result = validateImportOrderNumber(raw);
  if (!result.ok) {
    throwApiValidation('Order payload is invalid.', {
      externalOrderId: result.message.replace(/^Order number/, 'externalOrderId'),
    });
  }
  return result.value;
}

export function assertUniqueSkus(skus: string[]): void {
  const seen = new Set<string>();
  for (const sku of skus) {
    const key = sku.trim().toUpperCase();
    if (!key) continue;
    if (seen.has(key)) {
      throwApiValidation('Order payload is invalid.', {
        sku: `Duplicate SKU "${sku}" in the same order. Each product can only appear once.`,
      });
    }
    seen.add(key);
  }
}
