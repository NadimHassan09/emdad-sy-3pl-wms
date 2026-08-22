import { ApiCredentialScope } from '@prisma/client';

export const API_BASE_URL = 'https://client.emdadsy.com/api/v1';

export type CanonicalApiDocs = {
  scope: ApiCredentialScope;
  title: string;
  summary: string;
  createPath: string;
  getPath: string;
  workflow: string[];
  bodyExample: string;
  responseExample: string;
  fields: Array<{ name: string; required: string; description: string }>;
};

const AUTH = `X-API-Key: YOUR_API_KEY
X-API-Secret: YOUR_API_SECRET`;

export const AUTH_ALTERNATIVE = `Authorization: Bearer YOUR_API_KEY:YOUR_API_SECRET`;

export function canonicalApiDocs(scope: ApiCredentialScope): CanonicalApiDocs {
  if (scope === 'inbound') {
    return {
      scope,
      title: 'Inbound Orders API',
      summary:
        'Create and read inbound (ASN) orders for your company. Orders enter pending_approval. Warehouse receiving is performed by EMDAD after admin approval.',
      createPath: 'POST /inbound/orders',
      getPath: 'GET /inbound/orders/{id}  or  GET /inbound/orders?externalOrderId=ERP-IN-10045',
      workflow: [
        'Authenticate with an Inbound-scoped API key.',
        'Create the inbound order.',
        'The order enters pending_approval.',
        'EMDAD admin approves and completes receiving. The API does not auto-receive stock.',
      ],
      bodyExample: `{
  "externalOrderId": "ERP-IN-10045",
  "expectedArrivalDate": "2026-08-25",
  "clientReference": "PO-8891",
  "notes": "Morning delivery window",
  "lines": [
    { "sku": "SKU-100", "quantity": 20 }
  ]
}`,
      responseExample: `{
  "success": true,
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "orderNumber": "INB-2026-00001",
    "status": "pending_approval",
    "externalOrderId": "ERP-IN-10045",
    "idempotentReplay": false
  }
}`,
      fields: [
        { name: 'externalOrderId', required: 'Yes', description: 'Idempotency key. Duplicate values return the existing order.' },
        { name: 'expectedArrivalDate', required: 'Yes', description: 'YYYY-MM-DD. Cannot be before today.' },
        { name: 'clientReference', required: 'No', description: 'Your internal PO or reference.' },
        { name: 'notes', required: 'No', description: 'Free-text notes.' },
        { name: 'lines[].sku', required: 'Yes', description: 'Product SKU that belongs to your company.' },
        { name: 'lines[].quantity', required: 'Yes', description: 'Positive whole number.' },
      ],
    };
  }

  if (scope === 'outbound') {
    return {
      scope,
      title: 'Outbound Orders API',
      summary:
        'Create and read warehouse outbound orders for your company. Orders enter pending_approval. Picking, packing, and shipping are not started by this API.',
      createPath: 'POST /outbound/orders',
      getPath: 'GET /outbound/orders/{id}  or  GET /outbound/orders?externalOrderId=WMS-OUT-778',
      workflow: [
        'Authenticate with an Outbound-scoped API key.',
        'Create the outbound order with a destination.',
        'The order enters pending_approval.',
        'EMDAD admin plans picking/packing. The API does not dispatch or call carriers.',
      ],
      bodyExample: `{
  "externalOrderId": "WMS-OUT-778",
  "requiredShipDate": "2026-08-25",
  "destinationAddress": "Damascus, Syria",
  "address": {
    "governorate": "دمشق",
    "city": "المزة",
    "neighborhood": "المزة فيلات شرقية",
    "street": "Building 12"
  },
  "notes": "Call before delivery",
  "lines": [
    { "sku": "SKU-100", "quantity": 2 }
  ]
}`,
      responseExample: `{
  "success": true,
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "orderNumber": "OUT-2026-00001",
    "status": "pending_approval",
    "externalOrderId": "WMS-OUT-778",
    "idempotentReplay": false
  }
}`,
      fields: [
        { name: 'externalOrderId', required: 'Yes', description: 'Idempotency key. Duplicate values return the existing order.' },
        { name: 'requiredShipDate', required: 'Yes', description: 'YYYY-MM-DD. Cannot be before today.' },
        { name: 'destinationAddress', required: 'If address omitted', description: 'Free-text destination.' },
        { name: 'address.governorate', required: 'If using structured address', description: 'Syria governorate name (same list as Client Portal).' },
        { name: 'address.city', required: 'If using structured address', description: 'City / area.' },
        { name: 'lines[].sku', required: 'Yes', description: 'Product SKU that belongs to your company.' },
        { name: 'lines[].quantity', required: 'Yes', description: 'Positive whole number.' },
      ],
    };
  }

  return {
    scope: 'oms',
    title: 'OMS Orders API',
    summary:
      'Create and read ecommerce/OMS orders for your company. API-created orders enter Confirmed — Waiting for Admin Approval. They are not auto-approved and do not create picking, packing, dispatch, or carrier shipments.',
    createPath: 'POST /oms/orders',
    getPath: 'GET /oms/orders/{id}  or  GET /oms/orders?externalOrderId=SHOP-12345',
    workflow: [
      'Authenticate with an OMS-scoped API key.',
      'Create the order. Company is taken from the API key (do not send companyId).',
      'The order is submitted for admin approval (confirmed_waiting_for_admin_approval).',
      'EMDAD admin approves. Only then can warehouse work and shipping start.',
    ],
    bodyExample: `{
  "externalOrderId": "SHOP-12345",
  "requiredShipDate": "2026-08-25",
  "recipientName": "محمد أحمد",
  "recipientPhone": "+963944123456",
  "shippingPhoneCountry": "SY",
  "paymentMethod": "COD",
  "currency": "USD",
  "address": {
    "governorate": "دمشق",
    "city": "المزة",
    "neighborhood": "المزة فيلات شرقية",
    "street": "Street 4, building 12"
  },
  "lines": [
    { "sku": "SKU-100", "quantity": 2, "unitPrice": 25 }
  ]
}`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "orderNumber": "OMS-2026-00001",
    "status": "confirmed_waiting_for_admin_approval",
    "externalOrderId": "SHOP-12345",
    "idempotentReplay": false
  }
}`,
    fields: [
      { name: 'externalOrderId', required: 'Yes', description: 'Your order id. Sending the same value twice returns the existing OMS order.' },
      { name: 'requiredShipDate', required: 'Yes', description: 'YYYY-MM-DD. Cannot be before today.' },
      { name: 'recipientName', required: 'No', description: 'Letters and spaces only (Arabic or Latin).' },
      { name: 'recipientPhone', required: 'No', description: 'E.164 phone such as +963944123456.' },
      { name: 'address.governorate', required: 'Yes', description: 'Syria governorate (same names as Client Portal).' },
      { name: 'address.city', required: 'Yes', description: 'City / area.' },
      { name: 'address.neighborhood', required: 'No', description: 'Neighborhood / town.' },
      { name: 'address.street', required: 'No', description: 'Street / detailed address.' },
      { name: 'lines[].sku', required: 'Yes', description: 'Product SKU that belongs to your company. Internal product UUIDs are not required.' },
      { name: 'lines[].quantity', required: 'Yes', description: 'Positive whole number.' },
      { name: 'lines[].unitPrice', required: 'No', description: 'Whole-number unit price. COD amount is derived when paymentMethod=COD.' },
      { name: 'paymentMethod', required: 'No', description: 'COD, PREPAID, or CREDIT.' },
    ],
  };
}

export function authHeaderExample(): string {
  return AUTH;
}
