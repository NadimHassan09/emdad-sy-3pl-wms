import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { OmsApi, type OmsOrderListItem } from '../../api/oms';
import { OutboundApi } from '../../api/outbound';
import { ConfirmModal } from '../ConfirmModal';
import { RowActionsMenu } from '../RowActionsMenu';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { isOmsAdminCancellableStatus } from '../../lib/oms-order-cancel';
import { isOmsOrderDeletable } from '../../lib/oms-order-delete';
import { mapOmsCommercialDisplayStatus } from '../../lib/oms-commercial-status';
import { orderOperationalStage } from '../../lib/oms-operational-stage';
import { OmsOrderFormModal } from './OmsOrderFormModal';
import { OmsSingleShippingModal } from './OmsSingleShippingModal';
import { OmsWaybillModal } from './OmsWaybillModal';
import { OmsEditShippingFeeModal } from './OmsEditShippingFeeModal';
import { CancelShipmentModal } from './CancelShipmentModal';
import { useAuth } from '../../auth/AuthContext';

const WAYBILL_STATUSES = new Set([
  'ready_to_ship',
  'shipped',
  'out_for_delivery',
  'delivered',
  'failed_delivery',
  'return_pending_receipt',
  'returned',
  'cancelled',
]);

function canOrderHaveWaybill(row: OmsOrderListItem) {
  if (!WAYBILL_STATUSES.has(row.status)) return false;
  return Boolean(
    row.carrier?.trim() ||
      row.shippingCarrierName?.trim() ||
      row.trackingNumber?.trim() ||
      row.isManualShipping ||
      row.shippingMethod === 'manual',
  );
}

