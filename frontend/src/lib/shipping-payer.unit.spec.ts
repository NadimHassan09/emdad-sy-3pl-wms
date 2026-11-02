import { describe, expect, it } from 'vitest';

import {
  CARRIER_CODES,
  DEFAULT_SHIPPING_PAYMENT_MODE,
  formatPaymentModeLabel,
  formatStoredPayerLabel,
  mapPayerForCarrier,
  normalizeCarrierCode,
  resolvePaymentModeFromPayer,
} from './shipping-payer';

describe('shipping-payer utility', () => {
  describe('default payment mode', () => {
    it('defaults to EMDAD_PAYS', () => {
      expect(DEFAULT_SHIPPING_PAYMENT_MODE).toBe('EMDAD_PAYS');
    });
  });

  describe('resolvePaymentModeFromPayer', () => {
    it('translates stored receiver to RECIPIENT_PAYS', () => {
      expect(resolvePaymentModeFromPayer('receiver')).toBe('RECIPIENT_PAYS');
    });

    it('translates stored sender to EMDAD_PAYS', () => {
      expect(resolvePaymentModeFromPayer('sender')).toBe('EMDAD_PAYS');
    });

    it('translates stored reseller to EMDAD_PAYS', () => {
      expect(resolvePaymentModeFromPayer('reseller')).toBe('EMDAD_PAYS');
    });

    it('translates null, undefined, and empty string to EMDAD_PAYS', () => {
      expect(resolvePaymentModeFromPayer(null)).toBe('EMDAD_PAYS');
      expect(resolvePaymentModeFromPayer(undefined)).toBe('EMDAD_PAYS');
      expect(resolvePaymentModeFromPayer('')).toBe('EMDAD_PAYS');
    });
  });

  describe('normalizeCarrierCode', () => {
    it('normalizes Babel Express aliases', () => {
      expect(normalizeCarrierCode('BABEL')).toBe(CARRIER_CODES.BABEL_EXPRESS);
      expect(normalizeCarrierCode('BABEL_EXPRESS')).toBe(CARRIER_CODES.BABEL_EXPRESS);
      expect(normalizeCarrierCode('babel_express')).toBe(CARRIER_CODES.BABEL_EXPRESS);
    });

    it('normalizes Sila-SY aliases', () => {
      expect(normalizeCarrierCode('SILA')).toBe(CARRIER_CODES.SILA_SY);
      expect(normalizeCarrierCode('SILA_SY')).toBe(CARRIER_CODES.SILA_SY);
      expect(normalizeCarrierCode('sila_sy')).toBe(CARRIER_CODES.SILA_SY);
    });

    it('normalizes Sena Express aliases', () => {
      expect(normalizeCarrierCode('SENA')).toBe(CARRIER_CODES.SENA_EXPRESS);
      expect(normalizeCarrierCode('SENA_EXPRESS')).toBe(CARRIER_CODES.SENA_EXPRESS);
      expect(normalizeCarrierCode('sena_express')).toBe(CARRIER_CODES.SENA_EXPRESS);
    });

    it('normalizes Mock and Manual', () => {
      expect(normalizeCarrierCode('MOCK_CARRIER')).toBe(CARRIER_CODES.MOCK_CARRIER);
      expect(normalizeCarrierCode('mock')).toBe(CARRIER_CODES.MOCK_CARRIER);
      expect(normalizeCarrierCode('MANUAL')).toBe(CARRIER_CODES.MANUAL);
    });
  });

  describe('mapPayerForCarrier', () => {
    describe('Emdad Pays (default business policy)', () => {
      it('maps Babel Express to reseller', () => {
        expect(mapPayerForCarrier('EMDAD_PAYS', 'BABEL_EXPRESS')).toBe('reseller');
        expect(mapPayerForCarrier('EMDAD_PAYS', 'BABEL')).toBe('reseller');
      });

      it('maps Sila-SY to sender', () => {
        expect(mapPayerForCarrier('EMDAD_PAYS', 'SILA_SY')).toBe('sender');
        expect(mapPayerForCarrier('EMDAD_PAYS', 'SILA')).toBe('sender');
      });

      it('maps Sena Express to sender', () => {
        expect(mapPayerForCarrier('EMDAD_PAYS', 'SENA_EXPRESS')).toBe('sender');
        expect(mapPayerForCarrier('EMDAD_PAYS', 'SENA')).toBe('sender');
      });

      it('maps Mock Carrier to reseller', () => {
        expect(mapPayerForCarrier('EMDAD_PAYS', 'MOCK_CARRIER')).toBe('reseller');
      });

      it('maps Manual or empty carrier to sender', () => {
        expect(mapPayerForCarrier('EMDAD_PAYS', 'MANUAL')).toBe('sender');
        expect(mapPayerForCarrier('EMDAD_PAYS', '')).toBe('sender');
        expect(mapPayerForCarrier('EMDAD_PAYS', null)).toBe('sender');
      });

      it('throws an error for unsupported unknown carriers', () => {
        expect(() => mapPayerForCarrier('EMDAD_PAYS', 'UNKNOWN_CARRIER')).toThrow(
          /Unsupported carrier payer mapping: UNKNOWN_CARRIER/,
        );
      });
    });

    describe('Recipient Pays', () => {
      it('maps to receiver for Babel Express', () => {
        expect(mapPayerForCarrier('RECIPIENT_PAYS', 'BABEL_EXPRESS')).toBe('receiver');
      });

      it('maps to receiver for Sila-SY', () => {
        expect(mapPayerForCarrier('RECIPIENT_PAYS', 'SILA_SY')).toBe('receiver');
      });

      it('maps to receiver for Sena Express', () => {
        expect(mapPayerForCarrier('RECIPIENT_PAYS', 'SENA_EXPRESS')).toBe('receiver');
      });

      it('maps to receiver for any carrier', () => {
        expect(mapPayerForCarrier('RECIPIENT_PAYS', 'ANY_CARRIER')).toBe('receiver');
      });
    });
  });

  describe('Carrier switching scenarios with existing saved orders', () => {
    it('order saved with sender switching to Babel maps to reseller under Emdad Pays', () => {
      const mode = resolvePaymentModeFromPayer('sender');
      expect(mode).toBe('EMDAD_PAYS');
      expect(mapPayerForCarrier(mode, 'BABEL_EXPRESS')).toBe('reseller');
    });

    it('order saved with reseller switching to Sila maps to sender under Emdad Pays', () => {
      const mode = resolvePaymentModeFromPayer('reseller');
      expect(mode).toBe('EMDAD_PAYS');
      expect(mapPayerForCarrier(mode, 'SILA_SY')).toBe('sender');
    });

    it('order saved with sender staying with Sila remains sender', () => {
      const mode = resolvePaymentModeFromPayer('sender');
      expect(mapPayerForCarrier(mode, 'SILA_SY')).toBe('sender');
    });

    it('order saved with reseller staying with Babel remains reseller', () => {
      const mode = resolvePaymentModeFromPayer('reseller');
      expect(mapPayerForCarrier(mode, 'BABEL_EXPRESS')).toBe('reseller');
    });

    it('order saved with receiver switching between carriers remains receiver', () => {
      const mode = resolvePaymentModeFromPayer('receiver');
      expect(mode).toBe('RECIPIENT_PAYS');
      expect(mapPayerForCarrier(mode, 'BABEL_EXPRESS')).toBe('receiver');
      expect(mapPayerForCarrier(mode, 'SILA_SY')).toBe('receiver');
      expect(mapPayerForCarrier(mode, 'SENA_EXPRESS')).toBe('receiver');
    });
  });

  describe('display formatting labels', () => {
    it('formats English and Arabic labels properly', () => {
      expect(formatPaymentModeLabel('EMDAD_PAYS', false)).toBe('Emdad Pays');
      expect(formatPaymentModeLabel('EMDAD_PAYS', true)).toBe('إمداد تتحمل تكلفة الشحن');
      expect(formatPaymentModeLabel('RECIPIENT_PAYS', false)).toBe('Recipient Pays');
      expect(formatPaymentModeLabel('RECIPIENT_PAYS', true)).toBe('المستلم يتحمل تكلفة الشحن');
    });

    it('formats stored payer values into friendly labels', () => {
      expect(formatStoredPayerLabel('reseller', false)).toBe('Emdad Pays');
      expect(formatStoredPayerLabel('sender', true)).toBe('إمداد تتحمل تكلفة الشحن');
      expect(formatStoredPayerLabel('receiver', true)).toBe('المستلم يتحمل تكلفة الشحن');
    });
  });
});
