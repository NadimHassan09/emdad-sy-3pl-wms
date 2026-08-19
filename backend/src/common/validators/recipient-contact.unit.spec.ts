import {
  evaluateRecipientPhone,
  ingestPastedPhone,
  isValidRecipientName,
  normalizeArabicIndicDigits,
  normalizeRecipientContact,
  normalizeRecipientName,
} from './recipient-contact';

describe('OMS recipient name validation', () => {
  it('accepts Arabic and English letters with spaces', () => {
    for (const name of ['محمد', 'Mohamed', 'محمد أحمد', 'Mohamed Ahmed', 'محمد عبدالله', 'Ahmed Mohamed']) {
      expect(isValidRecipientName(name)).toBe(true);
    }
  });

  it('rejects numbers, punctuation, and symbols', () => {
    for (const name of ['محمد123', 'Ahmed123', 'محمد-أحمد', 'Ahmed_Ali', 'محمد@', 'Ahmed#', 'Mohamed@', 'محمد*']) {
      expect(isValidRecipientName(name)).toBe(false);
    }
  });

  it('rejects emoji and normalizes spaces', () => {
    expect(isValidRecipientName('Ahmed😀')).toBe(false);
    expect(normalizeRecipientName('  Mohamed   Ahmed  ')).toBe('Mohamed Ahmed');
  });
});

describe('OMS international phone validation', () => {
  it('validates Egypt via libphonenumber metadata', () => {
    expect(evaluateRecipientPhone('EG', '1001234567').isValid).toBe(true);
    expect(evaluateRecipientPhone('EG', '100123').isValid).toBe(false);
    expect(evaluateRecipientPhone('EG', '100123456789999').isValid).toBe(false);
  });

  it('validates Syria via libphonenumber metadata', () => {
    expect(evaluateRecipientPhone('SY', '944123456').isValid).toBe(true);
    expect(evaluateRecipientPhone('SY', '12').isValid).toBe(false);
  });

  it('normalizes Arabic-Indic digits', () => {
    expect(normalizeArabicIndicDigits('١٠٠١٢٣٤٥٦٧')).toBe('1001234567');
    expect(evaluateRecipientPhone('EG', '١٠٠١٢٣٤٥٦٧').e164).toBe('+201001234567');
  });

  it('revalidates after switching EG → SY', () => {
    expect(evaluateRecipientPhone('EG', '1001234567').isValid).toBe(true);
    expect(evaluateRecipientPhone('SY', '1001234567').isValid).toBe(false);
  });

  it('parses pasted international numbers without doubling the dial code', () => {
    const pasted = ingestPastedPhone('+201001234567', 'EG');
    expect(pasted.nationalNumber).toBe('1001234567');
    expect(evaluateRecipientPhone(pasted.countryIso, pasted.nationalNumber).e164).toBe(
      '+201001234567',
    );
  });
});

describe('OMS recipient contact normalize', () => {
  it('rejects a bypass-style invalid payload', () => {
    const result = normalizeRecipientContact({
      recipientName: 'Ahmed123@#$',
      recipientPhone: 'abc123',
    });
    expect(result.ok).toBe(false);
  });
});
