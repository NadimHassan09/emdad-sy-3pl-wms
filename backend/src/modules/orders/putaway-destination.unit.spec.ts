import { isPutawayDestinationType } from './execution-plan.util';

describe('isPutawayDestinationType', () => {
  it('accepts storage, fridge, quarantine and scrap bins', () => {
    for (const type of ['internal', 'fridge', 'quarantine', 'scrap']) {
      expect(isPutawayDestinationType(type)).toBe(true);
    }
  });

  it('rejects packing, dock, output and structural locations', () => {
    for (const type of ['packing', 'input', 'output', 'iss', 'warehouse', 'view', 'qc', 'transit', null, undefined, '']) {
      expect(isPutawayDestinationType(type as string | null | undefined)).toBe(false);
    }
  });
});
