/** Part IV — static labels / stages for task execution UI (server still drives behavior). */
export type TaskUiStage = 'inbound' | 'qc_storage' | 'outbound';

export interface TaskUiMeta {
  label: string;
  stage: TaskUiStage;
}

const DEFAULT_META: TaskUiMeta = { label: 'Warehouse task', stage: 'inbound' };

const MAP: Record<string, TaskUiMeta> = {
  receiving: { label: 'Dock receiving', stage: 'inbound' },
  qc: { label: 'Inbound QC', stage: 'qc_storage' },
  putaway: { label: 'Putaway to storage', stage: 'qc_storage' },
  putaway_quarantine: { label: 'Quarantine putaway', stage: 'qc_storage' },
  pick: { label: 'Order pick', stage: 'outbound' },
  pack: { label: 'Pack', stage: 'outbound' },
  dispatch: { label: 'Dispatch / ship', stage: 'outbound' },
  routing: { label: 'Routing', stage: 'outbound' },
};

export function taskUiMeta(taskType: string): TaskUiMeta {
  return MAP[taskType] ?? { ...DEFAULT_META, label: taskType.replace(/_/g, ' ') };
}

/** Short page title from task type (e.g. receiving → Receiving). */
export function taskTypeTitle(taskType: string): string {
  const titles: Record<string, string> = {
    receiving: 'Receiving',
    qc: 'QC',
    putaway: 'Putaway',
    putaway_quarantine: 'Quarantine putaway',
    pick: 'Pick',
    pack: 'Pack',
    dispatch: 'Dispatch',
    routing: 'Routing',
  };
  if (titles[taskType]) return titles[taskType];
  return taskType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
