export type SenaDeliveryZone = {
  id: number;
  name: string;
  zone_code: string;
  display_name: string;
  warehouse_id: number;
  warehouse_name: string;
  country: string;
  delivery_price: number | null;
};

export type SenaPickupAddress = {
  id: number;
  label: string;
  is_default: boolean;
};

export type SenaStockItem = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  selling_price: number;
  weight: number;
  available_quantity: number;
};

export type SenaShipmentStatusDict = {
  id: number;
  type?: string;
  status: string;
  public_status: string;
  color?: string;
};

export type SenaItem = {
  name?: string;
  sku?: string;
  barcode?: string;
  product_id?: number;
  quantity: number;
  price?: number;
  weight?: number;
};

export type SenaPickupAddressDirect = {
  title?: string;
  contact_name: string;
  phone: string;
  city: string;
  address: string;
  notes?: string;
};

export type SenaCreateShipmentPayload = {
  reference: string;
  fulfillment_type?: 'merchant_prepared' | 'sena_stock';
  delivery_zone_id: number;
  area_id?: number;
  customer_name: string;
  customer_phone: string;
  city: string;
  address: string;
  cod_amount: number;
  currency?: string;
  items: SenaItem[];
  delivery_payment_type?: 'sender' | 'receiver';
  pickup_address_id?: number;
  pickup_address?: SenaPickupAddressDirect;
  save_pickup_address?: boolean;
  save_pickup_address_as_default?: boolean;
};

export type SenaShipment = {
  id: number;
  shipment_number: string;
  reference: string;
  shipment_reference?: string;
  merchant_reference?: string;
  fulfillment_type?: string;
  tracking_url?: string;
  receiver?: {
    name?: string;
    phone?: string;
    city?: string;
    address?: string;
  };
  delivery_zone?: {
    id?: number;
    name?: string;
    zone_code?: string;
  };
  pickup_address?: {
    id?: number;
    label?: string;
  } | null;
  cod?: {
    expected_amount?: number;
    collected_amount?: number;
    status?: string;
    currency?: string;
  };
  status: string;
  public_status?: string;
  idempotent?: boolean;
  timeline?: Array<{
    status?: string;
    public_status?: string;
    note?: string;
    location?: string;
    occurred_at?: string;
    timestamp?: string;
    color?: string;
  }>;
  parts?: string[];
  part_barcodes?: string[];
};

export type SenaWebhookPayload = {
  event?: string;
  shipment_number?: string;
  reference?: string;
  status?: string;
  public_status?: string;
  occurred_at?: string;
  shipment?: SenaShipment;
};
