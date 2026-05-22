import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function formatTaskDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function formatTaskDateOnly(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function inboundOrderTitle(
  orderNumber: string | undefined,
  href: string | undefined,
  fallback = 'Inbound shipment',
): ReactNode {
  if (!orderNumber) return fallback;
  if (href) {
    return (
      <Link to={href} className="hover:text-emerald-700">
        {orderNumber}
      </Link>
    );
  }
  return orderNumber;
}

export function outboundOrderTitle(
  orderNumber: string | undefined,
  href: string | undefined,
  fallback: string,
): ReactNode {
  if (!orderNumber) return fallback;
  if (href) {
    return (
      <Link to={href} className="hover:text-emerald-700">
        {orderNumber}
      </Link>
    );
  }
  return orderNumber;
}

export function displayWarehouseLabel(warehouseId: string): string {
  const t = warehouseId.trim();
  return t.length ? t : '—';
}
