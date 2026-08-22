import { describe, expect, it } from 'vitest';

import {
  evaluateRecipientPhone,
  filterNationalPhoneInput,
  ingestPastedPhone,
  isValidRecipientName,
  normalizeArabicIndicDigits,
  normalizeRecipientContact,
  normalizeRecipientName,
} from '../../../shared/lib/recipient-contact';

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

  it('rejects emoji and trims excessive spaces', () => {
    expect(isValidRecipientName('Ahmed😀')).toBe(false);
    expect(normalizeRecipientName('  Mohamed   Ahmed  ')).toBe('Mohamed Ahmed');
    expect(isValidRecipientName('  Mohamed   Ahmed  ')).toBe(true);
  });
});

describe('OMS international phone validation', () => {
  it('validates Egypt national numbers via metadata', () => {
    expect(evaluateRecipientPhone('EG', '1001234567').isValid).toBe(true);
    expect(evaluateRecipientPhone('EG', '1001234567').e164).toBe('+201001234567');
    expect(evaluateRecipientPhone('EG', '100123').state).toBe('typing');
    expect(evaluateRecipientPhone('EG', '100123456789999').isValid).toBe(false);
    expect(evaluateRecipientPhone('EG', 'abc').nationalNumber).toBe('');
  });

  it('validates Syria national numbers via metadata', () => {
    expect(evaluateRecipientPhone('SY', '944123456').isValid).toBe(true);
    expect(evaluateRecipientPhone('SY', '944123456').e164).toBe('+963944123456');
    expect(evaluateRecipientPhone('SY', '12').isValid).toBe(false);
  });

  it('normalizes Arabic-Indic digits', () => {
    expect(normalizeArabicIndicDigits('١٠٠١٢٣٤٥٦٧')).toBe('1001234567');
    expect(filterNationalPhoneInput('١٠٠١٢٣٤٥٦٧')).toBe('1001234567');
    expect(evaluateRecipientPhone('EG', '١٠٠١٢٣٤٥٦٧').isValid).toBe(true);
    expect(evaluateRecipientPhone('EG', '١٠٠١٢٣٤٥٦٧').e164).toBe('+201001234567');
  });

  it('revalidates when the country changes', () => {
    const egypt = evaluateRecipientPhone('EG', '1001234567');
    expect(egypt.isValid).toBe(true);
    const syria = evaluateRecipientPhone('SY', egypt.nationalNumber);
    expect(syria.isValid).toBe(false);
  });

  it('ingests pasted E.164 without doubling the country code', () => {
    const pasted = ingestPastedPhone('+201001234567', 'EG');
    expect(pasted.countryIso).toBe('EG');
    expect(pasted.nationalNumber).toBe('1001234567');
    expect(evaluateRecipientPhone(pasted.countryIso, pasted.nationalNumber).e164).toBe(
      '+201001234567',
    );
  });
});

describe('OMS recipient contact normalize', () => {
  it('returns E.164 and ISO country', () => {
    const result = normalizeRecipientContact({
      recipientName: 'محمد أحمد',
      recipientPhone: '1001234567',
      shippingPhoneCountry: 'EG',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.recipientName).toBe('محمد أحمد');
      expect(result.value.recipientPhone).toBe('+201001234567');
      expect(result.value.shippingPhoneCountry).toBe('EG');
    }
  });

  it('rejects a bypass-style invalid payload', () => {
    const result = normalizeRecipientContact({
      recipientName: 'Ahmed123@#$',
      recipientPhone: 'abc123',
      shippingPhoneCountry: 'EG',
    });
    expect(result.ok).toBe(false);
  });
});
