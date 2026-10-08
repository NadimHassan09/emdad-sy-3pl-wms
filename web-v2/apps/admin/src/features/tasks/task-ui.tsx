import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  ClipboardCheck,
  FileText,
  Package,
  PackageCheck,
  PackagePlus,
  Route,
  ShoppingBasket,
  ShieldAlert,
  Truck,
} from 'lucide-react'
import { StatusBadge, type Tone } from '@emdad/ui'

const TASK_STATUS_TONE: Record<string, Tone> = {
  pending: 'neutral',
  assigned: 'progress',
  in_progress: 'progress',
  completed: 'success',
  blocked: 'danger',
  failed: 'danger',
  retry_pending: 'warning',
  cancelled: 'neutral',
}

const TASK_STATUS_EN: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  blocked: 'Blocked',
  failed: 'Failed',
  retry_pending: 'Retry pending',
  cancelled: 'Cancelled',
}

const TASK_STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار',
  assigned: 'معين',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  blocked: 'محظور',
  failed: 'فشل',
  retry_pending: 'بانتظار إعادة المحاولة',
  cancelled: 'ملغي',
}

const TASK_TYPE_EN: Record<string, string> = {
  receiving: 'Receiving',
  qc: 'Quality check',
  putaway: 'Putaway',
  putaway_quarantine: 'Putaway (quarantine)',
  pick: 'Pick',
  pack: 'Pack',
  shipping_details: 'Shipping details',
  dispatch: 'Dispatch',
  routing: 'Routing',
}

const TASK_TYPE_AR: Record<string, string> = {
  receiving: 'استلام',
  qc: 'فحص الجودة',
  putaway: 'تخزين',
  putaway_quarantine: 'تخزين (حجر صحي)',
  pick: 'التقاط',
  pack: 'تغليف',
  shipping_details: 'تفاصيل الشحن',
  dispatch: 'إرسال',
  routing: 'توجيه',
}

export function taskStatusTone(status: string): Tone {
  return TASK_STATUS_TONE[status] ?? 'neutral'
}

export function taskStatusLabel(status: string, isArabic: boolean): string {
  const map = isArabic ? TASK_STATUS_AR : TASK_STATUS_EN
  return map[status] ?? status.replace(/_/g, ' ')
}

export function taskTypeLabel(taskType: string, isArabic: boolean): string {
  const map = isArabic ? TASK_TYPE_AR : TASK_TYPE_EN
  return map[taskType] ?? taskType.replace(/_/g, ' ')
}

export function TaskStatusBadge({ status, isArabic }: { status: string; isArabic?: boolean }) {
  return (
    <StatusBadge tone={taskStatusTone(status)}>
      {taskStatusLabel(status, isArabic ?? false)}
    </StatusBadge>
  )
}

const TASK_TYPE_TONE: Record<string, Tone> = {
  receiving: 'progress',
  qc: 'warning',
  putaway: 'ready',
  putaway_quarantine: 'danger',
  pick: 'transit',
  pack: 'pending',
  shipping_details: 'progress',
  dispatch: 'success',
  routing: 'neutral',
}

const TASK_TYPE_ICON: Record<string, LucideIcon> = {
  receiving: PackageCheck,
  qc: ClipboardCheck,
  putaway: PackagePlus,
  putaway_quarantine: ShieldAlert,
  pick: ShoppingBasket,
  pack: Package,
  shipping_details: FileText,
  dispatch: Truck,
  routing: Route,
}

export function taskTypeTone(taskType: string): Tone {
  return TASK_TYPE_TONE[taskType] ?? 'neutral'
}

/** Color-coded task-type pill with a fixed-size leading icon (no status dot). */
export function TaskTypeBadge({ taskType, isArabic }: { taskType: string; isArabic?: boolean }) {
  const Icon = TASK_TYPE_ICON[taskType] ?? Archive
  return (
    <StatusBadge tone={taskTypeTone(taskType)} dot={false} className="gap-1.5">
      <Icon className="size-3.5 shrink-0" aria-hidden strokeWidth={2} />
      {taskTypeLabel(taskType, isArabic ?? false)}
    </StatusBadge>
  )
}

/** Cycle count + line statuses share the same badge helper. */
export function CycleCountStatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  const CC_EN: Record<string, string> = {
    scheduled: 'Scheduled',
    in_progress: 'In progress',
    pending_review: 'Pending review',
    completed: 'Completed',
    cancelled: 'Cancelled',
    pending: 'Pending',
    counted: 'Counted',
    skipped: 'Skipped',
  }
  const CC_AR: Record<string, string> = {
    scheduled: 'مجدول',
    in_progress: 'قيد التنفيذ',
    pending_review: 'بانتظار المراجعة',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    pending: 'معلق',
    counted: 'معد',
    skipped: 'متخطى',
  }
  const CC_TONE: Record<string, Tone> = {
    scheduled: 'neutral',
    in_progress: 'progress',
    pending_review: 'warning',
    completed: 'success',
    cancelled: 'neutral',
    pending: 'neutral',
    counted: 'success',
    skipped: 'neutral',
  }
  const label = (isArabic ? CC_AR : CC_EN)[status] ?? status
  return <StatusBadge tone={CC_TONE[status] ?? 'neutral'}>{label}</StatusBadge>
}
