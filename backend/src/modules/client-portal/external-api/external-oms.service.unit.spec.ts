import { ExternalOmsService } from './external-oms.service';
import { ClientOmsOrdersService } from '../oms/client-oms-orders.service';
import { ShippingGeoService } from '../../shipping/shipping-geo.service';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ExternalCreateOmsOrderDto } from './dto/external-create-oms-order.dto';
import { OmsOrderStatus } from '@prisma/client';

describe('ExternalOmsService lifecycle consistency (F-05)', () => {
  let service: ExternalOmsService;
  let omsService: any;
  let geoService: any;

  const mockClient: ClientPrincipal = {
    id: 'user-1',
    companyId: 'company-1',
    companyName: 'Company 1',
    fullName: 'Client Admin',
    role: 'client_admin',
    email: 'client@example.com',
  };

  beforeEach(() => {
    omsService = {
      findByExternalReference: jest.fn().mockResolvedValue(null),
      resolveSkus: jest.fn().mockResolvedValue(new Map([['SKU-1', 'p-1']])),
      createFromApi: jest.fn().mockResolvedValue({
        id: 'oms-order-1',
        orderNumber: 'ORD-1001',
        status: OmsOrderStatus.waiting_for_confirmation,
        subtotal: 3000,
        codAmount: 3000,
        lines: [],
      }),
      confirm: jest.fn(),
    };

    geoService = {
      lookupBoundary: jest.fn().mockResolvedValue(null),
      containsPoint: jest.fn().mockReturnValue(false),
      findGovernorateByName: jest.fn().mockResolvedValue(null),
      findCityByName: jest.fn().mockResolvedValue(null),
    };

    service = new ExternalOmsService(
      omsService as unknown as ClientOmsOrdersService,
      geoService as unknown as ShippingGeoService,
    );
  });

  it('creates order with waiting_for_confirmation and DOES NOT automatically call confirm()', async () => {
    const dto: ExternalCreateOmsOrderDto = {
      externalOrderId: 'EXT-ORDER-999',
      requiredShipDate: '2026-11-01',
      recipientName: 'Omar Khaled',
      countryCode: '963',
      recipientPhone: '944123456',
      paymentMethod: 'COD',
      address: {
        governorate: 'حلب',
        city: 'أتارب',
        neighborhood: 'أرناز',
        street: 'Al-Mutanabbi Street, Building 4, Floor 2',
      },
      lines: [
        {
          sku: 'SKU-1',
          quantity: 2,
          unitPrice: 1500,
        },
      ],
    };

    const result = await service.create(mockClient, dto);

    // Initial status must be waiting_for_confirmation
    expect(result.status).toBe(OmsOrderStatus.waiting_for_confirmation);
    expect(omsService.createFromApi).toHaveBeenCalledTimes(1);

    // Confirm must NOT be called automatically
    expect(omsService.confirm).not.toHaveBeenCalled();
  });
});
