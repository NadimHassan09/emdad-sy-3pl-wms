import { BadRequestException } from '@nestjs/common';
import { Prisma, OmsOrderStatus, OmsPaymentMethod, ProductUom } from '@prisma/client';

import { OmsOrdersService } from './oms-orders.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CreateOmsOrderDto } from './dto/oms-order.dto';

describe('OMS Orders Validation Parity (F-01, F-03, F-08)', () => {
  const mockUser: AuthPrincipal = {
    id: 'user-admin-1',
    companyId: 'co-1',
    role: 'super_admin',
    email: 'admin@emdad.test',
    tenantScope: 'restricted',
    authorizedCompanyIds: ['co-1'],
  };

  const validSyrianAddressDto: CreateOmsOrderDto = {
    companyId: 'co-1',
    requiredShipDate: '2026-11-15',
    recipientName: 'سامر الحلبي',
    recipientPhone: '0944123456',
    city: 'دمشق',
    district: 'دمشق',
    addressLine1: 'حي الروضة - دمشق',
    addressLine2: 'شارع فايز منصور - بناء 14 طابق 2',
    paymentMethod: OmsPaymentMethod.COD,
    lines: [
      {
        productId: 'prod-1',
        requestedQuantity: 2,
        unitPrice: 500,
      },
    ],
  };

  let mockPrisma: any;
  let mockCompanyAccess: any;
  let mockGeo: any;
  let service: OmsOrdersService;

  beforeEach(() => {
    mockPrisma = {
      product: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          const ids: string[] = where?.id?.in || [];
          return Promise.resolve(
            ids.map((id) => ({
              id,
              companyId: 'co-1',
              status: 'ACTIVE',
              uom: ProductUom.piece,
              sku: `SKU-${id}`,
              weightKg: 1,
              volumeCbm: 0.01,
            })),
          );
        }),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: 'co-1', name: 'Test Co' }),
      },
      omsOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: 'oms-order-1',
            companyId: 'co-1',
            orderNumber: 'ORD-99999',
            status: OmsOrderStatus.waiting_for_confirmation,
            recipientName: 'سامر الحلبي',
            recipientPhone: '0944123456',
            city: 'دمشق',
            district: 'دمشق',
            addressLine1: 'حي الروضة - دمشق',
            addressLine2: 'شارع فايز منصور - بناء 14 طابق 2',
            paymentMethod: OmsPaymentMethod.COD,
            subtotal: new Prisma.Decimal(1000),
            codAmount: new Prisma.Decimal(1000),
            codStatus: null,
            needsInformation: false,
            lines: [
              {
                id: 'line-1',
                productId: 'prod-1',
                requestedQuantity: new Prisma.Decimal(2),
                unitPrice: new Prisma.Decimal(500),
                lineTotal: new Prisma.Decimal(1000),
                product: { id: 'prod-1', weightKg: new Prisma.Decimal(1), volumeCbm: new Prisma.Decimal(0.01) },
              },
            ],
          }),
        ),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        const existingRecord = {
          id: 'oms-order-1',
          companyId: 'co-1',
          orderNumber: 'ORD-99999',
          status: OmsOrderStatus.waiting_for_confirmation,
          recipientName: 'سامر الحلبي',
          recipientPhone: '0944123456',
          city: 'دمشق',
          district: 'دمشق',
          addressLine1: 'حي الروضة - دمشق',
          addressLine2: 'شارع فايز منصور - بناء 14 طابق 2',
          paymentMethod: OmsPaymentMethod.COD,
          subtotal: new Prisma.Decimal(1000),
          codAmount: new Prisma.Decimal(1000),
          codStatus: null,
          needsInformation: false,
          lines: [
            {
              id: 'line-1',
              productId: 'prod-1',
              requestedQuantity: new Prisma.Decimal(2),
              unitPrice: new Prisma.Decimal(500),
              lineTotal: new Prisma.Decimal(1000),
              product: { id: 'prod-1', weightKg: new Prisma.Decimal(1), volumeCbm: new Prisma.Decimal(0.01) },
            },
          ],
        };
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(0),
          omsOrder: {
            findUnique: jest.fn().mockResolvedValue(existingRecord),
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockImplementation(({ data }: any) =>
              Promise.resolve({
                ...existingRecord,
                ...data,
              }),
            ),
            create: jest.fn().mockImplementation(({ data }: any) =>
              Promise.resolve({
                id: 'oms-order-1',
                orderNumber: data.orderNumber || 'ORD-99999',
                status: OmsOrderStatus.waiting_for_confirmation,
                ...data,
                lines: (data.lines?.create || []).map((l: any, idx: number) => ({
                  id: `line-${idx + 1}`,
                  ...l,
                  product: {
                    id: l.productId,
                    sku: `SKU-${l.productId}`,
                    name: 'Test Product',
                    uom: ProductUom.piece,
                  },
                })),
              }),
            ),
          },
          omsOrderEvent: {
            create: jest.fn().mockResolvedValue({ id: 'event-1' }),
          },
        };
        return callback(tx);
      }),
    };

    mockCompanyAccess = {
      resolveWriteCompanyId: jest.fn().mockReturnValue('co-1'),
      validateResourceOwnership: jest.fn().mockReturnValue(undefined),
    };

    mockGeo = {
      lookupBoundary: jest.fn().mockResolvedValue(null),
      containsPoint: jest.fn().mockReturnValue(false),
      findGovernorateByName: jest.fn().mockResolvedValue(null),
      findCityByName: jest.fn().mockResolvedValue(null),
    };

    service = Object.create(OmsOrdersService.prototype);
    Object.assign(service, {
      prisma: mockPrisma,
      companyAccess: mockCompanyAccess,
      geo: mockGeo,
      outbound: {
        findById: jest.fn().mockResolvedValue({
          id: 'out-1',
          companyId: 'co-1',
          destinationAddress: 'دمشق',
        }),
      },
      billingAccess: {
        assertOperationalBilling: jest.fn().mockResolvedValue(undefined),
      },
      allocation: {},
      events: {
        record: jest.fn().mockResolvedValue(undefined),
      },
      sync: {},
      realtime: {},
      cod: {},
      shipping: {
        assertLiveCarrierSelection: jest.fn().mockResolvedValue(undefined),
      },
      shippingTracking: {},
      autoReturn: {},
      shippingFees: {
        syncClientRate: jest.fn().mockResolvedValue({ applied: false }),
      },
      emitOms: jest.fn(),
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
  });

  describe('F-01: Canonical Geographic Validation', () => {
    it('rejects fabricated / unknown governorate', async () => {
      const dto: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        city: 'المريخ', // Mars / fabricated
      };

      await expect(service.create(mockUser, dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(mockUser, dto)).rejects.toThrow(/Unknown governorate/i);
    });

    it('rejects mismatched city/district for valid governorate', async () => {
      const dto: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        city: 'دمشق',
        district: 'أتارب', // Atarib is in Aleppo, not Damascus
      };

      await expect(service.create(mockUser, dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(mockUser, dto)).rejects.toThrow(/Unknown city\/area/i);
    });

    it('rejects fabricated / unknown neighborhood', async () => {
      const dto: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        city: 'دمشق',
        district: 'دمشق',
        addressLine1: 'حي غير موجود إطلاقا 12345',
      };

      await expect(service.create(mockUser, dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(mockUser, dto)).rejects.toThrow(/Unknown neighborhood/i);
    });

    it('resolves canonical hierarchy and persists resolved values for valid address', async () => {
      const result = await service.create(mockUser, validSyrianAddressDto);

      expect(result).toBeDefined();
      expect(result.city).toBe('دمشق');
      expect(result.district).toBe('دمشق');
      expect(result.addressLine1).toBe('حي الروضة - دمشق');
      expect(result.destinationAddress).toContain('حي الروضة - دمشق');
    });

    it('rejects update with fabricated / unknown governorate', async () => {
      await expect(
        service.update('oms-order-1', mockUser, { city: 'المريخ' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('oms-order-1', mockUser, { city: 'المريخ' }),
      ).rejects.toThrow(/Unknown governorate/i);
    });

    it('rejects update with mismatched city/district for valid governorate', async () => {
      await expect(
        service.update('oms-order-1', mockUser, { city: 'دمشق', district: 'أتارب' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('oms-order-1', mockUser, { city: 'دمشق', district: 'أتارب' }),
      ).rejects.toThrow(/Unknown city\/area/i);
    });

    it('rejects update with fabricated / unknown neighborhood', async () => {
      await expect(
        service.update('oms-order-1', mockUser, {
          city: 'دمشق',
          district: 'دمشق',
          addressLine1: 'حي غير موجود إطلاقا',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('oms-order-1', mockUser, {
          city: 'دمشق',
          district: 'دمشق',
          addressLine1: 'حي غير موجود إطلاقا',
        }),
      ).rejects.toThrow(/Unknown neighborhood/i);
    });

    it('resolves canonical hierarchy and updates order for valid address update', async () => {
      const result = await service.update('oms-order-1', mockUser, {
        city: 'دمشق',
        district: 'دمشق',
        addressLine1: 'أبو رمانة',
        addressLine2: 'شارع الجلاء - بناء 10 طابق 3',
      });

      expect(result).toBeDefined();
      expect(result.city).toBe('دمشق');
      expect(result.district).toBe('دمشق');
      expect(result.addressLine1).toBe('أبو رمانة');
    });
  });

  describe('F-03: Duplicate Product Lines Validation', () => {
    it('rejects duplicate product lines within the same order', async () => {
      const dtoWithDuplicates: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        lines: [
          {
            productId: 'prod-1',
            requestedQuantity: 2,
            unitPrice: 500,
          },
          {
            productId: 'prod-1', // Duplicate productId!
            requestedQuantity: 3,
            unitPrice: 500,
          },
        ],
      };

      await expect(service.create(mockUser, dtoWithDuplicates)).rejects.toThrow(BadRequestException);
      await expect(service.create(mockUser, dtoWithDuplicates)).rejects.toThrow(
        /Duplicate product line/i,
      );
    });

    it('accepts distinct product lines', async () => {
      const dtoDistinct: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        lines: [
          {
            productId: 'prod-1',
            requestedQuantity: 2,
            unitPrice: 500,
          },
          {
            productId: 'prod-2',
            requestedQuantity: 1,
            unitPrice: 750,
          },
        ],
      };

      const result = await service.create(mockUser, dtoDistinct);
      expect(result).toBeDefined();
      expect(result.lines).toHaveLength(2);
    });
  });

  describe('F-08: Server-Calculated Financial Fields', () => {
    it('calculates line totals, subtotal, and codAmount authoritatively server-side', async () => {
      const dto: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        lines: [
          {
            productId: 'prod-1',
            requestedQuantity: 3,
            unitPrice: 1500,
          },
          {
            productId: 'prod-2',
            requestedQuantity: 2,
            unitPrice: 2000,
          },
        ],
      };

      const result = await service.create(mockUser, dto);

      // Line 1: 3 * 1500 = 4500
      // Line 2: 2 * 2000 = 4000
      // Subtotal: 4500 + 4000 = 8500
      // PaymentMethod is COD -> codAmount = 8500
      expect(result.subtotal?.toString()).toBe('8500');
      expect(result.codAmount?.toString()).toBe('8500');

      const line1 = result.lines.find((l: any) => l.productId === 'prod-1');
      const line2 = result.lines.find((l: any) => l.productId === 'prod-2');
      expect(line1?.lineTotal?.toString()).toBe('4500');
      expect(line2?.lineTotal?.toString()).toBe('4000');
    });
  });

  describe('FINDING-PARITY-01: Operational Billing Enforcement', () => {
    it('blocks OMS order creation when billing access is restricted or expired', async () => {
      (service as any).billingAccess.assertOperationalBilling.mockRejectedValueOnce(
        new BadRequestException('Billing plan expired or restricted.'),
      );

      await expect(service.create(mockUser, validSyrianAddressDto)).rejects.toThrow(
        /Billing plan expired or restricted/,
      );
    });
  });

  describe('FINDING-PARITY-02: Geographic Hierarchy with Linked Outbound Order', () => {
    it('rejects invalid geographic hierarchy even when outboundOrderId is linked', async () => {
      const dtoWithLinkedOutbound: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        outboundOrderId: 'out-1',
        city: 'اللاذقية',
        district: 'دمشق', // Mismatched hierarchy!
        addressLine1: 'حي الروضة - دمشق',
      };

      await expect(service.create(mockUser, dtoWithLinkedOutbound)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('FINDING-PARITY-08: Client-Supplied Coordinates Validation', () => {
    it('rejects client coordinates that are far outside the resolved delivery location', async () => {
      const dtoWithBogusCoords: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        shippingReceiverLat: 52.5200, // Berlin, Germany
        shippingReceiverLng: 13.4050,
      };

      await expect(service.create(mockUser, dtoWithBogusCoords)).rejects.toThrow(
        /Supplied coordinates.*do not match the resolved delivery location/,
      );
    });

    it('accepts coordinates consistent with the resolved delivery location', async () => {
      // Damascus centroid is around lat: 33.5138, lng: 36.2765
      const dtoWithValidCoords: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        shippingReceiverLat: 33.515,
        shippingReceiverLng: 36.280,
      };

      const result = await service.create(mockUser, dtoWithValidCoords);
      expect(result).toBeDefined();
      expect(result.shippingReceiverLat?.toString()).toBe('33.515');
      expect(result.shippingReceiverLng?.toString()).toBe('36.28');
    });
  });

  describe('FINDING-PARITY-05: assertImportCreateReady Parity Checks', () => {
    it('rejects duplicate product lines during import validation', async () => {
      const dtoDuplicate: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        lines: [
          { productId: 'prod-1', requestedQuantity: 2 },
          { productId: 'prod-1', requestedQuantity: 3 },
        ],
      };

      await expect(service.assertImportCreateReady(mockUser, dtoDuplicate)).rejects.toThrow(
        'Duplicate product lines are not allowed in a single order.',
      );
    });

    it('rejects invalid geographic hierarchy during import validation', async () => {
      const dtoInvalidGeo: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        city: 'المريخ',
      };

      await expect(service.assertImportCreateReady(mockUser, dtoInvalidGeo)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects missing paymentMethod during import validation', async () => {
      const dtoNoPayment: CreateOmsOrderDto = {
        ...validSyrianAddressDto,
        paymentMethod: undefined,
      };

      await expect(service.assertImportCreateReady(mockUser, dtoNoPayment)).rejects.toThrow(
        'Payment method is required.',
      );
    });
  });
});

