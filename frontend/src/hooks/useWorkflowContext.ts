import { useContext } from 'react';

import type { WorkflowContextSettingsResponse } from '../api/workflows';

import { WorkflowUxContext } from '../workflow/WorkflowUxContext';

/** Context settings from GET /workflows/context-settings */
export function useWorkflowContext(): {
  data: WorkflowContextSettingsResponse | undefined;
  isLoading: boolean;
} {
  const ctx = useContext(WorkflowUxContext);
  if (!ctx) return { data: undefined, isLoading: false };
  return { data: ctx.data, isLoading: ctx.isLoading };
}
