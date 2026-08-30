import { exportProductNames, exportProductWeights } from './order-export-product-cells';

describe('order-export-product-cells', () => {
  it('joins product names and weights in line order', () => {
    const lines = [
      { product: { name: 'Widget A', weightKg: '1.5' } },
      { product: { name: 'Widget B', weightKg: 0.8 } },
    ];
    expect(exportProductNames(lines)).toBe('Widget A | Widget B');
    expect(exportProductWeights(lines)).toBe('1.5 | 0.8');
  });

  it('keeps empty slots so names stay aligned with weights', () => {
    const lines = [
      { product: { name: 'Only name', weightKg: null } },
      { product: { name: '', weightKg: '2' } },
    ];
    expect(exportProductNames(lines)).toBe('Only name | ');
    expect(exportProductWeights(lines)).toBe(' | 2');
  });

  it('returns empty when lines or product fields are missing', () => {
    expect(exportProductNames(undefined)).toBe('');
    expect(exportProductWeights([])).toBe('');
    expect(exportProductNames([{ product: null }])).toBe('');
  });
});