export function useOmsOrderRowActions({
  isArabic,
  batchId,
}: {
  isArabic: boolean;
  batchId?: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const canEditShippingFee =
    !user ||
    user?.role === 'super_admin' ||
    user?.role === 'wh_manager' ||
    user?.role === 'admin' ||
    user?.authGroup === 'ADMIN';
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<OmsOrderListItem | null>(null);
  const [cancelOrder, setCancelOrder] = useState<OmsOrderListItem | null>(null);
  const [cancelShipmentOrder, setCancelShipmentOrder] = useState<OmsOrderListItem | null>(null);
  const [rollbackModalOrder, setRollbackModalOrder] = useState<{
    order: OmsOrderListItem;
    target: 'out_for_delivery' | 'ready_to_ship';
  } | null>(null);
  const [shippingOrder, setShippingOrder] = useState<OmsOrderListItem | null>(null);
  const [waybillOrderId, setWaybillOrderId] = useState<string | null>(null);
  const [shippingFeeOrder, setShippingFeeOrder] = useState<OmsOrderListItem | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: QK.omsOrders });
    void qc.invalidateQueries({ queryKey: QK.omsBatches });
    if (batchId) void qc.invalidateQueries({ queryKey: QK.omsBatch(batchId) });
  };

  const editDetailQuery = useQuery({
    queryKey: [...QK.omsOrders, editOrderId],
    queryFn: () => OmsApi.getOrder(editOrderId!),
    enabled: Boolean(editOrderId),
  });

  const success = (message: string) => ({
    onSuccess: () => {
      toast.success(message);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.confirm(orderId),
    ...success(isArabic ? 'تم تأكيد الطلب.' : 'Order confirmed.'),
  });
  const approveMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.approve(orderId),
    ...success(isArabic ? 'تم اعتماد الطلب.' : 'Order approved.'),
  });
  const pickingMut = useMutation({
    mutationFn: (outboundId: string) => OutboundApi.completePicking(outboundId),
    ...success(isArabic ? 'تم إكمال مرحلة الالتقاط.' : 'Picking completed.'),
  });
  const packingMut = useMutation({
    mutationFn: (outboundId: string) => OutboundApi.completePacking(outboundId),
    ...success(isArabic ? 'تم إكمال مرحلة التعبئة.' : 'Packing completed.'),
  });
  const shippingConfirmMut = useMutation({
    mutationFn: (outboundId: string) => OutboundApi.completeShippingDetails(outboundId),
    ...success(isArabic ? 'تم تأكيد اكتمال الشحن.' : 'Shipping marked complete.'),
  });
  const dispatchMut = useMutation({
    mutationFn: (outboundId: string) => OutboundApi.completeDispatch(outboundId),
    ...success(isArabic ? 'تم إكمال الإرسال وخروج الشحنة للتسليم.' : 'Dispatch completed.'),
  });
  const deliveredMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.delivered(orderId),
    ...success(isArabic ? 'تم تأكيد تسليم الطلب.' : 'Order marked as delivered.'),
  });
  const ofdMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.outForDelivery(orderId),
    ...success(isArabic ? 'تم إعادة الطلب للخروج للتسليم.' : 'Order resumed out for delivery.'),
  });
  const failedMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.failedDelivery(orderId),
    ...success(isArabic ? 'تم تسجيل فشل التسليم.' : 'Order marked as Field Delivery.'),
  });
  const returnedMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.returned(orderId),
    ...success(
      isArabic
        ? 'تم إنشاء مرتجع بانتظار الاستلام.'
        : 'Return pending receipt created.',
    ),
  });
  const confirmReceiptMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.confirmReturnReceipt(orderId),
    ...success(
      isArabic ? 'تم تأكيد استلام المرتجع وإعادة المخزون.' : 'Return receipt confirmed and stock updated.',
    ),
  });
  const cancelMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.cancel(orderId),
    onSuccess: () => {
      toast.success(isArabic ? 'تم إلغاء الطلب.' : 'Order cancelled.');
      setCancelOrder(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMut = useMutation({
    mutationFn: (orderId: string) => OmsApi.delete(orderId),
    onSuccess: () => {
      toast.success(isArabic ? 'تم حذف الطلب.' : 'Order deleted.');
      setDeleteOrder(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });



  const rollbackReturnMut = useMutation({
    mutationFn: ({ orderId, target }: { orderId: string; target: 'out_for_delivery' | 'ready_to_ship' }) =>
      OmsApi.rollbackReturn(orderId, { targetStatus: target }),
    onSuccess: (res) => {
      toast.success(res.message || (isArabic ? 'تم التراجع وتحديث دورة الشحن.' : 'Return rolled back successfully.'));
      setRollbackModalOrder(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function menu(row: OmsOrderListItem) {
    const outboundId = row.outboundOrderId ?? row.linkedOutboundOrder?.id;
    const outboundStatus = row.linkedOutboundOrder?.status;
    const items: Array<{ key: string; label: string; onClick: () => void; danger?: boolean }> = [];

    if (row.status === 'waiting_for_confirmation') {
      items.push(
        { key: 'confirm', label: isArabic ? 'تأكيد الطلب' : 'Confirm', onClick: () => confirmMut.mutate(row.id) },
        { key: 'cancel', label: isArabic ? 'إلغاء الطلب' : 'Cancel', danger: true, onClick: () => setCancelOrder(row) },
      );
    }

    if (
      row.status === 'confirmed_waiting_for_admin_approval' ||
      row.status === 'pending_approval' ||
      row.status === 'pending'
    ) {
      if (!row.needsInformation) {
        items.push({ key: 'approve', label: isArabic ? 'اعتماد الطلب' : 'Approve', onClick: () => approveMut.mutate(row.id) });
      }
      items.push({ key: 'cancel', label: isArabic ? 'إلغاء الطلب' : 'Cancel', danger: true, onClick: () => setCancelOrder(row) });
    }

    if (mapOmsCommercialDisplayStatus(row.status) === 'processing') {
      items.push({
        key: 'instructionsPdf',
        label: isArabic ? 'تعليمات التنفيذ PDF' : 'Instructions PDF',
        onClick: () => {
          void OmsApi.downloadInstructionPdf(row.id, row.orderNumber).catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'Failed to download instructions.');
          });
        },
      });
    }

    if (row.status === 'processing' && outboundId) {
      if (
        outboundStatus === 'picking' ||
        outboundStatus === 'draft' ||
        outboundStatus === 'allocated' ||
        outboundStatus === 'pending_approval' ||
        outboundStatus === 'confirmed' ||
        outboundStatus === 'pending_stock'
      ) {
        items.push({
          key: 'completePicking',
          label: isArabic ? 'إكمال مرحلة الالتقاط' : 'Mark Picking as Complete',
          onClick: () => pickingMut.mutate(outboundId),
        });
      } else if (outboundStatus === 'packing') {
        items.push({
          key: 'completePacking',
          label: isArabic ? 'إكمال مرحلة التعبئة' : 'Mark Packing as Complete',
          onClick: () => packingMut.mutate(outboundId),
        });
      } else if (outboundStatus === 'waiting_for_shipping_method' || outboundStatus === 'waiting_for_shipping_details') {
        const sent = Boolean(
          row.trackingNumber?.trim() ||
            row.linkedOutboundOrder?.trackingNumber?.trim() ||
            row.linkedOutboundOrder?.hasCarrierShipment ||
            row.shippingMethod === 'manual' ||
            row.isManualShipping,
        );
        items.push(
          sent
            ? {
                key: 'confirmShippingComplete',
                label: isArabic ? 'تأكيد اكتمال الشحن' : 'Confirm Shipping Complete',
                onClick: () => shippingConfirmMut.mutate(outboundId),
              }
            : {
                key: 'completeShipping',
                label: isArabic ? 'إكمال تفاصيل الشحن' : 'Complete Shipping Details',
                onClick: () => setShippingOrder(row),
              },
        );
      }
    }

    if (row.status === 'ready_to_ship') {
      const stage = orderOperationalStage(row);
      if (stage === 'shipping_details') {
        items.push({
          key: 'completeShipping',
          label: isArabic ? 'إكمال تفاصيل الشحن' : 'Complete Shipping Details',
          onClick: () => setShippingOrder(row),
        });
      } else if (stage === 'shipping_confirmation') {
        items.push({
          key: 'cancelShipment',
          label: isArabic ? 'إلغاء الشحنة والعودة لتفاصيل الشحن' : 'Cancel Shipment',
          danger: true,
          onClick: () => setCancelShipmentOrder(row),
        });
        if (outboundId) {
          items.push({
            key: 'confirmShippingComplete',
            label: isArabic ? 'تأكيد اكتمال الشحن' : 'Confirm Shipping Complete',
            onClick: () => shippingConfirmMut.mutate(outboundId),
          });
        }
      }
      if (outboundId) {
        items.push({
          key: 'completeDispatch',
          label: isArabic ? 'إكمال الإرسال والخروج للتسليم' : 'Mark Dispatch as Complete',
          onClick: () => dispatchMut.mutate(outboundId),
        });
      }
    }

    if (row.status === 'shipped' || row.status === 'out_for_delivery') {
      items.push(
        { key: 'markDelivered', label: isArabic ? 'تم التسليم بنجاح' : 'Mark as Delivered', onClick: () => deliveredMut.mutate(row.id) },
        {
          key: 'markFailedDelivery',
          label: isArabic ? 'فشل التسليم' : 'Field Delivery',
          danger: true,
          onClick: () => failedMut.mutate(row.id),
        },
      );
    } else if (row.status === 'failed_delivery') {
      items.push(
        {
          key: 'resumeOfd',
          label: isArabic ? 'خارج للتسليم' : 'Out for Delivery',
          onClick: () => ofdMut.mutate(row.id),
        },
        {
          key: 'markDelivered',
          label: isArabic ? 'تم التسليم' : 'Delivered',
          onClick: () => deliveredMut.mutate(row.id),
        },
        {
          key: 'markReturned',
          label: isArabic ? 'مرتجع بانتظار الاستلام' : 'Return Pending Receipt',
          danger: true,
          onClick: () => returnedMut.mutate(row.id),
        },
      );
    } else if (row.status === 'return_pending_receipt') {
      items.push({
        key: 'confirmReceipt',
        label: isArabic ? 'تأكيد استلام المرتجع' : 'Confirm Return Receipt',
        onClick: () => confirmReceiptMut.mutate(row.id),
      });
    } else if (row.status === 'returned') {
      items.push(
        {
          key: 'rollbackOfd',
          label: isArabic ? 'إعادة الإرسال مع الناقل الأصلي (خارج للتسليم)' : 'Rollback to Out for Delivery (Reship with original carrier)',
          onClick: () => setRollbackModalOrder({ order: row, target: 'out_for_delivery' }),
        },
        {
          key: 'rollbackReady',
          label: isArabic ? 'إعادة لتجهيز الشحن (جاهز للشحن)' : 'Rollback to Ready to Ship',
          onClick: () => setRollbackModalOrder({ order: row, target: 'ready_to_ship' }),
        },
      );
    }

    if (
      isOmsAdminCancellableStatus(row.status) &&
      row.status !== 'cancelled' &&
      row.status !== 'waiting_for_confirmation' &&
      row.status !== 'confirmed_waiting_for_admin_approval' &&
      row.status !== 'pending_approval' &&
      row.status !== 'pending'
    ) {
      items.push({ key: 'cancel', label: isArabic ? 'إلغاء الطلب' : 'Cancel', danger: true, onClick: () => setCancelOrder(row) });
    }

    items.push({ key: 'edit', label: isArabic ? 'تعديل' : 'Edit', onClick: () => setEditOrderId(row.id) });

    if (canOrderHaveWaybill(row)) {
      items.push({
        key: 'waybill',
        label: isArabic ? 'بوليصة الشحن (طباعة / PDF)' : 'Shipping Waybill (Print / PDF)',
        onClick: () => setWaybillOrderId(row.id),
      });
    }

    if (canEditShippingFee) {
      items.push({
        key: 'editShippingFee',
        label: isArabic ? 'تعديل رسوم الشحن' : 'Edit Shipping Fee',
        onClick: () => setShippingFeeOrder(row),
      });
    } else if (row.status === 'delivered' || row.status === 'completed') {
      items.push({
        key: 'shippingFee',
        label: isArabic ? 'تحديد رسوم الشحن' : 'Specify shipping fee',
        onClick: () => navigate(`/orders/oms/${row.id}`, { state: { openShippingFee: true } }),
      });
    }

    if (isOmsOrderDeletable(row.status)) {
      items.push({ key: 'delete', label: isArabic ? 'حذف' : 'Delete', danger: true, onClick: () => setDeleteOrder(row) });
    }

    return (
      <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <RowActionsMenu ariaLabel={isArabic ? 'إجراءات الطلب' : 'Open actions'} items={items} />
      </div>
    );
  }

  const modals: ReactNode = (
    <>
      {editOrderId ? (
        <OmsOrderFormModal
          open
          mode="edit"
          initial={editDetailQuery.data ?? null}
          onClose={() => setEditOrderId(null)}
          onSaved={() => {
            setEditOrderId(null);
            refresh();
          }}
        />
      ) : null}
      <OmsWaybillModal open={Boolean(waybillOrderId)} orderId={waybillOrderId} onClose={() => setWaybillOrderId(null)} isArabic={isArabic} />
      <OmsSingleShippingModal
        open={Boolean(shippingOrder)}
        order={shippingOrder}
        onClose={() => setShippingOrder(null)}
        onSuccess={() => {
          setShippingOrder(null);
          refresh();
        }}
        isArabic={isArabic}
      />
      <ConfirmModal
        open={Boolean(deleteOrder)}
        title={isArabic ? 'حذف الطلب؟' : 'Delete OMS order?'}
        confirmLabel={isArabic ? 'حذف' : 'Delete'}
        danger
        loading={deleteMut.isPending}
        onClose={() => !deleteMut.isPending && setDeleteOrder(null)}
        onConfirm={() => {
          if (deleteOrder) deleteMut.mutate(deleteOrder.id);
        }}
      >
        {deleteOrder
          ? isArabic
            ? `حذف ${deleteOrder.orderNumber}؟ لا يمكن التراجع.`
            : `Delete ${deleteOrder.orderNumber}? This cannot be undone.`
          : null}
      </ConfirmModal>
      <ConfirmModal
        open={Boolean(cancelOrder)}
        title={
          isArabic
            ? `هل أنت متأكد من إلغاء الطلب ${cancelOrder?.orderNumber ?? ''}؟`
            : `Cancel OMS order ${cancelOrder?.orderNumber ?? ''}?`
        }
        confirmLabel={isArabic ? 'إلغاء الطلب' : 'Cancel order'}
        cancelLabel={isArabic ? 'تراجع' : 'Keep order'}
        danger
        cancelVariant="success"
        loading={cancelMut.isPending}
        onClose={() => !cancelMut.isPending && setCancelOrder(null)}
        onConfirm={() => cancelOrder && cancelMut.mutate(cancelOrder.id)}
      >
        <p className="text-sm">
          {isArabic ? 'سيتم تحويل حالة الطلب إلى ملغي ولن يتم تنفيذ الشحنة.' : 'The order will be marked cancelled.'}
        </p>
      </ConfirmModal>
      <OmsEditShippingFeeModal
        open={Boolean(shippingFeeOrder)}
        orders={shippingFeeOrder ? [shippingFeeOrder] : []}
        onClose={() => setShippingFeeOrder(null)}
        onSuccess={() => {
          setShippingFeeOrder(null);
          refresh();
        }}
        isArabic={isArabic}
      />
      <CancelShipmentModal
        open={Boolean(cancelShipmentOrder)}
        order={cancelShipmentOrder}
        onClose={() => setCancelShipmentOrder(null)}
        onSuccess={() => {
          setCancelShipmentOrder(null);
          refresh();
        }}
        isArabic={isArabic}
      />
      <ConfirmModal
        open={Boolean(rollbackModalOrder)}
        title={
          rollbackModalOrder?.target === 'out_for_delivery'
            ? isArabic
              ? `إعادة الإرسال مع الناقل الأصلي (${rollbackModalOrder?.order?.orderNumber ?? ''})؟`
              : `Reship with original carrier (${rollbackModalOrder?.order?.orderNumber ?? ''})?`
            : isArabic
            ? `إعادة الطلب لتجهيز الشحن (${rollbackModalOrder?.order?.orderNumber ?? ''})؟`
            : `Rollback to Ready to Ship (${rollbackModalOrder?.order?.orderNumber ?? ''})?`
        }
        confirmLabel={
          rollbackModalOrder?.target === 'out_for_delivery'
            ? isArabic ? 'إعادة الإرسال وخروج للتسليم' : 'Reship & Out for Delivery'
            : isArabic ? 'إعادة لتفاصيل الشحن' : 'Rollback to Ready to Ship'
        }
        cancelLabel={isArabic ? 'إلغاء' : 'Close'}
        loading={rollbackReturnMut.isPending}
        onClose={() => !rollbackReturnMut.isPending && setRollbackModalOrder(null)}
        onConfirm={() =>
          rollbackModalOrder &&
          rollbackReturnMut.mutate({
            orderId: rollbackModalOrder.order.id,
            target: rollbackModalOrder.target,
          })
        }
      >
        <div className="space-y-2 text-sm">
          {rollbackModalOrder?.target === 'out_for_delivery' ? (
            <p>
              {isArabic
                ? 'سيتم عكس المخزون من موقع المرتجعات، وإرسال شحنة جديدة للناقل الأصلي فوراً عبر الـ API. لن يتم تحويل حالة الطلب إلى "خارج للتسليم" إلا بعد قبول الناقل للشحنة بنجاح.'
                : 'Inventory will be reversed from the Returns location and a reshipment will be submitted to the original carrier via API. The order will ONLY advance to Out for Delivery upon confirmed carrier acceptance.'}
            </p>
          ) : (
            <p>
              {isArabic
                ? 'سيتم عكس المخزون من موقع المرتجعات وإعادة الطلب إلى حالة "جاهز للشحن" في مرحلة "تفاصيل الشحن". لن يتم إنشاء أي شحنة للناقل تلقائياً، مما يتيح لك مراجعة البيانات أو اختيار شركة شحن أخرى.'
                : 'Inventory will be reversed from the Returns location and the order will return to "Ready to Ship" / "Shipping Details". No shipment will be auto-submitted, allowing you to review details or select a different carrier.'}
            </p>
          )}
        </div>
      </ConfirmModal>
    </>
  );

  return { menu, modals };
}
