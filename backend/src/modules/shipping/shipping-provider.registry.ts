import { Injectable, NotFoundException } from '@nestjs/common';

import { BabelExpressAdapter } from './providers/babel-express/babel-express.adapter';
import { BABEL_EXPRESS_CODE } from './shipping.constants';
import type { ShippingProvider } from './shipping-provider.interface';

export { BABEL_EXPRESS_CODE } from './shipping.constants';

@Injectable()
export class ShippingProviderRegistry {
  private readonly byCode = new Map<string, ShippingProvider>();

  constructor(babel: BabelExpressAdapter) {
    this.byCode.set(babel.code, babel);
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
