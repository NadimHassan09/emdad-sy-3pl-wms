import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ConfirmInboundBody, InboundApi, InboundOrderLine, ReceiveLineInput } from '../api/inbound';
import { Alert, Button, FILTER_APPLY_BUTTON_CLASS, Skeleton } from '@ds';
import { ReceivingDockPicker } from '../components/locations/ReceivingDockPicker';
import { StorageLocationPicker } from '../components/locations/StorageLocationPicker';

import { useAuth } from '../auth/AuthContext';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { OrderDocumentsCard } from '../components/documents/OrderDocumentsCard';
import { FILTER_RESET_BUTTON_CLASS, FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { OrderNextTaskHandoff } from '../components/tasks/OrderNextTaskHandoff';
import { WorkflowOrderTimeline } from '../components/WorkflowOrderTimeline';
import { OrderWorkspaceLayout } from '../components/orders/OrderWorkspaceLayout';
import { InboundReceivingStagePanel } from '../components/orders/InboundReceivingStagePanel';
import { InboundPutawayStagePanel } from '../components/orders/InboundPutawayStagePanel';
import { OrderWorkspaceDocumentsSection } from '../components/orders/OrderWorkspaceDocumentsSection';
import { AdminInboundOrderSummary } from '../components/orders/AdminInboundOrderSummary';
import { usesAdminOrderExecutionUi } from '../lib/execution-plan';
import { WorkflowsApi } from '../api/workflows';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useOrderWorkspaceMode } from '../hooks/useOrderWorkspaceMode';
import { useTaskOnlyMode } from '../hooks/useTaskOnlyMode';
import { useInboundWorkspaceSection } from '../lib/order-workspace-section';
import { findTimelineTask, isCompletedTaskStatus } from '../lib/order-workspace-tasks';
import { generateLotNumber } from '../lib/identifiers';
import { invalidateWorkflowTasksInventory } from '../lib/invalidate-wms-queries';
import { inboundHasQuantityShortfall } from '../lib/inbound-shortfall';
import { canAccessInternalTransfer } from '../lib/rbac';
import { findNextRunnableTask, taskDetailHref } from '../lib/workflow-next-task';

const fmtQty = (s: string) => Number(s).toLocaleString(undefined, { maximumFractionDigits: 4 });
function inboundDetailLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'All inbound orders': 'جميع طلبات الوارد',
    'Inbound order': 'طلب وارد',
    'Order details': 'تفاصيل الطلب',
    'Receiving setup': 'إعداد الاستلام',
    Lines: 'البنود',
    Client: 'العميل',
    Created: 'تاريخ الإنشاء',
    'Cancel order': 'إلغاء الطلب',
    'Delete order': 'حذف الطلب',
    'Delete this order?': 'حذف هذا الطلب؟',
    'This permanently removes the order and its lines. This action cannot be undone.':
      'سيؤدي هذا إلى حذف الطلب وبنوده نهائياً. لا يمكن التراجع عن هذا الإجراء.',
    Delete: 'حذف',
    Cancel: 'إلغاء',
    'Order deleted.': 'تم حذف الطلب.',
    'Confirm order': 'تأكيد الطلب',
    'Start workflow': 'بدء سير العمل',
    Overview: 'نظرة عامة',
    Receiving: 'الاستلام',
    Putaway: 'الإيداع',
    Documents: 'المستندات',
    Activity: 'النشاط',
    Notes: 'ملاحظات',
    History: 'السجل',
    'Approve order': 'اعتماد الطلب',
    'Order #': 'رقم الطلب #',
    Status: 'الحالة',
    'Expected arrival': 'تاريخ الوصول المتوقع',
    'Confirmed at': 'تم التأكيد في',
    'Completed at': 'تم الإكمال في',
    Warehouse: 'المستودع',
    SKU: 'رمز الصنف',
    Product: 'المنتج',
    Lot: 'الدفعة',
    Expected: 'المتوقع',
    Action: 'الإجراء',
    Receive: 'استلام',
  };
  return ar[label] ?? label;
}

