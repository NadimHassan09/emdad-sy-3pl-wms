import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InboundSourceType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'node:crypto';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CreateInboundOrderDto } from './dto/create-inbound.dto';
import { ListInboundQueryDto } from './dto/list-inbound-query.dto';
import {
  cell,
  inboundImportTemplateCsv,
  mapCsvHeaderRow,
  parseCsv,
  rowsToCsv,
  type InboundImportCsvHeader,
} from './inbound-orders-csv.util';
import { InboundService } from './inbound.service';

export const INBOUND_EXPORT_MAX_ROWS = 10_000;
export const INBOUND_IMPORT_MAX_ROWS = 2_000;
export const INBOUND_IMPORT_MAX_ORDERS = 500;

export type InboundImportRowError = {
  rowNumber: number;
  externalReference: string | null;
  reason: string;
};

export type InboundImportValidateResult = {
  batchId: string;
  totalRows: number;
  orderCount: number;
  validOrders: number;
  invalidOrders: number;
  duplicateInFile: number;
  duplicateInDb: number;
  errors: InboundImportRowError[];
  _validPayloads?: Array<{
    externalReference: string;
    companyId: string;
    dto: CreateInboundOrderDto;
    sourceRowNumbers: number[];
  }>;
};

export type InboundImportExecuteResult = {
  batchId: string;
  imported: number;
  failed: number;
  skippedDuplicates: number;
  createdOrderNumbers: string[];
  errors: InboundImportRowError[];
};

type ParsedOrderGroup = {
  externalReference: string;
  companyIdRaw: string;
  sourceRowNumbers: number[];
  headerRow: number;
  fields: Record<string, string>;
  lines: Array<{
    sku: string;
    expectedQuantity: string;
    expectedLotNumber: string;
    expectedExpiryDate: string;
    rowNumber: number;
  }>;
};

@Injectable()
export class InboundOrdersCsvService {
  constructor(private readonly inbound: InboundService) {}

  getImportTemplate(): { filename: string; body: string } {
    return {
      filename: 'inbound-orders-import-template.csv',
      body: inboundImportTemplateCsv(),
    };
  }

