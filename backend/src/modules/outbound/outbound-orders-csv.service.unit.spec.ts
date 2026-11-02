import { AuthPrincipal } from '../../common/auth/current-user.types';
import { OutboundOrdersCsvService } from './outbound-orders-csv.service';
import { OutboundService } from './outbound.service';

describe('OutboundOrdersCsvService (Validation Parity & Partial Import)', () => {
  let service: OutboundOrdersCsvService;
  let mockOutbound: jest.Mocked<Partial<OutboundService>>;

  const mockUser: AuthPrincipal = {
    id: 'user-admin-1',
    role: 'super_admin',
    companyId: 'a0000000-0000-4000-8000-000000000001',
    tenantScope: 'all',
    authorizedCompanyIds: ['a0000000-0000-4000-8000-000000000001'],
  };

  const PROD_DISCRETE = '11111111-1111-4111-8111-111111111111';
  const PROD_CONT = '22222222-2222-4222-8222-222222222222';
  const PROD_ANOTHER = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    mockOutbound = {
      resolveImportCompanyId: jest.fn().mockReturnValue('a0000000-0000-4000-8000-000000000001'),
      findByExternalReference: jest.fn().mockResolvedValue(null),
      assertImportCreateReady: jest.fn().mockResolvedValue(undefined),
      findProductsBySkus: jest.fn().mockImplementation(async (companyId, skus: string[]) => {
        const catalog: Record<string, { id: string; sku: string; uom: 'piece' | 'kg' | 'box' }> = {
          'DISCRETE-SKU': { id: PROD_DISCRETE, sku: 'DISCRETE-SKU', uom: 'piece' },
          'CONT-SKU': { id: PROD_CONT, sku: 'CONT-SKU', uom: 'kg' },
          'ANOTHER-SKU': { id: PROD_ANOTHER, sku: 'ANOTHER-SKU', uom: 'box' },
        };
        return skus.map((s) => catalog[s]).filter(Boolean);
      }),
      create: jest.fn().mockImplementation(async (user, dto) => ({
        id: 'out-1',
        orderNumber: `OUT-${dto.externalReference}`,
      })),
    };

    service = new OutboundOrdersCsvService(mockOutbound as unknown as OutboundService);
  });

  describe('F-07: External Reference Character Validation', () => {
    it('rejects external reference containing spaces, symbols, or Arabic letters', async () => {
      const csv = [
        'external_reference,product_sku,requested_quantity,destination_address,required_ship_date',
        'INV REF 123,DISCRETE-SKU,5,Damascus,2026-12-01',
        'INV#456,DISCRETE-SKU,5,Damascus,2026-12-01',
        'طلب-١٢٣,DISCRETE-SKU,5,Damascus,2026-12-01',
      ].join('\n');

      const result = await service.validateImport(mockUser, Buffer.from(csv));
      expect(result.validOrders).toBe(0);
      expect(result.invalidOrders).toBe(3);
      expect(result.errors.length).toBe(3);
      expect(result.errors[0].reason).toContain('English letters, English digits');
      expect(result.errors[1].reason).toContain('English letters, English digits');
      expect(result.errors[2].reason).toContain('English letters, English digits');
    });

    it('accepts valid alphanumeric-hyphen-underscore external reference', async () => {
      const csv = [
        'external_reference,product_sku,requested_quantity,destination_address,required_ship_date',
        'ORD-VALID_123,DISCRETE-SKU,5,Damascus,2026-12-01',
      ].join('\n');

      const result = await service.validateImport(mockUser, Buffer.from(csv));
      expect(result.errors).toEqual([]);
      expect(result.validOrders).toBe(1);
      expect(result.invalidOrders).toBe(0);
    });

    it('rejects order with missing or empty destination address', async () => {
      const csv = [
        'external_reference,product_sku,requested_quantity,destination_address,required_ship_date',
        'ORD-NO-DEST,DISCRETE-SKU,5,,2026-12-01',
        'ORD-SPACE-DEST,DISCRETE-SKU,5,   ,2026-12-01',
      ].join('\n');

      const result = await service.validateImport(mockUser, Buffer.from(csv));
      expect(result.validOrders).toBe(0);
      expect(result.invalidOrders).toBe(2);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.some((e) => e.reason.includes('Destination address is required'))).toBe(true);
    });
  });

  describe('F-03: Duplicate Product Lines in Single Order', () => {
    it('rejects an order containing the same product SKU on multiple lines', async () => {
      const csv = [
        'external_reference,product_sku,requested_quantity,destination_address,required_ship_date',
        'ORD-DUP-01,DISCRETE-SKU,2,Damascus,2026-12-01',
        'ORD-DUP-01,DISCRETE-SKU,3,Damascus,2026-12-01',
      ].join('\n');

      const result = await service.validateImport(mockUser, Buffer.from(csv));
      expect(result.validOrders).toBe(0);
      expect(result.invalidOrders).toBe(1);
      expect(result.errors.some((e) => e.reason.includes('Duplicate product line'))).toBe(true);
    });

    it('accepts an order with distinct product SKUs', async () => {
      const csv = [
        'external_reference,product_sku,requested_quantity,destination_address,required_ship_date',
        'ORD-MULTI-01,DISCRETE-SKU,2,Damascus,2026-12-01',
        'ORD-MULTI-01,ANOTHER-SKU,3,Damascus,2026-12-01',
      ].join('\n');

      const result = await service.validateImport(mockUser, Buffer.from(csv));
      expect(result.errors).toEqual([]);
      expect(result.validOrders).toBe(1);
      expect(result.invalidOrders).toBe(0);
    });
  });

  describe('F-06: UOM-Aware Quantity Validation', () => {
    it('rejects fractional quantity for discrete UOM (e.g. piece)', async () => {
      const csv = [
        'external_reference,product_sku,requested_quantity,destination_address,required_ship_date',
        'ORD-FRAC-01,DISCRETE-SKU,2.5,Damascus,2026-12-01',
      ].join('\n');

      const result = await service.validateImport(mockUser, Buffer.from(csv));
      expect(result.validOrders).toBe(0);
      expect(result.invalidOrders).toBe(1);
      expect(result.errors.some((e) => e.reason.includes('must be a whole number'))).toBe(true);
    });

    it('accepts fractional quantity for continuous UOM (e.g. kg) up to 4 decimal places', async () => {
      const csv = [
        'external_reference,product_sku,requested_quantity,destination_address,required_ship_date',
        'ORD-CONT-01,CONT-SKU,2.1255,Damascus,2026-12-01',
      ].join('\n');

      const result = await service.validateImport(mockUser, Buffer.from(csv));
      expect(result.errors).toEqual([]);
      expect(result.validOrders).toBe(1);
      expect(result.invalidOrders).toBe(0);
    });

    it('rejects continuous UOM exceeding 4 decimal places', async () => {
      const csv = [
        'external_reference,product_sku,requested_quantity,destination_address,required_ship_date',
        'ORD-CONT-02,CONT-SKU,2.12345,Damascus,2026-12-01',
      ].join('\n');

      const result = await service.validateImport(mockUser, Buffer.from(csv));
      expect(result.validOrders).toBe(0);
      expect(result.invalidOrders).toBe(1);
      expect(result.errors.some((e) => e.reason.includes('4 decimal places'))).toBe(true);
    });
  });

  describe('F-02: Partial Import Behavior Preservation', () => {
    it('processes valid orders and reports errors for invalid orders without failing the entire batch', async () => {
      const csv = [
        'external_reference,product_sku,requested_quantity,destination_address,required_ship_date',
        // Order 1: Invalid external reference (contains space)
        'BAD REF,DISCRETE-SKU,2,Damascus,2026-12-01',
        // Order 2: Valid order
        'GOOD-ORDER-1,DISCRETE-SKU,5,Damascus,2026-12-01',
        // Order 3: Duplicate SKU within order
        'BAD-ORDER-2,DISCRETE-SKU,1,Damascus,2026-12-01',
        'BAD-ORDER-2,DISCRETE-SKU,2,Damascus,2026-12-01',
        // Order 4: Valid continuous UOM order
        'GOOD-ORDER-2,CONT-SKU,10.5,Damascus,2026-12-01',
      ].join('\n');

      const fileBuffer = Buffer.from(csv);

      // 1. Validation phase
      const valResult = await service.validateImport(mockUser, fileBuffer);
      expect(valResult.totalRows).toBe(5);
      expect(valResult.orderCount).toBe(4);
      expect(valResult.validOrders).toBe(2);
      expect(valResult.invalidOrders).toBe(2);
      expect(valResult.errors.length).toBeGreaterThanOrEqual(2);

      // 2. Execution phase with fileBuffer
      const execResult = await service.executeImport(mockUser, fileBuffer);

      expect(execResult.imported).toBe(2);
      expect(execResult.failed).toBe(2);
      expect(execResult.createdOrderNumbers).toEqual(['OUT-GOOD-ORDER-1', 'OUT-GOOD-ORDER-2']);
      expect(mockOutbound.create).toHaveBeenCalledTimes(2);
    });
  });
});
