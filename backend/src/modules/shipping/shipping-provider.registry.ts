import { Injectable, NotFoundException } from '@nestjs/common';

import { BabelExpressAdapter } from './providers/babel-express/babel-express.adapter';
import { MockCarrierAdapter } from './providers/mock-carrier/mock-carrier.adapter';
import { SilaSyAdapter } from './providers/sila-sy/sila-sy.adapter';
import { MOCK_CARRIER_CODE } from './shipping.constants';
import type { ShippingProvider } from './shipping-provider.interface';

export { BABEL_EXPRESS_CODE, SILA_SY_CODE } from './shipping.constants';

@Injectable()
export class ShippingProviderRegistry {
  private readonly byCode = new Map<string, ShippingProvider>();

  constructor(babel: BabelExpressAdapter, sila: SilaSyAdapter, mock: MockCarrierAdapter) {
    this.byCode.set(babel.code, babel);
    this.byCode.set(sila.code, sila);
    if (process.env.SHIPPING_MOCK_ENABLED === 'true') {
      this.byCode.set(MOCK_CARRIER_CODE, mock);
    }
  }

  get(code: string): ShippingProvider {
    const provider = this.byCode.get(code);
    if (!provider) {
      throw new NotFoundException(`Shipping provider "${code}" is not registered.`);
    }
    return provider;
  }

  has(code: string): boolean {
    return this.byCode.has(code);
  }

  listCodes(): string[] {
    return [...this.byCode.keys()];
  }
}
