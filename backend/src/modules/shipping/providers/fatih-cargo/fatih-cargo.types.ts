export type FatihCity = {
  id: number;
  name: string;
  governorate?: { id: number; name: string };
  pickup_at_branch_available?: boolean;
};

export type FatihPackageType = {
  id: number;
  name: string;
};

export type FatihWeightCategory = {
  id: number;
  name: string;
  max_weight_kg?: number | null;
  fee_effect?: string;
  surcharge_percentage?: number | null;
};

export type FatihSizeCategory = {
  id: number;
  name: string;
  fee_effect?: string;
  surcharge_percentage?: number | null;
};

export type FatihMoney = {
  amount: number | null;
  currency: string;
};

export type FatihShipment = {
  id: number;
  tracking_number?: string | null;
  reference?: string | null;
  status?: string | null;
  status_label?: string | null;
  status_changed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  shipping_date?: string | null;
  delivered_at?: string | null;
  shipping_fee?: FatihMoney & { pending_manual_pricing?: boolean };
  cod?: FatihMoney | null;
  notes?: string | null;
};

export type FatihQuoteResult = {
  shipping_fee?: FatihMoney;
  pending_manual_pricing?: boolean;
  manual_pricing_reasons?: string[];
  breakdown?: {
    currency?: string;
    base_fee?: number;
    total?: number;
  };
  expected_delivery?: {
    available?: boolean;
    label?: string | null;
    average_days?: number | null;
  };
};

export type FatihCreateShipmentPayload = {
  reference?: string;
  recipient: {
    name: string;
    phone: string;
    city_id: number;
    address: string;
    pickup_at_branch?: boolean;
  };
  package: {
    type_id: number;
    weight_category_id: number;
    size_category_id: number;
    count?: number;
    declared_value?: { amount: number; currency: string };
  };
  cod?: { amount: number; currency: string };
  shipping_fee_paid_by: 'sender' | 'recipient';
  notes?: string;
};

export type FatihWebhookPayload = {
  id?: string;
  type?: string;
  created_at?: string;
  data?: {
    message?: string;
    shipment?: {
      id?: number;
      tracking_number?: string | null;
      reference?: string | null;
      status?: string | null;
      status_label?: string | null;
      status_changed_at?: string | null;
      account?: { id?: number; name?: string; store_reference?: string | null };
    };
  };
};
