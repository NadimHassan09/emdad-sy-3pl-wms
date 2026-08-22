import { ShippingProviderRegistry, BABEL_EXPRESS_CODE } from './shipping-provider.registry';
import { BabelExpressAdapter } from './providers/babel-express/babel-express.adapter';
import { BabelExpressHttpClient } from './providers/babel-express/babel-express.http-client';

describe('ShippingProviderRegistry', () => {
  it('registers Babel Express by code', () => {
    const adapter = new BabelExpressAdapter(new BabelExpressHttpClient());
    const registry = new ShippingProviderRegistry(adapter);
    expect(registry.has(BABEL_EXPRESS_CODE)).toBe(true);
    expect(registry.get(BABEL_EXPRESS_CODE).code).toBe(BABEL_EXPRESS_CODE);
    expect(() => registry.get('UNKNOWN')).toThrow(/not registered/i);
  });
});
