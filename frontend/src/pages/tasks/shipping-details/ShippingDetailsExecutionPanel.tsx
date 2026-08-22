import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { OutboundApi } from '../../../api/outbound';
import { Alert, Button } from '@ds';
import { CarrierShippingDetailsForm } from '../../../components/shipping/CarrierShippingDetailsForm';
import {
  buildCarrierShippingFormFromOrder,
  carrierFormToSavePayload,
  type CarrierShippingFormValue,
} from '../../../components/shipping/carrier-shipping-form';
import { StatusBadge } from '../../../components/StatusBadge';
import { useToast } from '../../../components/ToastProvider';
import { QK } from '../../../constants/query-keys';
import { localizedTaskTypeTitle, type TFn } from '../../../lib/ui-labels/task-execution';
import { useWmsTranslation } from '../../../lib/ui-i18n';

type Props = {
  taskId: string;
  outboundOrderId: string;
  companyIdOverride?: string;
  taskStatus: string;
  submit: (body: unknown) => void;
  busy: boolean;
  readOnly?: boolean;
};

export function ShippingDetailsExecutionPanel({
  outboundOrderId,
  companyIdOverride,
  taskStatus,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const { t } = useWmsTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const isCompleted = taskStatus === 'completed' || readOnly;

  const orderQuery = useQuery({
    queryKey: [...QK.outboundOrders, outboundOrderId],
    queryFn: () => OutboundApi.get(outboundOrderId),
    enabled: !!outboundOrderId,
  });

  const order = orderQuery.data;
  const carrierMethod = order?.shippingMethod === 'carrier';
  const shipmentCreated =
    order?.carrierShipments?.some((s) => s.status === 'created') ?? false;

  const [form, setForm] = useState<CarrierShippingFormValue | null>(null);

  useEffect(() => {
    if (order) setForm(buildCarrierShippingFormFromOrder(order));
  }, [order]);

  const codAmount = useMemo(() => {
    const raw = order?.codAmount;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [order?.codAmount]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('Form not ready');
      return OutboundApi.saveShippingDetails(
        outboundOrderId,
        {
          ...carrierFormToSavePayload(form),
          shippingMethod: order?.shippingMethod ?? 'carrier',
          shippingProviderCode:
            form.shippingProviderCode.trim() || order?.shippingProviderCode || null,
        },
        companyIdOverride ?? order?.companyId,
      );
    },
    onSuccess: () => {
      toast.success(t(['Shipping details saved.', 'تم حفظ تفاصيل الشحن.']));
      qc.invalidateQueries({ queryKey: [...QK.outboundOrders, outboundOrderId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pending = busy || saveMut.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text-strong">
            {localizedTaskTypeTitle('shipping_details', t as TFn)}
          </h2>
          {order ? (
            <Link
              to={`/orders/outbound/${order.id}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              {order.orderNumber}
            </Link>
          ) : null}
        </div>
        <StatusBadge status={taskStatus} />
      </div>

      {carrierMethod && !shipmentCreated ? (
        <Alert variant="info" title={t(['Admin sends to carrier', 'المسؤول يرسل للناقل'])}>
          {t([
            'Save package details here. An admin must Send Shipment and Mark Complete on the outbound order page.',
            'احفظ تفاصيل الطرد هنا. يجب على المسؤول إرسال الشحنة وإكمال التفاصيل من صفحة الطلب.',
          ])}
        </Alert>
      ) : null}

      {carrierMethod && shipmentCreated ? (
        <Alert variant="success" title={t(['Carrier AWB ready', 'بوليصة الناقل جاهزة'])}>
          {t([
            'Carrier shipment exists. Completing this task moves the order to Waiting for Dispatch.',
            'شحنة الناقل موجودة. إكمال هذه المهمة ينقل الطلب إلى انتظار الإرسال.',
          ])}
        </Alert>
      ) : null}

      {!carrierMethod ? (
        <Alert variant="info" title={t(['Manual shipping', 'شحن يدوي'])}>
          {t([
            'Save details if needed, then Mark Complete to move the order to Waiting for Dispatch.',
            'احفظ التفاصيل إن لزم، ثم أكمل لنقل الطلب إلى انتظار الإرسال.',
          ])}
        </Alert>
      ) : null}

      {orderQuery.isError ? (
        <Alert variant="error" title={t(['Failed to load order', 'فشل تحميل الطلب'])}>
          {(orderQuery.error as Error).message}
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-surface-card p-4 space-y-4">
        {form && carrierMethod ? (
          <CarrierShippingDetailsForm
            value={form}
            onChange={setForm}
            locked={isCompleted || shipmentCreated}
            disabled={isCompleted || pending}
            hideCarrierSelect
            codAmount={codAmount}
            showTitle={false}
          />
        ) : !carrierMethod ? (
          <p className="text-sm text-text-muted">
            {t([
              'Manual shipping — no carrier form required.',
              'شحن يدوي — لا يلزم نموذج شركة شحن.',
            ])}
          </p>
        ) : (
          <p className="text-sm text-text-muted">{t(['Loading…', 'جاري التحميل…'])}</p>
        )}

        {!isCompleted ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              loading={saveMut.isPending}
              disabled={pending || shipmentCreated || !form}
              onClick={() => saveMut.mutate()}
            >
              {t(['Save', 'حفظ'])}
            </Button>
            {!carrierMethod || shipmentCreated ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={busy}
                disabled={pending || !form}
                onClick={() =>
                  submit({
                    task_type: 'shipping_details',
                    ...(form ? carrierFormToSavePayload(form) : {}),
                  })
                }
              >
                {t(['Mark Complete', 'إكمال'])}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