export function InboundDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = canAccessInternalTransfer(user?.role);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [receivingLine, setReceivingLine] = useState<InboundOrderLine | null>(null);

  const taskOnlyMode = useTaskOnlyMode();
  const orderWorkspaceMode = useOrderWorkspaceMode();
  const { activeSection, setSection } = useInboundWorkspaceSection();
  const [stageFooter, setStageFooter] = useState<ReactNode>(null);
  const { warehouseId, warehouses } = useDefaultWarehouseId();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  /** Single receiving dock applied to every line when confirming (task-only workflow). */
  const [receivingDockId, setReceivingDockId] = useState('');
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => inboundDetailLabel(label, isArabic);

  const effectiveWarehouseId =
    (selectedWarehouseId && warehouses.some((w) => w.id === selectedWarehouseId)
      ? selectedWarehouseId
      : warehouseId) || '';

  useEffect(() => {
    setSelectedWarehouseId((cur) =>
      cur && warehouses.some((w) => w.id === cur) ? cur : warehouseId,
    );
  }, [warehouseId, warehouses]);

  useEffect(() => {
    setReceivingDockId('');
  }, [id]);

  const order = useQuery({
    queryKey: [...QK.inboundOrders, id],
    queryFn: () => InboundApi.get(id),
    enabled: !!id,
  });

  const workflowTimeline = useQuery({
    queryKey: QK.workflows.timeline('inbound_order', id),
    queryFn: () => WorkflowsApi.getTimeline('inbound_order', id, order.data?.companyId),
    enabled: !!id && orderWorkspaceMode && !!order.data,
  });

  const confirmMut = useMutation({
    mutationFn: (body?: ConfirmInboundBody | null) =>
      InboundApi.confirm(id, body === null ? {} : body ?? {}, order.data?.companyId),
    onSuccess: async () => {
      toast.success(
        taskOnlyMode
          ? orderWorkspaceMode
            ? 'Workflow started.'
            : 'Order confirmed / workflow started.'
          : 'Order confirmed.',
      );
      qc.invalidateQueries({ queryKey: [...QK.inboundOrders, id] });
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
      invalidateWorkflowTasksInventory(qc, { referenceId: id, referenceType: 'inbound_order' });
      if (orderWorkspaceMode && taskOnlyMode) {
        setSection('receiving');
        return;
      }
      if (!taskOnlyMode) return;
      try {
        const companyId = order.data?.companyId;
        const timeline = await WorkflowsApi.getTimeline('inbound_order', id, companyId);
        await qc.invalidateQueries({ queryKey: QK.workflows.workflowTimelineByRef(id) });
        const next = findNextRunnableTask(timeline.tasks ?? [], 'inbound_order');
        if (next) {
          navigate(taskDetailHref(next.id, companyId));
        }
      } catch {
        /* CTA on page covers handoff if auto-nav fails */
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => InboundApi.cancel(id),
    onSuccess: () => {
      toast.success('Order cancelled.');
      qc.invalidateQueries({ queryKey: [...QK.inboundOrders, id] });
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => InboundApi.remove(id),
    onSuccess: () => {
      toast.success(t('Order deleted.'));
      setDeleteOpen(false);
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
      navigate('/orders/inbound');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const receiveMut = useMutation({
    mutationFn: (vars: { lineId: string; input: ReceiveLineInput }) =>
      InboundApi.receive(id, vars.lineId, vars.input),
    onSuccess: () => {
      toast.success('Items received and stock updated.');
      qc.invalidateQueries({ queryKey: [...QK.inboundOrders, id] });
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
      invalidateWorkflowTasksInventory(qc, { referenceId: id, referenceType: 'inbound_order' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!id) return null;
  if (order.isLoading) {
    return (
      <div className="space-y-4 animate-enter">
        <Skeleton height={20} width="30%" />
        <Skeleton height={180} />
        <Skeleton height={220} />
      </div>
    );
  }
  if (order.isError || !order.data) {
    return (
      <div className="animate-enter">
        <Alert variant="error" title="Failed to load inbound order." />
      </div>
    );
  }

  const o = order.data;

  // Admin Order Execution: plan → print → one Confirm (default for admin + client portal orders).
  // Workers mode keeps the task/stage workspace.
  if (orderWorkspaceMode && usesAdminOrderExecutionUi(o.executionMode)) {
    return <AdminInboundOrderSummary order={o} />;
  }

  const canConfirm = o.status === 'draft' || o.status === 'pending_approval';
  const canCancel =
    o.status === 'draft' || o.status === 'pending_approval' || o.status === 'confirmed';
  const canDelete = isAdmin && o.status === 'cancelled';
  const canReceive =
    !taskOnlyMode && ['confirmed', 'in_progress', 'partially_received'].includes(o.status);

  const confirmDisabledTaskOnly =
    taskOnlyMode && canConfirm && (!effectiveWarehouseId || !receivingDockId.trim());

  const lineColumns: Column<InboundOrderLine>[] = [
    { header: '#', accessor: (l) => l.lineNumber, width: '50px' },
    {
      header: t('SKU'),
      accessor: (l) => <span className="font-mono">{l.product?.sku ?? '—'}</span>,
      width: '200px',
    },
    { header: t('Product'), accessor: (l) => l.product?.name ?? '—' },
    {
      header: t('Lot'),
      accessor: (l) => (l.expectedLotNumber ? <span className="font-mono">{l.expectedLotNumber}</span> : '—'),
      width: '180px',
    },
    {
      header: t('Expected'),
      accessor: (l) => <span className="font-mono">{fmtQty(l.expectedQuantity)}</span>,
      width: '100px',
      className: 'text-right',
    },
  ];

  if (!taskOnlyMode) {
    lineColumns.push({
      header: t('Action'),
      accessor: (l) => {
        const rem = Number(l.expectedQuantity) - Number(l.receivedQuantity);
        if (rem <= 0) return <span className="text-xs text-status-success-fg">complete</span>;
        return (
          <Button size="sm" disabled={!canReceive} onClick={() => setReceivingLine(l)}>
            {t('Receive')}
          </Button>
        );
      },
      width: '120px',
    });
  }

  if (orderWorkspaceMode) {
    const wfTasks = workflowTimeline.data?.tasks ?? [];
    const receivingTask = findTimelineTask(wfTasks, 'receiving');
    const receivingCompleted = receivingTask ? isCompletedTaskStatus(receivingTask.status) : false;
    const workflowStarted = o.status !== 'draft' && o.status !== 'pending_approval';

    const headerActions =
      canCancel || canDelete || canConfirm ? (
        <>
          {canDelete ? (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => setDeleteOpen(true)}
              loading={deleteMut.isPending}
            >
              {t('Delete order')}
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => cancelMut.mutate()}
              loading={cancelMut.isPending}
            >
              {t('Cancel order')}
            </Button>
          ) : null}
        </>
      ) : undefined;

    const confirmButton =
      canConfirm && activeSection === 'overview' ? (
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => {
            if (taskOnlyMode) {
              const stagingByLineId = Object.fromEntries(
                o.lines.map((l) => [l.id, receivingDockId.trim()]),
              );
              confirmMut.mutate({
                warehouseId: effectiveWarehouseId,
                stagingByLineId,
              });
            } else {
              confirmMut.mutate(null);
            }
          }}
          loading={confirmMut.isPending}
          disabled={confirmDisabledTaskOnly}
        >
          {o.status === 'pending_approval'
            ? t('Approve order')
            : taskOnlyMode
              ? t('Start workflow')
              : t('Confirm order')}
        </Button>
      ) : null;

    return (
      <>
        <OrderWorkspaceLayout
          title={o.orderNumber || t('Inbound order')}
          subtitle={o.company?.name ?? undefined}
          statusBadge={<StatusBadge status={o.status} />}
          backTo="/orders/inbound"
          backLabel={t('All inbound orders')}
          sections={[
            { id: 'overview', label: t('Overview') },
            { id: 'receiving', label: t('Receiving'), disabled: !workflowStarted },
            {
              id: 'putaway',
              label: t('Putaway'),
              disabled: false,
            },
            { id: 'documents', label: t('Documents') },
            { id: 'activity', label: t('Activity'), disabled: !workflowStarted },
            { id: 'notes', label: t('Notes') },
            { id: 'history', label: t('History') },
          ]}
          activeSection={activeSection}
          onSectionChange={(sectionId) => {
            setStageFooter(null);
            setSection(sectionId as typeof activeSection);
          }}
          headerActions={
            headerActions || confirmButton ? (
              <>
                {headerActions}
                {confirmButton}
              </>
            ) : undefined
          }
          footer={['receiving', 'putaway'].includes(activeSection) ? stageFooter : undefined}
        >
          {activeSection === 'overview' ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                <Field label={t('Order #')} value={<span className="font-mono">{o.orderNumber || '—'}</span>} />
                <Field label={t('Status')} value={<StatusBadge status={o.status} />} />
                <Field label={t('Client')} value={o.company?.name ?? '—'} />
                <Field
                  label={t('Expected arrival')}
                  value={new Date(o.expectedArrivalDate).toLocaleDateString()}
                />
                <Field
                  label={t('Confirmed at')}
                  value={o.confirmedAt ? new Date(o.confirmedAt).toLocaleString() : '—'}
                />
                <Field
                  label={t('Completed at')}
                  value={o.completedAt ? new Date(o.completedAt).toLocaleString() : '—'}
                />
              </div>
              {taskOnlyMode && canConfirm ? (
                <div className="rounded-lg border border-border bg-surface-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-text-strong">{t('Receiving setup')}</h3>
                  {warehouses.length > 1 ? (
                    <Combobox
                      label="Warehouse for workflow"
                      required
                      value={selectedWarehouseId || warehouseId}
                      onChange={setSelectedWarehouseId}
                      options={warehouses
                        .filter((w) => w.status === 'active')
                        .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))}
                      placeholder="Select warehouse…"
                    />
                  ) : null}
                  {effectiveWarehouseId ? (
                    <ReceivingDockPicker
                      warehouseId={effectiveWarehouseId}
                      value={receivingDockId}
                      onChange={setReceivingDockId}
                    />
                  ) : (
                    <p className="text-xs text-status-danger-fg">
                      Set default warehouse or VITE_DEFAULT_WAREHOUSE_ID.
                    </p>
                  )}
                </div>
              ) : null}
              <DataTable title={t('Lines')} columns={lineColumns} rows={o.lines} rowKey={(l) => l.id} />
            </div>
          ) : null}

          {activeSection === 'receiving' ? (
            <InboundReceivingStagePanel
              order={o}
              companyId={o.companyId}
              warehouseId={effectiveWarehouseId}
              renderFooter={setStageFooter}
              onConfirmed={() => setSection('putaway')}
            />
          ) : null}

          {activeSection === 'putaway' ? (
            <InboundPutawayStagePanel
              order={o}
              companyId={o.companyId}
              warehouseId={effectiveWarehouseId}
              receivingCompleted={receivingCompleted}
              renderFooter={setStageFooter}
            />
          ) : null}

          {activeSection === 'documents' ? (
            <OrderWorkspaceDocumentsSection mode="inbound" order={o} companyId={o.companyId} />
          ) : null}

          {activeSection === 'activity' ? (
            <WorkflowOrderTimeline
              referenceType="inbound_order"
              referenceId={id}
              enabled={!!id && o.status !== 'draft'}
              companyIdOverride={o.companyId}
            />
          ) : null}

          {activeSection === 'notes' ? (
            <div className="rounded-lg border border-border bg-surface-card p-4">
              <h3 className="text-sm font-semibold text-text-strong">{t('Notes')}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-body">
                {o.notes?.trim() ? o.notes : '—'}
              </p>
            </div>
          ) : null}

          {activeSection === 'history' ? (
            <div className="space-y-2 rounded-lg border border-border bg-surface-card p-4 text-sm">
              <div className="flex justify-between gap-3 border-b border-border-subtle py-2">
                <span className="text-text-muted">{t('Created')}</span>
                <span className="font-medium text-text-strong">
                  {new Date(o.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-3 border-b border-border-subtle py-2">
                <span className="text-text-muted">{t('Confirmed at')}</span>
                <span className="font-medium text-text-strong">
                  {o.confirmedAt ? new Date(o.confirmedAt).toLocaleString() : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <span className="text-text-muted">{t('Completed at')}</span>
                <span className="font-medium text-text-strong">
                  {o.completedAt ? new Date(o.completedAt).toLocaleString() : '—'}
                </span>
              </div>
            </div>
          ) : null}
        </OrderWorkspaceLayout>

        <ConfirmModal
          open={deleteOpen}
          title={t('Delete this order?')}
          confirmLabel={t('Delete')}
          cancelLabel={t('Cancel')}
          danger
          loading={deleteMut.isPending}
          onClose={() => !deleteMut.isPending && setDeleteOpen(false)}
          onConfirm={() => deleteMut.mutate()}
        >
          <p className="text-sm">
            {t('This permanently removes the order and its lines. This action cannot be undone.')}
          </p>
        </ConfirmModal>
      </>
    );
  }

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/orders/inbound"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        {t('All inbound orders')}
      </Link>
      <FilterPanel
        title={t('Order details')}
        variant="content"
        headerActions={
          canCancel || canDelete || canConfirm ? (
            <>
              {canDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={() => setDeleteOpen(true)}
                  loading={deleteMut.isPending}
                  className={`${FILTER_RESET_BUTTON_CLASS} h-[34px] !py-0`}
                >
                  {t('Delete order')}
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={() => cancelMut.mutate()}
                  loading={cancelMut.isPending}
                  className={`${FILTER_RESET_BUTTON_CLASS} h-[34px] !py-0`}
                >
                  {t('Cancel order')}
                </Button>
              ) : null}
              {canConfirm ? (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (taskOnlyMode) {
                      const stagingByLineId = Object.fromEntries(
                        o.lines.map((l) => [l.id, receivingDockId.trim()]),
                      );
                      confirmMut.mutate({
                        warehouseId: effectiveWarehouseId,
                        stagingByLineId,
                      });
                    } else {
                      confirmMut.mutate(null);
                    }
                  }}
                  loading={confirmMut.isPending}
                  disabled={confirmDisabledTaskOnly}
                  className={`${FILTER_APPLY_BUTTON_CLASS} h-[34px] !py-0`}
                >
                  {o.status === 'pending_approval' ? t('Approve order') : t('Confirm order')}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <Field label={t('Order #')} value={<span className="font-mono">{o.orderNumber || '—'}</span>} />
        <Field
          label={t('Status')}
          value={
            <div className="space-y-1">
              <StatusBadge status={o.status} />
              {inboundHasQuantityShortfall(o) && o.status === 'partially_received' ? (
                <div className="text-xs text-status-warning-fg">Some lines received below expected quantity.</div>
              ) : null}
              {inboundHasQuantityShortfall(o) && o.status === 'completed' ? (
                <div className="text-xs text-status-warning-fg">Completed with missing quantities on one or more lines.</div>
              ) : null}
            </div>
          }
        />
        <Field label={t('Client')} value={o.company?.name ?? '—'} />
        <Field label={t('Expected arrival')} value={new Date(o.expectedArrivalDate).toLocaleDateString()} />
        <Field label={t('Confirmed at')} value={o.confirmedAt ? new Date(o.confirmedAt).toLocaleString() : '—'} />
        <Field label={t('Completed at')} value={o.completedAt ? new Date(o.completedAt).toLocaleString() : '—'} />
        <div className="col-span-2 md:col-span-4">
          <Field
            label={t('Notes')}
            value={o.notes ? <span className="whitespace-pre-wrap">{o.notes}</span> : '—'}
          />
        </div>
        </div>
      </FilterPanel>

      {taskOnlyMode && canConfirm ? (
        <FilterPanel title={t('Receiving setup')} variant="content">
          <div className="space-y-3 text-sm">
            {warehouses.length > 1 ? (
              <Combobox
                label="Warehouse for workflow"
                required
                value={selectedWarehouseId || warehouseId}
                onChange={setSelectedWarehouseId}
                options={warehouses
                  .filter((w) => w.status === 'active')
                  .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))}
                placeholder="Select warehouse…"
              />
            ) : null}
            {!effectiveWarehouseId ? (
              <p className="text-xs text-status-danger-fg">Set default warehouse or VITE_DEFAULT_WAREHOUSE_ID.</p>
            ) : (
              <ReceivingDockPicker
                warehouseId={effectiveWarehouseId}
                value={receivingDockId}
                onChange={setReceivingDockId}
              />
            )}
          </div>
        </FilterPanel>
      ) : null}

      <OrderNextTaskHandoff
        referenceType="inbound_order"
        referenceId={id}
        companyIdOverride={o.companyId}
        enabled={!!id && o.status !== 'draft' && o.status !== 'pending_approval' && o.status !== 'cancelled'}
      />

      <WorkflowOrderTimeline
        referenceType="inbound_order"
        referenceId={id}
        enabled={!!id && o.status !== 'draft'}
        companyIdOverride={o.companyId}
      />

      <OrderDocumentsCard
        referenceType="inbound_order"
        referenceId={id}
        companyIdOverride={o.companyId}
      />

      <DataTable
        title={o.orderNumber || t('Inbound order')}
        columns={lineColumns}
        rows={o.lines}
        rowKey={(l) => l.id}
      />

      {!taskOnlyMode && (
        <ReceiveModal
          line={receivingLine}
          warehouseId={effectiveWarehouseId}
          loading={receiveMut.isPending}
          onClose={() => setReceivingLine(null)}
          onSubmit={(input) =>
            receivingLine && receiveMut.mutate({ lineId: receivingLine.id, input })
          }
        />
      )}

      <ConfirmModal
        open={deleteOpen}
        title={t('Delete this order?')}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        danger
        loading={deleteMut.isPending}
        onClose={() => !deleteMut.isPending && setDeleteOpen(false)}
        onConfirm={() => deleteMut.mutate()}
      >
        <p className="text-sm">
          {t('This permanently removes the order and its lines. This action cannot be undone.')}
        </p>
      </ConfirmModal>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-text-strong">{value}</dd>
    </div>
  );
}

interface ReceiveModalProps {
  line: InboundOrderLine | null;
  warehouseId: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: ReceiveLineInput) => void;
}

function ReceiveModal({ line, warehouseId, loading, onClose, onSubmit }: ReceiveModalProps) {
  const [quantity, setQuantity] = useState('');
  const [locationId, setLocationId] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [overrideLot, setOverrideLot] = useState(false);
  const [advancedEdit, setAdvancedEdit] = useState(false);

  const isLot = line?.product?.trackingType === 'lot';
  const expectedLot = line?.expectedLotNumber?.trim() || '';
  const lotLocked = isLot && !!expectedLot && !overrideLot;
  const showExpiry = isLot && (line?.product?.expiryTracking ?? false);
  const expectedExpiry = line?.expectedExpiryDate;

  useEffect(() => {
    if (line) {
      setLotNumber(expectedLot);
      setOverrideLot(false);
      setAdvancedEdit(false);
      setQuantity('');
      setLocationId('');
      setExpiry(expectedExpiry ? expectedExpiry.slice(0, 10) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  const close = () => {
    if (loading) return;
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!line) return;

    const q = Number(quantity);
    const base: ReceiveLineInput = { quantity: q, locationId };

    if (!isLot) {
      onSubmit(base);
      return;
    }

    const useServerLotExpiry =
      !!expectedLot && lotLocked && !overrideLot && !advancedEdit;

    if (useServerLotExpiry) {
      onSubmit(base);
      return;
    }

    const ln = lotNumber.trim();
    if (!ln) return;

    let override = false;
    if (overrideLot && expectedLot && ln !== expectedLot) override = true;
    if (!overrideLot && advancedEdit && expectedLot && ln !== expectedLot) override = true;

    const next: ReceiveLineInput = {
      ...base,
      lotNumber: ln,
      ...(override ? { overrideLot: true as const } : {}),
    };

    if (showExpiry) {
      if (advancedEdit || !expectedExpiry) {
        if (!expiry.trim()) return;
        next.expiryDate = expiry.trim();
      }
    }

    onSubmit(next);
  };

  if (!line) return null;
  const remaining = Number(line.expectedQuantity) - Number(line.receivedQuantity);

  const showEditableExpiry =
    showExpiry && (advancedEdit || !expectedExpiry || overrideLot);

  return (
    <Modal
      open={!!line}
      onClose={close}
      title={`Receive ${line.product?.sku ?? ''}`}
      footer={
        <>
          <Button type="button" variant="danger" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button form="receive" type="submit" loading={loading}>
            Receive
          </Button>
        </>
      }
    >
      <form id="receive" onSubmit={submit} className="space-y-3">
        <div className="rounded-md bg-surface-sunken p-3 text-xs text-text-body">
          <div>Expected: {fmtQty(line.expectedQuantity)}</div>
          <div>Received so far: {fmtQty(line.receivedQuantity)}</div>
          <div>Remaining: {remaining.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
        </div>

        <TextField
          label="Quantity to receive"
          type="number"
          min={0}
          step="0.0001"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          hint="Database trigger blocks > 110% of expected."
        />

        {warehouseId ? (
          <StorageLocationPicker
            warehouseId={warehouseId}
            value={locationId}
            onChange={setLocationId}
            required
          />
        ) : (
          <p className="text-xs text-status-danger-fg">Set default warehouse to choose a receive location.</p>
        )}

        {isLot && (
          <div className="space-y-2">
            {expectedLot && (
              <div className="rounded border border-border bg-surface-card px-3 py-2 text-xs text-text-body">
                <span className="font-medium text-text-muted">Expected lot:</span>{' '}
                <span className="font-mono">{expectedLot}</span>
              </div>
            )}
            {showExpiry && expectedExpiry && !advancedEdit && !overrideLot && (
              <div className="rounded border border-status-success-border bg-status-success-bg px-3 py-2 text-xs text-status-success-fg">
                <span className="font-medium">Expected expiry:</span>{' '}
                <span>{new Date(expectedExpiry).toLocaleDateString()}</span>
                {' — '}used automatically unless you unlock editing.
              </div>
            )}

            {(expectedLot || (showExpiry && !!expectedExpiry)) && (
              <label className="flex items-center gap-2 text-sm text-text-body">
                <input
                  type="checkbox"
                  checked={advancedEdit}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setAdvancedEdit(on);
                    if (!on && expectedLot) setLotNumber(expectedLot);
                  }}
                />
                Edit lot / expiry manually
              </label>
            )}

            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <TextField
                label={
                  advancedEdit ? 'Lot number' : lotLocked ? 'Lot number (from order)' : 'Lot number'
                }
                required
                disabled={lotLocked && !advancedEdit}
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
              />
              {expectedLot ? (
                <Button
                  type="button"
                  size="sm"
                  variant={overrideLot ? 'primary' : 'secondary'}
                  onClick={() => {
                    const next = !overrideLot;
                    setOverrideLot(next);
                    if (!next) {
                      setLotNumber(expectedLot);
                      setAdvancedEdit(false);
                    }
                  }}
                  title={overrideLot ? 'Revert to locked expected lot' : 'Override locked lot number'}
                >
                  {overrideLot ? 'Use expected lot' : 'Override Lot Number'}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setLotNumber(generateLotNumber())}
                >
                  Generate
                </Button>
              )}
            </div>

            {showExpiry && (
              <TextField
                label={
                  advancedEdit || !expectedExpiry
                    ? 'Expiry date'
                    : 'Expiry date (shown for reference — unlock to change)'
                }
                type="date"
                required={showEditableExpiry}
                disabled={showExpiry && !!expectedExpiry && !advancedEdit && !overrideLot}
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
