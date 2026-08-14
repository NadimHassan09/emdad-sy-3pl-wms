export type ShippingRateQuote = {
  carrierId: string;
  carrierName: string;
  serviceId: string;
  serviceName: string;
  available: boolean;
  price: number;
  currency: string;
  estimatedDeliveryMin?: number;
  estimatedDeliveryMax?: number;
  deliveryType?: string;
  restrictions?: string[];
  isCheapest?: boolean;
  isFastest?: boolean;
  isRecommended?: boolean;
};

export type ShippingRateError = {
  carrierId: string;
  carrierName: string;
  message: string;
};

/** Badge cheapest / fastest / recommended from normalized quotes. Does not invent ETAs. */
export function annotateRateQuotes(quotes: ShippingRateQuote[]): ShippingRateQuote[] {
  const priced = quotes.filter((q) => q.available && Number.isFinite(q.price));
  const minPrice = priced.length ? Math.min(...priced.map((q) => q.price)) : null;
  const withEta = quotes.filter(
    (q) =>
      q.available &&
      q.estimatedDeliveryMax != null &&
      Number.isFinite(q.estimatedDeliveryMax),
  );
  const minEta = withEta.length
    ? Math.min(...withEta.map((q) => q.estimatedDeliveryMax as number))
    : null;

  return quotes.map((q) => {
    const isCheapest = minPrice != null && q.available && q.price === minPrice;
    const isFastest =
      minEta != null && q.available && q.estimatedDeliveryMax === minEta;
    return {
      ...q,
      isCheapest,
      isFastest,
      isRecommended: isCheapest,
    };
  });
}
