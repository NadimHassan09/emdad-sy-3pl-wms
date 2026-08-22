import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  OmsApi,
  OmsReturnsApi,
  type OmsOrderDetail,
  type OmsReturn,
} from '../../api/oms';
import { Button } from '../Button';
import { Combobox } from '../Combobox';
import { Modal } from '../Modal';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { useDebounced } from '../../lib/useDebounced';
import { useTenantCompanyId } from '../../hooks/useTenantCompanyId';

const DISCRETE_UOMS = new Set(['piece', 'box', 'roll', 'pallet', 'carton']);

function isDiscreteUom(uom: string | undefined): boolean {
  return !!uom && DISCRETE_UOMS.has(uom);
}

function sumAlreadyReturnedByProduct(returns: OmsReturn[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of returns ?? []) {
    if (r.status === 'rejected' || r.status === 'cancelled') continue;
    for (const line of r.lines) {
      map.set(line.productId, (map.get(line.productId) ?? 0) + Number(line.quantity));
    }
  }
  return map;
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** When set, skip order picker and load this order directly. */
  initialOrderId?: string;
  onSuccess?: (created: OmsReturn) => void;
  isArabic?: boolean;
};

export function CreateOmsReturnModal({
  open,
  onClose,
  initialOrderId,
  onSuccess,
  isArabic = false,
}: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const companyId = useTenantCompanyId();
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});

  const debouncedOrderSearch = useDebounced(orderSearch, 300);
  const activeOrderId = initialOrderId || selectedOrderId;
  const showOrderPicker = !initialOrderId;

  useEffect(() => {
    if (!open) return;
    setSelectedOrderId('');
    setOrderSearch('');
    setReturnReason('');
    setReturnQty({});
  }, [open, initialOrderId]);

  const orderSearchQuery = useQuery({
    queryKey: [...QK.omsOrders, 'return-create-search', companyId, debouncedOrderSearch],
    queryFn: () =>
      OmsApi.list({
        companyId: companyId || undefined,
        status: 'delivered',
        orderSearch: debouncedOrderSearch.trim() || undefined,
        limit: 20,
      }),
    enabled: open && showOrderPicker,
    staleTime: 15_000,
  });

  const orderQuery = useQuery({
    queryKey: [...QK.omsOrders, 'return-create', activeOrderId],
    queryFn: () => OmsApi.getOrder(activeOrderId),
    enabled: open && !!activeOrderId,
  });

  const returnsQuery = useQuery({
    queryKey: ['oms-returns', 'return-create', activeOrderId],
    queryFn: () => OmsReturnsApi.list({ omsOrderId: activeOrderId, limit: 100 }),
    enabled: open && !!activeOrderId,
  });

  const order = orderQuery.data;
  const alreadyReturnedByProduct = useMemo(
    () => sumAlreadyReturnedByProduct(returnsQuery.data?.items),
    [returnsQuery.data],
  );

  useEffect(() => {
    if (!open || !order) return;
    setReturnQty(Object.fromEntries(order.lines.map((l) => [l.id, '0'])));
  }, [open, order?.id]);

  const orderOptions = useMemo(() => {
    const items = orderSearchQuery.data?.items ?? [];
    return [
      { value: '', label: t('Select delivered OMS order…', 'اختر طلب OMS مسلّم…') },
      ...items.map((o) => ({
        value: o.id,
        label: [o.orderNumber, o.company?.name, o.recipientName, o.recipientPhone]
          .filter(Boolean)
          .join(' · '),
      })),
    ];
  }, [orderSearchQuery.data, isArabic]);

  const createMut = useMutation({
    mutationFn: () => {
      if (!order) throw new Error(t('Select an OMS order first.', 'اختر طلب OMS أولاً.'));
      if (order.status !== 'delivered') {
        throw new Error(
          t(
            'OMS returns can only be created for Delivered orders.',
            'يمكن إنشاء مرتجعات OMS فقط للطلبات المسلّمة.',
          ),
        );
      }

      const lines = order.lines
        .map((line) => {
          const raw = returnQty[line.id] ?? '';
          const qty = Number(raw);
          if (!Number.isFinite(qty) || qty <= 0) return null;

          const ordered = Number(line.requestedQuantity);
          const already = alreadyReturnedByProduct.get(line.productId) ?? 0;
          const available = Math.max(0, ordered - already);
          if (qty > available) {
            throw new Error(
              t(
                `Return qty for ${line.product?.sku ?? line.productId} exceeds available (${available}).`,
                `كمية الإرجاع لـ ${line.product?.sku ?? line.productId} تتجاوز المتاح (${available}).`,
              ),
            );
          }
          if (qty < 0) {
            throw new Error(t('Return quantities cannot be negative.', 'لا يمكن أن تكون كميات الإرجاع سالبة.'));
          }
          const uom = line.product?.uom;
          if (isDiscreteUom(uom) && !Number.isInteger(qty)) {
            throw new Error(
              t(
                `Return qty for ${line.product?.sku ?? line.productId} must be a whole number.`,
                `يجب أن تكون كمية الإرجاع لـ ${line.product?.sku ?? line.productId} عدداً صحيحاً.`,
              ),
            );
          }

          return {
            productId: line.productId,
            quantity: qty,
            unitPrice: line.unitPrice != null ? Number(line.unitPrice) : undefined,
          };
        })
        .filter(Boolean) as Array<{ productId: string; quantity: number; unitPrice?: number }>;

      if (lines.length === 0) {
        throw new Error(
          t('Enter a return quantity for at least one line.', 'أدخل كمية إرجاع لبند واحد على الأقل.'),
        );
      }

      return OmsReturnsApi.create({
        omsOrderId: order.id,
        reason: returnReason.trim() || undefined,
        lines,
      });
    },
    onSuccess: (created) => {
      toast.success(t('Return request created.', 'تم إنشاء طلب الإرجاع.'));
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
      if (order) {
        void qc.invalidateQueries({ queryKey: [...QK.omsOrders, order.id] });
        void qc.invalidateQueries({ queryKey: ['oms-returns', 'by-order', order.id] });
      }
      onSuccess?.(created);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loadingOrder = !!activeOrderId && (orderQuery.isLoading || returnsQuery.isLoading);
  const orderLoadError =
    orderQuery.isError || (order && order.status !== 'delivered' && !initialOrderId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Create OMS return', 'إنشاء مرتجع OMS')}
      widthClass="max-w-2xl"
    >
      <div className="space-y-4">
        {showOrderPicker ? (
          <div className="space-y-3">
            <TextField
              label={t('Search OMS order', 'بحث طلب OMS')}
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder={t(
                'Order #, reference, client, customer, phone…',
                'رقم الطلب، المرجع، العميل، الزبون، الهاتف…',
              )}
            />
            <Combobox
              label={t('Delivered OMS order', 'طلب OMS مسلّم')}
              value={selectedOrderId}
              onChange={setSelectedOrderId}
              options={orderOptions}
              disabled={orderSearchQuery.isFetching && !orderSearchQuery.data}
            />
            {orderSearchQuery.isFetching ? (
              <p className="text-xs text-text-muted">{t('Searching orders…', 'جاري البحث عن الطلبات…')}</p>
            ) : null}
          </div>
        ) : null}

        {loadingOrder ? (
          <p className="text-sm text-text-muted">{t('Loading order…', 'جاري تحميل الطلب…')}</p>
        ) : null}

        {orderLoadError && !loadingOrder ? (
          <p className="text-sm text-status-error-fg">
            {orderQuery.error instanceof Error
              ? orderQuery.error.message
              : t(
                  'This order is not eligible for return (must be Delivered).',
                  'هذا الطلب غير مؤهل للإرجاع (يجب أن يكون مسلّماً).',
                )}
          </p>
        ) : null}

        {order && order.status === 'delivered' && !loadingOrder ? (
          <>
            <div className="rounded-lg border border-border bg-surface-card-muted px-3 py-2 text-sm">
              <div className="font-medium text-text-strong">{order.orderNumber}</div>
              <div className="text-xs text-text-muted">
                {[order.company?.name, order.recipientName, order.clientReference]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </div>
            </div>

            <TextField
              label={t('Reason (optional)', 'السبب (اختياري)')}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-text-muted">
                {t('Return quantities', 'كميات الإرجاع')}
              </div>
              {order.lines.map((line) => (
                <ReturnLineRow
                  key={line.id}
                  line={line}
                  alreadyReturned={alreadyReturnedByProduct.get(line.productId) ?? 0}
                  value={returnQty[line.id] ?? ''}
                  onChange={(v) => setReturnQty((prev) => ({ ...prev, [line.id]: v }))}
                  isArabic={isArabic}
                />
              ))}
            </div>
          </>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="danger" onClick={onClose} disabled={createMut.isPending}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            loading={createMut.isPending}
            disabled={!order || order.status !== 'delivered' || loadingOrder || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {t('Submit return', 'إرسال الإرجاع')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReturnLineRow({
  line,
  alreadyReturned,
  value,
  onChange,
  isArabic,
}: {
  line: OmsOrderDetail['lines'][number];
  alreadyReturned: number;
  value: string;
  onChange: (value: string) => void;
  isArabic: boolean;
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const ordered = Number(line.requestedQuantity);
  const available = Math.max(0, ordered - alreadyReturned);
  const discrete = isDiscreteUom(line.product?.uom);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-sm text-text-body">
        {line.product?.name ?? line.product?.sku ?? line.productId}
        <span className="ml-2 text-xs text-text-muted">
          {t('Ordered', 'مطلوب')} {ordered} · {t('Returned', 'مُرجَع')} {alreadyReturned} ·{' '}
          {t('Available', 'متاح')} {available}
        </span>
      </span>
      <input
        type="number"
        min={0}
        max={available}
        step={discrete ? 1 : 'any'}
        value={value}
        onChange={(e) => {
          let v = e.target.value;
          if (v !== '' && Number(v) > available) v = String(available);
          if (v !== '' && Number(v) < 0) v = '0';
          if (discrete && v.includes('.')) v = v.split('.')[0] ?? '0';
          onChange(v);
        }}
        className="w-24 rounded-lg border border-border px-2 py-1 text-sm"
        aria-label={t('Return quantity', 'كمية الإرجاع')}
      />
    </div>
  );
}
