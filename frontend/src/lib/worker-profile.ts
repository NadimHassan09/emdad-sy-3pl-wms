import type { UserWorkerProfileSummary } from '../api/users';

export type WorkerOperationalRole =
  | 'receiver'
  | 'picker'
  | 'packer'
  | 'qa'
  | 'dispatcher';

export const WORKER_ROLE_OPTIONS: Array<{ value: WorkerOperationalRole; label: string }> = [
  { value: 'receiver', label: 'Receiver' },
  { value: 'picker', label: 'Picker' },
  { value: 'packer', label: 'Packer' },
  { value: 'qa', label: 'QA' },
  { value: 'dispatcher', label: 'Dispatcher' },
];

export const DEFAULT_WORKER_ROLES: WorkerOperationalRole[] = ['receiver', 'picker', 'packer'];

export function workerProfileStatusLabel(
  profile: UserWorkerProfileSummary | null | undefined,
  userStatus: string,
): 'linked' | 'missing' | 'inactive' {
  if (!profile) return 'missing';
  if (profile.status !== 'active' || userStatus !== 'active') return 'inactive';
  return 'linked';
}

export function workerProfileStatusText(
  profile: UserWorkerProfileSummary | null | undefined,
  userStatus: string,
  t: (en: string, ar: string) => string,
): string {
  const state = workerProfileStatusLabel(profile, userStatus);
  if (state === 'linked') return t('Linked', 'مرتبط');
  if (state === 'inactive') return t('Inactive', 'غير نشط');
  return t('Not linked', 'غير مرتبط');
}
