export type QuickDirectedPickSlice = {
  locationId: string;
  locationLabel: string;
  quantity: string;
  lotNumber: string | null;
};

export type QuickDirectedOutboundResult = {
  orderId: string;
  orderNumber: string;
  status: string;
  product: {
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    uom: string;
  };
  totalQuantity: string;
  reasonCode: string;
  directedPick: QuickDirectedPickSlice[];
  messageEn: string;
  messageAr: string;
};
