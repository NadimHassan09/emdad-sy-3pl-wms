import { useWorkflowContext } from './useWorkflowContext';

export function useTaskOnlyMode(): boolean {
  const { data } = useWorkflowContext();
  /** Align with backend: task-driven is default ON unless context-settings explicitly returns false */
  return data?.taskOnlyFlows !== false;
}
