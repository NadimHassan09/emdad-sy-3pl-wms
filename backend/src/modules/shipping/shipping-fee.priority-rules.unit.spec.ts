import { Prisma } from '@prisma/client';
import {
  candidateLocationKeys,
  locationKey,
  LOCATION_SEP,
} from './shipping-fee.locations';
import { ShippingFeeService } from './shipping-fee.service';
import {
  publicOmsOrder,
  publicOutboundOrder,
} from '../client-portal/external-api/public-order.serialize';
import {
  CLIENT_OMS_EXPORT_COLUMNS,
  CLIENT_OUTBOUND_EXPORT_COLUMNS,
} from '../client-portal/order-export/client-order-export.columns';

describe('Shipping Fee Rates — Business Decisions & Priority Rules', () => {
  describe('1. Candidate Location Keys & Specificity Order', () => {
    it('Town > City > Governorate: orders candidates from most specific to least specific', () => {
      const keys = candidateLocationKeys({
        governorate: 'دمشق',
        cityRegion: 'دمر',
        townNeighborhood: 'مشروع دمر',
      });
      expect(keys).toEqual([
        ['دمشق', 'دمر', 'مشروع دمر'].join(LOCATION_SEP),
        ['دمشق', 'دمر'].join(LOCATION_SEP),
        'دمشق',
      ]);
    });

    it('City > Governorate when town is absent', () => {
      const keys = candidateLocationKeys({
        governorate: 'دمشق',
        cityRegion: 'دمر',
      });
      expect(keys).toEqual([
        ['دمشق', 'دمر'].join(LOCATION_SEP),
        'دمشق',
      ]);
    });

    it('Governorate-level key when only governorate is provided', () => {
      const keys = candidateLocationKeys({
        governorate: 'دمشق',
      });
      expect(keys).toEqual(['دمشق']);
    });
  });

  describe('2. Deterministic Pricing Resolution (resolveDestinationGroup)', () => {
    let service: ShippingFeeService;
    let mockPrisma: any;

    const townKey = locationKey({
      level: 'town',
      governorate: 'دمشق',
      cityRegion: 'دمر',
      townNeighborhood: 'مشروع دمر',
    });
    const cityKey = locationKey({
      level: 'city_region',
      governorate: 'دمشق',
      cityRegion: 'دمر',
    });
    const govKey = locationKey({
      level: 'governorate',
      governorate: 'دمشق',
    });

    const globalGroupDamascusWhole = {
      id: 'group-global-gov',
      companyId: null,
      nameAr: 'شحن عام - دمشق كاملة',
      baseRate: new Prisma.Decimal('10.00'),
      active: true,
    };

    const globalGroupDamascusCity = {
      id: 'group-global-city',
      companyId: null,
      nameAr: 'شحن عام - مدينة دمشق',
      baseRate: new Prisma.Decimal('15.00'),
      active: true,
    };

    const globalGroupDummarTown = {
      id: 'group-global-town',
      companyId: null,
      nameAr: 'شحن عام - مشروع دمر',
      baseRate: new Prisma.Decimal('20.00'),
      active: true,
    };

    const clientGroupDamascusCity = {
      id: 'group-client-city',
      companyId: 'company-vip-1',
      nameAr: 'شحن خاص للعميل - مدينة دمشق',
      baseRate: new Prisma.Decimal('12.00'),
      active: true,
    };

    const clientGroupDamascusWhole = {
      id: 'group-client-gov',
      companyId: 'company-vip-1',
      nameAr: 'شحن خاص للعميل - دمشق كاملة',
      baseRate: new Prisma.Decimal('8.00'),
      active: true,
    };

    beforeEach(() => {
      mockPrisma = {
        shippingFeeGroupLocation: {
          findMany: jest.fn(),
        },
      };
      service = new ShippingFeeService(mockPrisma);
    });

    it('Rule 1 & 2: Town priority over City and Governorate', async () => {
      mockPrisma.shippingFeeGroupLocation.findMany.mockResolvedValue([
        {
          id: 'loc-1',
          locationKey: townKey,
          level: 'town',
          companyId: null,
          group: globalGroupDummarTown,
        },
        {
          id: 'loc-2',
          locationKey: cityKey,
          level: 'city_region',
          companyId: null,
          group: globalGroupDamascusCity,
        },
        {
          id: 'loc-3',
          locationKey: govKey,
          level: 'governorate',
          companyId: null,
          group: globalGroupDamascusWhole,
        },
      ]);

      const result = await service.resolveDestinationGroup(mockPrisma, {
        governorate: 'دمشق',
        cityRegion: 'دمر',
        townNeighborhood: 'مشروع دمر',
      });

      expect(result).toBeDefined();
      expect(result?.group.id).toBe('group-global-town');
      expect(result?.level).toBe('town');
    });

    it('Rule 3: More specific Global Town beats less specific Client City/Gov', async () => {
      mockPrisma.shippingFeeGroupLocation.findMany.mockResolvedValue([
        {
          id: 'loc-town-global',
          locationKey: townKey,
          level: 'town',
          companyId: null,
          group: globalGroupDummarTown,
        },
        {
          id: 'loc-city-client',
          locationKey: cityKey,
          level: 'city_region',
          companyId: 'company-vip-1',
          group: clientGroupDamascusCity,
        },
      ]);

      const result = await service.resolveDestinationGroup(mockPrisma, {
        companyId: 'company-vip-1',
        governorate: 'دمشق',
        cityRegion: 'دمر',
        townNeighborhood: 'مشروع دمر',
      });

      // Town is more specific geographically than City, so Global Town wins!
      expect(result).toBeDefined();
      expect(result?.group.id).toBe('group-global-town');
      expect(result?.level).toBe('town');
    });

    it('Rule 4: Client rate beats Global rate at the SAME level and location', async () => {
      mockPrisma.shippingFeeGroupLocation.findMany.mockResolvedValue([
        {
          id: 'loc-city-global',
          locationKey: cityKey,
          level: 'city_region',
          companyId: null,
          group: globalGroupDamascusCity,
        },
        {
          id: 'loc-city-client',
          locationKey: cityKey,
          level: 'city_region',
          companyId: 'company-vip-1',
          group: clientGroupDamascusCity,
        },
      ]);

      const result = await service.resolveDestinationGroup(mockPrisma, {
        companyId: 'company-vip-1',
        governorate: 'دمشق',
        cityRegion: 'دمر',
      });

      // Same level (city_region) and same location -> Client rate wins!
      expect(result).toBeDefined();
      expect(result?.group.id).toBe('group-client-city');
      expect(result?.companyId).toBe('company-vip-1');
    });

    it('Rule 5: Fallback to Global when no client rate exists', async () => {
      mockPrisma.shippingFeeGroupLocation.findMany.mockResolvedValue([
        {
          id: 'loc-gov-global',
          locationKey: govKey,
          level: 'governorate',
          companyId: null,
          group: globalGroupDamascusWhole,
        },
      ]);

      const result = await service.resolveDestinationGroup(mockPrisma, {
        companyId: 'company-vip-1',
        governorate: 'دمشق',
      });

      expect(result).toBeDefined();
      expect(result?.group.id).toBe('group-global-gov');
      expect(result?.companyId).toBeNull();
    });

    it('Rule 6: Returns null (no_rate) when no matching rate exists', async () => {
      mockPrisma.shippingFeeGroupLocation.findMany.mockResolvedValue([]);

      const result = await service.resolveDestinationGroup(mockPrisma, {
        companyId: 'company-vip-1',
        governorate: 'حلب',
        cityRegion: 'عفرين',
      });

      expect(result).toBeNull();
    });
  });

  describe('3. Client Confidentiality', () => {
    it('publicOmsOrder serializes carrier as null', () => {
      const order = {
        orderNumber: 'ORD-1001',
        status: 'approved',
        carrier: 'Internal Fleet Carrier Alpha',
        shippingProviderCode: 'IFC_EXP',
        shippingFee: new Prisma.Decimal('15.00'),
        lines: [],
      };
      const serialized = publicOmsOrder(order as any);
      expect(serialized.carrier).toBeNull();
      expect((serialized as any).shippingProviderCode).toBeUndefined();
    });

    it('publicOutboundOrder serializes carrier as null', () => {
      const order = {
        orderNumber: 'OUT-2002',
        status: 'shipped',
        carrier: 'Babel Express',
        lines: [],
      };
      const serialized = publicOutboundOrder(order as any);
      expect(serialized.carrier).toBeNull();
    });

    it('Export column definitions omit carrier from client exports', () => {
      const omsCarrierCol = CLIENT_OMS_EXPORT_COLUMNS.find((col) => col.id === 'carrier');
      const outboundCarrierCol = CLIENT_OUTBOUND_EXPORT_COLUMNS.find((col) => col.id === 'carrier');
      expect(omsCarrierCol).toBeUndefined();
      expect(outboundCarrierCol).toBeUndefined();
    });
  });
});
