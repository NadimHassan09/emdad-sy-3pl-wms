import { buildQuickDirectedPickMessages } from './quick-directed-outbound.helper';

describe('buildQuickDirectedPickMessages', () => {
  it('formats a single location message', () => {
    const messages = buildQuickDirectedPickMessages([
      { locationId: '1', locationLabel: 'Zone A - Shelf 02', quantity: '5', lotNumber: null },
    ]);
    expect(messages.messageEn).toContain('5');
    expect(messages.messageEn).toContain('Zone A - Shelf 02');
    expect(messages.messageAr).toContain('Zone A - Shelf 02');
  });

  it('formats split locations', () => {
    const messages = buildQuickDirectedPickMessages([
      { locationId: '1', locationLabel: 'A-01', quantity: '3', lotNumber: null },
      { locationId: '2', locationLabel: 'B-04', quantity: '2', lotNumber: null },
    ]);
    expect(messages.messageEn).toContain('3 from A-01');
    expect(messages.messageEn).toContain('2 from B-04');
    expect(messages.messageAr).toContain('3 من A-01');
    expect(messages.messageAr).toContain('2 من B-04');
  });
});
