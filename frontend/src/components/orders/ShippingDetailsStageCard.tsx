import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { OutboundOrder } from '../../api/outbound';
import { OutboundApi } from '../../api/outbound';
import {
  computeSuggestedVolumeCbm,
  computeSuggestedWeightKg,
  orderShippingDetailsToPayload,
  orderShippingFieldsFromApi,
  type OrderShippingFieldsValue,
} from '../../api/shipping';
import { Alert, Button, Card } from '@ds';
import { ConfirmModal } from '../ConfirmModal';
import { OrderShippingFields } from '../shipping/OrderShippingFields';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { invalidateWorkflowTasksInventory } from '../../lib/invalidate-wms-queries';

type Props = {
  order: OutboundOrder;
  /** When false, workers may save only (carrier send/complete stay on Admin order page). */
  allowSendAndComplete?: boolean;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-text-strong">{value || '—'}</dd>
    </div>
  );
}

export function ShippingDetailsStageCard({
  order,
  allowSendAndComplete = true,
}: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const carrierMethod = order.shippingMethod === 'carrier';
  const latestShipment = order.carrierShipments?.[0] ?? null;
  const shipmentCreated = latestShipment?.status === 'created';
  const detailsLocked = shipmentCreated;

  const suggestedWeightKg = useMemo(() => {
    const lines = (order.lines ?? []).map((l) => ({
      productId: l.productId,
      requestedQuantity: l.requestedQuantity,
    }));
    const products = (order.lines ?? [])
      .map((l) => l.product)
      .filter((p): p is NonNullable<typeof p> => !!p);
    return computeSuggestedWeightKg(lines, products);
  }, [order.lines]);

  const suggestedVolumeCbm = useMemo(() => {
    const lines = (order.lines ?? []).map((l) => ({
      productId: l.productId,
      requestedQuantity: l.requestedQuantity,
    }));
    const products = (order.lines ?? [])
      .map((l) => l.product)
      .filter((p): p is NonNullable<typeof p> => !!p);
    return computeSuggestedVolumeCbm(lines, products);
  }, [order.lines]);

  const suggestedContents = useMemo(() => {
    const names = (order.lines ?? [])
      .map((l) => l.product?.name)
      .filter((n): n is string => Boolean(n));
    return names.length ? names.join(', ') : '';
  }, [order.lines]);

  const [editing, setEditing] = useState(!detailsLocked);
  const [fields, setFields] = useState<OrderShippingFieldsValue>(() => {
    const base = orderShippingFieldsFromApi(order);
    if (!base.shippingContents.trim() && suggestedContents) {
      base.shippingContents = suggestedContents;
    }
    if (!base.shippingWeightKg.trim() && suggestedWeightKg != null) {
      base.shippingWeightKg = String(suggestedWeightKg);
    }
    if (!base.shippingVolumeCbm.trim() && suggestedVolumeCbm != null) {
      base.shippingVolumeCbm = String(suggestedVolumeCbm);
    }
    if (!base.shippingPackageType) {
      base.shippingPackageType = 'box';
    }
    if (!base.shippingPickupType) {
      base.shippingPickupType = 'hub';
    }
    if (!base.shippingDeliveryType) {
      base.shippingDeliveryType = 'hub';
    }
    return base;
  });
  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    const base = orderShippingFieldsFromApi(order);
    if (!base.shippingContents.trim() && suggestedContents) {
      base.shippingContents = suggestedContents;
    }
    if (!base.shippingWeightKg.trim() && suggestedWeightKg != null) {
      base.shippingWeightKg = String(suggestedWeightKg);
    }
    if (!base.shippingVolumeCbm.trim() && suggestedVolumeCbm != null) {
      base.shippingVolumeCbm = String(suggestedVolumeCbm);
    }
    if (!base.shippingPackageType) {
      base.shippingPackageType = 'box';
    }
    if (!base.shippingPickupType) {
      base.shippingPickupType = 'hub';
    }
    if (!base.shippingDeliveryType) {
      base.shippingDeliveryType = 'hub';
    }
    setFields(base);
    if (detailsLocked) setEditing(false);
  }, [order, detailsLocked, suggestedContents, suggestedWeightKg, suggestedVolumeCbm]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] });
    qc.invalidateQueries({ queryKey: QK.outboundOrders });
    invalidateWorkflowTasksInventory(qc, {
      referenceId: order.id,
      referenceType: 'outbound_order',
    });
  };

  const saveMut = useMutation({
    mutationFn: () =>
      OutboundApi.saveShippingDetails(
        order.id,
        orderShippingDetailsToPayload(fields),
        order.companyId,
      ),
    onSuccess: () => {
      toast.success('Shipping details saved.');
      setEditing(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMut = useMutation({
    mutationFn: () => OutboundApi.sendShippingDetails(order.id, order.companyId),
    onSuccess: () => {
      toast.success('Shipment sent to carrier. AWB created.');
      setSendOpen(false);
      setEditing(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeMut = useMutation({
    mutationFn: () => OutboundApi.completeShippingDetails(order.id, order.companyId),
    onSuccess: () => {
      toast.success('Shipping details complete. Waiting for Dispatch.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSend =
    allowSendAndComplete &&
    carrierMethod &&
    !shipmentCreated &&
    order.status === 'waiting_for_shipping_details';
  const canComplete =
    allowSendAndComplete &&
    order.status === 'waiting_for_shipping_details' &&
    (!carrierMethod || shipmentCreated);

  return (
    <>
      <Card padding="none">
        <Card.Header>
          <Card.Title>Shipping Details</Card.Title>
          <div className="flex flex-wrap gap-2">
            {!detailsLocked && !editing ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            ) : null}
            {!detailsLocked && editing ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                Save
              </Button>
            ) : null}
            {canSend ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={editing}
                title={editing ? 'Save shipping details before sending.' : undefined}
                onClick={() => setSendOpen(true)}
              >
                Send Shipment
              </Button>
            ) : null}
            {canComplete ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={completeMut.isPending}
                onClick={() => completeMut.mutate()}
              >
                Mark Shipping Details as Complete
              </Button>
            ) : null}
          </div>
        </Card.Header>
        <Card.Body className="space-y-4">
          {carrierMethod && shipmentCreated ? (
            <Alert variant="success" title="Carrier shipment created">
              AWB{' '}
              <span className="font-mono font-semibold">
                {latestShipment?.externalAwb?.trim() ||
                  latestShipment?.trackingNumber?.trim() ||
                  order.trackingNumber?.trim() ||
                  '—'}
              </span>
              . Status remains Waiting for Shipping Details until you mark complete.
            </Alert>
          ) : null}

          {carrierMethod && latestShipment?.status === 'failed' ? (
            <Alert variant="error" title="Carrier send failed">
              {latestShipment.lastErrorSafe?.trim() || 'Submission failed. Fix details and Send again.'}
            </Alert>
          ) : null}

          {!allowSendAndComplete && carrierMethod ? (
            <Alert variant="info" title="Admin completes carrier handoff">
              Save package details here. An admin must Send Shipment and Mark Complete on the
              outbound order page.
            </Alert>
          ) : null}

          {editing && !detailsLocked ? (
            <OrderShippingFields
              value={fields}
              onChange={setFields}
              showTitle={false}
              suggestedWeightKg={suggestedWeightKg}
              suggestedVolumeCbm={suggestedVolumeCbm}
              disabled={saveMut.isPending}
              destination={{
                governorate: order.city ?? '',
                city: order.district ?? '',
                neighborhood: order.addressLine1 ?? '',
              }}
              codAmount={order.codAmount != null ? Number(order.codAmount) : null}
            />
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <DetailRow
                label="Method"
                value={carrierMethod ? 'Shipping Company' : 'Manual'}
              />
              {carrierMethod ? (
                <DetailRow
                  label="Company"
                  value={order.shippingProviderCode?.trim() || '—'}
                />
              ) : null}
              {carrierMethod ? (
                <>
                  <DetailRow
                    label="Weight (kg)"
                    value={
                      order.shippingWeightKg != null ? String(order.shippingWeightKg) : '—'
                    }
                  />
                  <DetailRow
                    label="Package"
                    value={order.shippingPackageType?.trim() || '—'}
                  />
                  <DetailRow
                    label="Delivery"
                    value={order.shippingDeliveryType?.trim() || '—'}
                  />
                  <DetailRow
                    label="Pickup"
                    value={order.shippingPickupType?.trim() || '—'}
                  />
                  <DetailRow label="Payer" value={order.shippingPayer?.trim() || '—'} />
                  <DetailRow
                    label="Contents"
                    value={order.shippingContents?.trim() || '—'}
                  />
                </>
              ) : (
                <DetailRow
                  label="Note"
                  value="Manual shipping — no carrier API. Mark complete when ready for dispatch."
                />
              )}
              {shipmentCreated ? (
                <>
                  <DetailRow
                    label="AWB"
                    value={
                      latestShipment?.externalAwb?.trim() ||
                      order.trackingNumber?.trim() ||
                      '—'
                    }
                  />
                  <DetailRow
                    label="Tracking"
                    value={
                      latestShipment?.trackingNumber?.trim() ||
                      order.trackingNumber?.trim() ||
                      '—'
                    }
                  />
                </>
              ) : null}
            </dl>
          )}
        </Card.Body>
      </Card>

      <ConfirmModal
        open={sendOpen}
        title="Send Shipment?"
        confirmLabel="Send Shipment"
        loading={sendMut.isPending}
        onClose={() => !sendMut.isPending && setSendOpen(false)}
        onConfirm={() => sendMut.mutate()}
      >
        This submits the shipment to the carrier and creates an AWB. The order stays in Waiting
        for Shipping Details until you mark shipping details complete.
      </ConfirmModal>
    </>
  );
}