  async exportCsv(
    user: AuthPrincipal,
    query: ListInboundQueryDto,
  ): Promise<{ filename: string; body: string; rowCount: number; truncated: boolean }> {
    const { items, total, truncated } = await this.inbound.listForExport(user, query, {
      maxRows: INBOUND_EXPORT_MAX_ROWS,
    });

    const headers = [
      'order_number',
      'status',
      'company_id',
      'company_name',
      'external_reference',
      'client_reference',
      'expected_arrival_date',
      'source_type',
      'store_channel',
      'notes',
      'line_count',
      'total_expected_quantity',
      'execution_mode',
      'created_at',
      'confirmed_at',
      'completed_at',
    ];

    const rows = items.map((o) => {
      const lineCount = o.lines?.length ?? 0;
      const totalQty = (o.lines ?? []).reduce(
        (sum, l) => sum + Number(l.expectedQuantity ?? 0),
        0,
      );
      return [
        o.orderNumber,
        o.status,
        o.companyId,
        o.company?.name ?? '',
        o.externalReference ?? '',
        o.clientReference ?? '',
        o.expectedArrivalDate ? new Date(o.expectedArrivalDate).toISOString().slice(0, 10) : '',
        o.sourceType ?? '',
        o.storeChannel ?? '',
        o.notes ?? '',
        lineCount,
        totalQty,
        o.executionMode ?? '',
        o.createdAt ? new Date(o.createdAt).toISOString() : '',
        o.confirmedAt ? new Date(o.confirmedAt).toISOString() : '',
        o.completedAt ? new Date(o.completedAt).toISOString() : '',
      ];
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `inbound-orders-${stamp}.csv`,
      body: rowsToCsv(headers, rows),
      rowCount: items.length,
      truncated: truncated || total > items.length,
    };
  }

  async validateImport(
    user: AuthPrincipal,
    fileBuffer: Buffer,
  ): Promise<InboundImportValidateResult> {
    const parsed = this.parseAndGroup(fileBuffer);
    return this.validateGroups(user, parsed.groups, parsed.totalRows);
  }

  async executeImport(
    user: AuthPrincipal,
    fileBuffer: Buffer,
  ): Promise<InboundImportExecuteResult> {
    const parsed = this.parseAndGroup(fileBuffer);
    const validated = await this.validateGroups(user, parsed.groups, parsed.totalRows);
    const batchId = validated.batchId;
    const createdOrderNumbers: string[] = [];
    const errors: InboundImportRowError[] = [...validated.errors];
    let imported = 0;
    let failed = 0;
    const skippedDuplicates = validated.duplicateInDb + validated.duplicateInFile;

    for (const payload of validated._validPayloads ?? []) {
      try {
        const created = await this.inbound.create(user, payload.dto);
        imported++;
        createdOrderNumbers.push(created.orderNumber);
      } catch (err) {
        failed++;
        const reason = err instanceof Error ? err.message : 'Create failed.';
        errors.push({
          rowNumber: payload.sourceRowNumbers[0] ?? 0,
          externalReference: payload.externalReference,
          reason,
        });
      }
    }

    return {
      batchId,
      imported,
      failed: failed + validated.invalidOrders,
      skippedDuplicates,
      createdOrderNumbers,
      errors,
    };
  }

  private parseAndGroup(fileBuffer: Buffer): {
    totalRows: number;
    groups: ParsedOrderGroup[];
  } {
    if (fileBuffer.byteLength > 5 * 1024 * 1024) {
      throw new PayloadTooLargeException('CSV file must be 5 MB or smaller.');
    }
    const text = fileBuffer.toString('utf8');
    const table = parseCsv(text);
    if (table.length < 2) {
      throw new BadRequestException('CSV must include a header row and at least one data row.');
    }
    const { indexByHeader, unknown } = mapCsvHeaderRow(table[0]);
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown CSV column(s): ${unknown.slice(0, 8).join(', ')}. Download the template for the supported format.`,
      );
    }
    const requiredHeaders: InboundImportCsvHeader[] = [
      'external_reference',
      'expected_arrival_date',
      'product_sku',
      'expected_quantity',
    ];
    for (const h of requiredHeaders) {
      if (indexByHeader[h] == null) {
        throw new BadRequestException(`Missing required CSV column: ${h}.`);
      }
    }

    const dataRows = table.slice(1);
    if (dataRows.length > INBOUND_IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `CSV has ${dataRows.length} data rows; maximum is ${INBOUND_IMPORT_MAX_ROWS}.`,
      );
    }

    const groups = new Map<string, ParsedOrderGroup>();
    dataRows.forEach((cells, idx) => {
      const rowNumber = idx + 2;
      const externalReference = cell(cells, indexByHeader, 'external_reference');
      const companyIdRaw = cell(cells, indexByHeader, 'company_id');
      const sku = cell(cells, indexByHeader, 'product_sku');
      const expectedQuantity = cell(cells, indexByHeader, 'expected_quantity');
      const expectedLotNumber = cell(cells, indexByHeader, 'expected_lot_number');
      const expectedExpiryDate = cell(cells, indexByHeader, 'expected_expiry_date');
      const key = `${companyIdRaw.trim().toLowerCase()}::${externalReference.trim().toLowerCase()}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          externalReference,
          companyIdRaw,
          sourceRowNumbers: [],
          headerRow: rowNumber,
          fields: {
            expected_arrival_date: cell(cells, indexByHeader, 'expected_arrival_date'),
            client_reference: cell(cells, indexByHeader, 'client_reference'),
            notes: cell(cells, indexByHeader, 'notes'),
            source_type: cell(cells, indexByHeader, 'source_type'),
            store_channel: cell(cells, indexByHeader, 'store_channel'),
          },
          lines: [],
        };
        groups.set(key, group);
      }
      group.sourceRowNumbers.push(rowNumber);
      group.lines.push({
        sku,
        expectedQuantity,
        expectedLotNumber,
        expectedExpiryDate,
        rowNumber,
      });
    });

    if (groups.size > INBOUND_IMPORT_MAX_ORDERS) {
      throw new BadRequestException(
        `CSV has ${groups.size} orders; maximum is ${INBOUND_IMPORT_MAX_ORDERS}.`,
      );
    }

    return { totalRows: dataRows.length, groups: [...groups.values()] };
  }

  private async validateGroups(
    user: AuthPrincipal,
    groups: ParsedOrderGroup[],
    totalRows: number,
  ): Promise<InboundImportValidateResult> {
    const batchId = randomUUID();
    const errors: InboundImportRowError[] = [];
    const duplicateInFile = 0;
    let duplicateInDb = 0;
    const validPayloads: NonNullable<InboundImportValidateResult['_validPayloads']> = [];

    for (const g of groups) {
      const ref = g.externalReference.trim();
      if (!ref) {
        errors.push({
          rowNumber: g.headerRow,
          externalReference: null,
          reason: 'external_reference is required.',
        });
        continue;
      }

      let companyId: string;
      try {
        companyId = this.inbound.resolveImportCompanyId(user, g.companyIdRaw || undefined);
      } catch (err) {
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: err instanceof Error ? err.message : 'Invalid company_id.',
        });
        continue;
      }

      const existing = await this.inbound.findByExternalReference(user, companyId, ref);
      if (existing) {
        duplicateInDb++;
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: `Order with external_reference "${ref}" already exists (${existing.orderNumber}).`,
        });
        continue;
      }

      const skus = [...new Set(g.lines.map((l) => l.sku.trim().toUpperCase()).filter(Boolean))];
      if (skus.length === 0) {
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: 'At least one product_sku is required.',
        });
        continue;
      }

      const products = await this.inbound.findProductsBySkus(companyId, skus);
      const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
      const lineDtos: CreateInboundOrderDto['lines'] = [];
      let lineFailed = false;
      for (const line of g.lines) {
        const sku = line.sku.trim();
        if (!sku) {
          errors.push({
            rowNumber: line.rowNumber,
            externalReference: ref,
            reason: 'product_sku is required.',
          });
          lineFailed = true;
          continue;
        }
        const product = bySku.get(sku.toUpperCase());
        if (!product) {
          errors.push({
            rowNumber: line.rowNumber,
            externalReference: ref,
            reason: `Product "${sku}" not found for this company.`,
          });
          lineFailed = true;
          continue;
        }
        const qty = Number(line.expectedQuantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          errors.push({
            rowNumber: line.rowNumber,
            externalReference: ref,
            reason: `Invalid expected_quantity "${line.expectedQuantity}" for product "${sku}".`,
          });
          lineFailed = true;
          continue;
        }
        lineDtos.push({
          productId: product.id,
          expectedQuantity: qty,
          expectedLotNumber: line.expectedLotNumber.trim() || undefined,
          expectedExpiryDate: line.expectedExpiryDate.trim() || undefined,
        });
      }
      if (lineFailed || lineDtos.length === 0) continue;

      const sourceRaw = g.fields.source_type.trim().toLowerCase();
      let sourceType: InboundSourceType | undefined;
      if (sourceRaw) {
        if (!Object.values(InboundSourceType).includes(sourceRaw as InboundSourceType)) {
          errors.push({
            rowNumber: g.headerRow,
            externalReference: ref,
            reason: `Invalid source_type "${g.fields.source_type}" (purchase|return|transfer).`,
          });
          continue;
        }
        sourceType = sourceRaw as InboundSourceType;
      }

      const plain = {
        companyId,
        expectedArrivalDate: g.fields.expected_arrival_date,
        clientReference: g.fields.client_reference || undefined,
        notes: g.fields.notes || undefined,
        sourceType,
        storeChannel: g.fields.store_channel || 'csv_import',
        externalReference: ref,
        executionMode: 'workers' as const,
        lines: lineDtos,
      };

      const dto = plainToInstance(CreateInboundOrderDto, plain);
      const dtoErrors = validateSync(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (dtoErrors.length > 0) {
        const msg = dtoErrors
          .flatMap((e) => Object.values(e.constraints ?? {}))
          .join('; ');
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: msg || 'Order failed validation.',
        });
        continue;
      }

      try {
        await this.inbound.assertImportCreateReady(user, dto);
      } catch (err) {
        errors.push({
          rowNumber: g.headerRow,
          externalReference: ref,
          reason: err instanceof Error ? err.message : 'Order failed business validation.',
        });
        continue;
      }

      validPayloads.push({
        externalReference: ref,
        companyId,
        dto,
        sourceRowNumbers: g.sourceRowNumbers,
      });
    }

    return {
      batchId,
      totalRows,
      orderCount: groups.length,
      validOrders: validPayloads.length,
      invalidOrders: groups.length - validPayloads.length,
      duplicateInFile,
      duplicateInDb,
      errors,
      _validPayloads: validPayloads,
    };
  }
}
