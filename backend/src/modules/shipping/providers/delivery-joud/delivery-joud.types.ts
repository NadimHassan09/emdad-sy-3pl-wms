export type JoudAuthParams = {
  login: string;
  password: string;
  db: string;
};

export type JoudArea = {
  id?: number | string;
  name?: string;
  area_name?: string;
  delivery_fee?: number | string | null;
  price?: number | string | null;
  [key: string]: unknown;
};

export type JoudCreateOrderParams = JoudAuthParams & {
  customer_name: string;
  customer_mobile: string;
  customer_address: string;
  customer_area: string;
  reference_id?: string;
  cost: number;
  order_type_id: string | number;
  note?: string;
  paid: boolean;
  delivery_fee_on_customer: boolean;
  delivery_fee_on_sender: boolean;
  product_note?: string;
};

export type JoudOrder = {
  id?: number | string;
  name?: string;
  barcode?: string;
  tracking?: string;
  tracking_number?: string;
  reference_id?: string;
  state?: string;
  status?: string;
  status_name?: string;
  delivery_state?: string;
  customer_name?: string;
  customer_area?: string;
  cost?: number;
  [key: string]: unknown;
};

export type JoudJsonRpcResponse<T = unknown> = {
  jsonrpc?: string;
  id?: number | string | null;
  result?: T;
  error?: { code?: number; message?: string; data?: unknown };
};
