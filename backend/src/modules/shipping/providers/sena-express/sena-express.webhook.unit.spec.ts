import * as crypto from 'crypto';
import {
  verifySenaSignature,
  isSenaWebhookTest,
  buildSenaNormalizedEvent,
} from './sena-express.webhook.util';
import { SenaWebhookPayload } from './sena-express.types';

describe('SenaExpressWebhookUtil', () => {
  const secret = 'test-secret-sena-xyz-123';
  const rawBody = JSON.stringify({
    event: 'shipment.delivered',
    shipment_number: '260080689071',
    reference: 'ORDER-4002',
    status: 'delivered',
    public_status: 'تم التسليم',
    shipment: {
      id: 6676,
      shipment_number: '260080689071',
      reference: 'ORDER-4002',
      status: 'delivered',
      fulfillment_type: 'sena_stock',
      cod: {
        expected_amount: 150,
        collected_amount: 150,
        status: 'collected',
        currency: 'AED',
      },
    },
  });

  function makeSignature(body: string, sec: string): string {
    const hmac = crypto.createHmac('sha256', sec).update(body).digest('hex');
    return `sha256=${hmac}`;
  }

  describe('verifySenaSignature', () => {
    it('accepts valid HMAC signature with sha256= prefix', () => {
      const validSig = makeSignature(rawBody, secret);
      const headers = { 'x-sena-signature': validSig };
      expect(verifySenaSignature(headers, rawBody, secret)).toBe(true);
    });

    it('accepts valid timestamp-prefixed HMAC signature (${timestamp}.${rawBody})', () => {
      const timestamp = '1793438490';
      const sigWithTs = makeSignature(`${timestamp}.${rawBody}`, secret);
      const headers = {
        'x-sena-signature': sigWithTs,
        'x-sena-timestamp': timestamp,
      };
      expect(verifySenaSignature(headers, rawBody, secret)).toBe(true);
    });

    it('accepts signature case-insensitively from headers and handles Buffer rawBody', () => {
      const validSig = makeSignature(rawBody, secret);
      const headers = { 'X-Sena-Signature': validSig };
      expect(verifySenaSignature(headers, Buffer.from(rawBody, 'utf8'), secret)).toBe(true);
    });

    it('rejects signature when body is tampered with', () => {
      const validSig = makeSignature(rawBody, secret);
      const headers = { 'x-sena-signature': validSig };
      const tamperedBody = rawBody.replace('ORDER-4002', 'ORDER-9999');
      expect(verifySenaSignature(headers, tamperedBody, secret)).toBe(false);
    });

    it('rejects signature when secret does not match', () => {
      const wrongSig = makeSignature(rawBody, 'wrong-secret');
      const headers = { 'x-sena-signature': wrongSig };
      expect(verifySenaSignature(headers, rawBody, secret)).toBe(false);
    });

    it('rejects when signature header is missing or empty', () => {
      expect(verifySenaSignature({}, rawBody, secret)).toBe(false);
      expect(verifySenaSignature({ 'x-sena-signature': '' }, rawBody, secret)).toBe(false);
    });

    it('rejects when secret is missing or empty', () => {
      const validSig = makeSignature(rawBody, secret);
      const headers = { 'x-sena-signature': validSig };
      expect(verifySenaSignature(headers, rawBody, '')).toBe(false);
      expect(verifySenaSignature(headers, rawBody, undefined)).toBe(false);
    });

    it('safely handles signature of arbitrary invalid length without throwing', () => {
      expect(verifySenaSignature({ 'x-sena-signature': 'sha256=short' }, rawBody, secret)).toBe(false);
      expect(verifySenaSignature({ 'x-sena-signature': 'invalid-signature-format' }, rawBody, secret)).toBe(false);
    });
  });

  describe('isSenaWebhookTest', () => {
    it('detects webhook.test in payload event', () => {
      const payload: SenaWebhookPayload = { event: 'webhook.test' };
      expect(isSenaWebhookTest({}, payload)).toBe(true);
    });

    it('detects webhook.test in headers', () => {
      const payload: SenaWebhookPayload = { event: 'shipment.delivered' };
      expect(isSenaWebhookTest({ 'x-sena-event': 'webhook.test' }, payload)).toBe(true);
    });

    it('returns false for normal events', () => {
      const payload: SenaWebhookPayload = { event: 'shipment.delivered' };
      expect(isSenaWebhookTest({ 'x-sena-event': 'shipment.delivered' }, payload)).toBe(false);
    });
  });

  describe('buildSenaNormalizedEvent', () => {
    it('returns null for webhook.test handshake', () => {
      const payload: SenaWebhookPayload = { event: 'webhook.test' };
      expect(buildSenaNormalizedEvent({}, payload)).toBeNull();
    });

    it('maps shipment.delivered event with status and reference', () => {
      const payload: SenaWebhookPayload = {
        event: 'shipment.delivered',
        shipment_number: '260080689071',
        reference: 'ORDER-4002',
        status: 'delivered',
        public_status: 'تم التسليم',
        occurred_at: '2026-08-31T14:10:32+03:00',
        shipment: {
          id: 7788,
          shipment_number: '260080689071',
          reference: 'ORDER-4002',
          status: 'delivered',
          fulfillment_type: 'sena_stock',
          cod: {
            expected_amount: 150,
            collected_amount: 150,
            status: 'collected',
            currency: 'AED',
          },
        },
      };

      const event = buildSenaNormalizedEvent({ 'x-sena-delivery': 'del-123' }, payload);

      expect(event).not.toBeNull();
      expect(event?.providerCode).toBe('SENA_EXPRESS');
      expect(event?.awb).toBe('260080689071');
      expect(event?.reference).toBe('ORDER-4002');
      expect(event?.normalizedStatus).toBe('delivered');
      expect(event?.notes).toBe('تم التسليم');
      expect(event?.deliveryId).toBe('del-123');
      expect(event?.timestamp).toEqual(new Date('2026-08-31T14:10:32+03:00'));
    });

    it('maps shipment.out_for_delivery event', () => {
      const payload: SenaWebhookPayload = {
        event: 'shipment.out_for_delivery',
        shipment_number: '260080555944',
        reference: 'ORDER-3001',
        status: 'out_for_delivery',
        public_status: 'الطلب مع المندوب',
      };

      const event = buildSenaNormalizedEvent({}, payload);
      expect(event?.normalizedStatus).toBe('out_for_delivery');
      expect(event?.notes).toBe('الطلب مع المندوب');
      expect(event?.awb).toBe('260080555944');
    });

    it('maps shipment.in_return and returned_to_sender events', () => {
      const payloadInReturn: SenaWebhookPayload = {
        event: 'shipment.in_return',
        shipment_number: '260080331173',
        reference: 'UR3756',
        status: 'in_return',
        public_status: 'ضمن الإرجاع',
      };
      expect(buildSenaNormalizedEvent({}, payloadInReturn)?.normalizedStatus).toBe('returning_to_sender');

      const payloadReturned: SenaWebhookPayload = {
        event: 'shipment.returned_to_sender',
        shipment_number: '260080331173',
        reference: 'UR3756',
        status: 'returned_to_sender',
        public_status: 'تم إعادة الشحنة للمرسل',
      };
      expect(buildSenaNormalizedEvent({}, payloadReturned)?.normalizedStatus).toBe('returned_to_sender');
    });

    it('maps shipment.delivery_failed and failure statuses', () => {
      const payload: SenaWebhookPayload = {
        event: 'shipment.delivery_failed',
        shipment_number: '260080555944',
        reference: 'ORDER-3001',
        status: 'refused',
        public_status: 'رفض الاستلام',
      };

      const event = buildSenaNormalizedEvent({}, payload);
      expect(event?.normalizedStatus).toBe('delivery_failed');
      expect(event?.notes).toBe('رفض الاستلام');
    });

    it('maps shipment.cancelled event', () => {
      const payload: SenaWebhookPayload = {
        event: 'shipment.cancelled',
        shipment_number: '260080555944',
        reference: 'ORDER-3001',
        status: 'cancelled',
        public_status: 'تم الإلغاء',
      };

      const event = buildSenaNormalizedEvent({}, payload);
      expect(event?.normalizedStatus).toBe('cancelled');
    });
  });
});
