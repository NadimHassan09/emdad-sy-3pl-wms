import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { OutboundOrder } from '../../api/outbound';
import { OutboundApi } from '../../api/outbound';
import { Alert, Button, Card } from '@ds';
import { ConfirmModal } from '../ConfirmModal';
import { CarrierShippingDetailsForm } from '../shipping/CarrierShippingDetailsForm';
import { parsePackedShipmentError } from '../shipping/ShipmentErrorActions';
import {
  buildCarrierShippingFormFromOrder,
  carrierFormToSavePayload,
  getBabelPackingValidationError,
  hasOverPacking,
  isBabelProvider,
  packingSummary,
  type CarrierShippingFormValue,
} from '../shipping/carrier-shipping-form';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { invalidateWorkflowTasksInventory } from '../../lib/invalidate-wms-queries';
import { formatStoredPayerLabel } from '../../lib/shipping-payer';

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
  const sendError = parsePackedShipmentError(latestShipment?.lastErrorSafe);
  const shipmentCreated = latestShipment?.status === 'created';
  const detailsLocked = shipmentCreated;

  const [editing, setEditing] = useState(!detailsLocked);
  const [form, setForm] = useState<CarrierShippingFormValue>(() =>
    buildCarrierShippingFormFromOrder(order),
  );
  const [sendOpen, setSendOpen] = useState(false);
  const [quotesRefreshing, setQuotesRefreshing] = useState(false);
  const [selectedCarrierAvailable, setSelectedCarrierAvailable] = useState(() =>
    Boolean(order.shippingProviderCode?.trim()),
  );

  useEffect(() => {
    setForm(buildCarrierShippingFormFromOrder(order));
    setSelectedCarrierAvailable(Boolean(order.shippingProviderCode?.trim()));
    if (detailsLocked) setEditing(false);
  }, [order, detailsLocked]);

  const codAmount = useMemo(() => {
    const raw = order.codAmount;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [order.codAmount]);

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
        {
          ...carrierFormToSavePayload(form),
          shippingMethod: order.shippingMethod ?? 'carrier',
          shippingProviderCode:
            form.shippingProviderCode.trim() || order.shippingProviderCode || null,
        },
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
    mutationFn: () =>
      OutboundApi.sendShippingDetails(order.id, order.companyId, {
        ...(form.quoteFingerprint ? { quoteFingerprint: form.quoteFingerprint } : {}),
      }),
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

  const isBabel = isBabelProvider(form.shippingProviderCode);
  const babelValidationError = useMemo(
    () => (isBabel && form.packageType === 'box' ? getBabelPackingValidationError(form.cartons, form.catalog, false) : null),
    [isBabel, form.packageType, form.cartons, form.catalog],
  );

  const canSend =
    allowSendAndComplete &&
    carrierMethod &&
    !shipmentCreated &&
    (!isBabel || !babelValidationError) &&
    order.status === 'waiting_for_shipping_details';
  const canComplete =
    allowSendAndComplete &&
    order.status === 'waiting_for_shipping_details' &&
    (!carrierMethod || shipmentCreated);

  const deliveryLabel =
    order.shippingDeliveryType === 'hub'
      ? 'Branch delivery'
      : order.shippingDeliveryType === 'address'
        ? 'Home delivery'
        : String(order.shippingDeliveryType || '').trim() || '—';

  const packingInvalid = useMemo(
    () => hasOverPacking(packingSummary(form.cartons, form.catalog)) || Boolean(babelValidationError),
    [form.cartons, form.catalog, babelValidationError],
  );

  const canSaveEdit =
    !quotesRefreshing &&
    !packingInvalid &&
    (!isBabel || !babelValidationError) &&
    form.shippingProviderCode.trim() !== '' &&
    selectedCarrierAvailable;

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
                disabled={!canSaveEdit}
                title={
                  quotesRefreshing
                    ? 'Wait until carrier availability finishes updating.'
                    : !form.shippingProviderCode.trim()
                      ? 'Select an available shipping company.'
                      : !selectedCarrierAvailable
                        ? 'Selected carrier is not available for the current details.'
                        : undefined
                }
                onClick={() => saveMut.mutate()}
              >
                {quotesRefreshing ? 'Updating carriers…' : 'Save'}
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

          {carrierMethod && latestShipment?.status === 'failed' &&
          /^Manually cancelled by admin/i.test(latestShipment?.lastErrorSafe || '') ? (
            <Alert variant="warning" title="Cancelled locally — carrier not notified">
              {latestShipment.lastErrorSafe?.replace(/^Manually cancelled by admin:\s*/i, '') ||
                'The order was cancelled locally. Cancel manually in the carrier portal if needed.'}
            </Alert>
          ) : carrierMethod && latestShipment?.status === 'failed' ? (
            <Alert variant="error" title="Carrier send failed">
              {sendError?.message || 'Submission failed. Fix details and Send again.'}
              {sendError?.requiredAction ? (
                <div className="mt-1 text-xs">{sendError.requiredAction}</div>
              ) : null}
            </Alert>
          ) : null}

          {carrierMethod &&
          shipmentCreated &&
          /cancellation is not confirmed/i.test(latestShipment?.lastErrorSafe || '') ? (
            <Alert variant="warning" title="Carrier lookup pending">
              The carrier did not return this shipment. Cancellation is not confirmed. The current
              AWB stays assigned until you replace the carrier from Shipping Details.
            </Alert>
          ) : null}

          {!allowSendAndComplete && carrierMethod ? (
            <Alert variant="info" title="Admin completes carrier handoff">
              Save package details here. An admin must Send Shipment and Mark Complete on the
              outbound order page.
            </Alert>
          ) : null}

          {editing && !detailsLocked && carrierMethod ? (
            <CarrierShippingDetailsForm
              value={form}
              onChange={setForm}
              disabled={saveMut.isPending}
              codAmount={codAmount}
              showTitle={false}
              onQuotesRefreshingChange={setQuotesRefreshing}
              onSelectedCarrierAvailableChange={setSelectedCarrierAvailable}
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
              <DetailRow label="Governorate" value={order.city?.trim() || '—'} />
              <DetailRow label="City / Region" value={order.district?.trim() || '—'} />
              <DetailRow
                label="Town / Neighborhood"
                value={order.addressLine1?.trim() || '—'}
              />
              <DetailRow
                label="Street / Detailed Address"
                value={order.addressLine2?.trim() || '—'}
              />
              {carrierMethod ? (
                <>
                  <DetailRow
                    label="Shipment type"
                    value={
                      order.shippingPackageType === 'envelope'
                        ? 'Envelope'
                        : order.shippingPackageType === 'box'
                          ? 'Parcel'
                          : '—'
                    }
                  />
                  <DetailRow
                    label="Weight (kg)"
                    value={
                      order.shippingWeightKg != null ? String(order.shippingWeightKg) : '—'
                    }
                  />
                  <DetailRow label="Delivery" value={deliveryLabel} />
                  <DetailRow
                    label="Currency"
                    value={(order.currency ?? 'USD').trim() || 'USD'}
                  />
                  <DetailRow
                    label="Payer"
                    value={
                      order.shippingPayer === 'receiver'
                        ? `${formatStoredPayerLabel(order.shippingPayer, false)} (المستلم يتحمل تكلفة الشحن)`
                        : `${formatStoredPayerLabel(order.shippingPayer, false)} (إمداد تتحمل تكلفة الشحن)`
                    }
                  />
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
