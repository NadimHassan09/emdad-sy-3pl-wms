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
