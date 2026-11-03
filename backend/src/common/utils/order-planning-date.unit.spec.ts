import { assertCalendarDateNotBeforeToday } from './order-planning-date';

describe('assertCalendarDateNotBeforeToday', () => {
  const ymd = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  it('accepts today and near-future dates', () => {
    expect(() => assertCalendarDateNotBeforeToday(ymd(0), 'Date')).not.toThrow();
    expect(() => assertCalendarDateNotBeforeToday(ymd(30), 'Date')).not.toThrow();
  });

  it('rejects past dates', () => {
    expect(() => assertCalendarDateNotBeforeToday(ymd(-1), 'Date')).toThrow(/before today/);
  });

  it('rejects dates more than two years ahead', () => {
    expect(() => assertCalendarDateNotBeforeToday('2999-01-01', 'Date')).toThrow(/2 years/);
  });
});
