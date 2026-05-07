import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { WorkflowContextSettingsResponse } from '../api/workflows';
import { WorkflowsApi } from '../api/workflows';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';

export type WorkflowUxEffective = {
  showAdvancedJson?: boolean;
  confirmUnsavedDraft?: boolean;
};

const DEFAULT_EFFECTIVE: Required<WorkflowUxEffective> = {
  showAdvancedJson: false,
  confirmUnsavedDraft: true,
};

export const WorkflowUxContext = createContext<{
  data: WorkflowContextSettingsResponse | undefined;
  effective: Required<WorkflowUxEffective>;
  isLoading: boolean;
} | null>(null);

export function WorkflowUxProvider({ children }: { children: ReactNode }) {
  const { warehouseId } = useDefaultWarehouseId();

  const q = useQuery({
    queryKey: ['workflows', 'ux-settings', warehouseId ?? 'none'] as const,
    queryFn: () => WorkflowsApi.getContextSettings(warehouseId ?? undefined),
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const value = useMemo(() => {
    const eff = q.data?.effective as WorkflowUxEffective | undefined;
    return {
      data: q.data,
      effective: {
        showAdvancedJson: eff?.showAdvancedJson ?? DEFAULT_EFFECTIVE.showAdvancedJson,
        confirmUnsavedDraft: eff?.confirmUnsavedDraft ?? DEFAULT_EFFECTIVE.confirmUnsavedDraft,
      },
      isLoading: q.isPending,
    };
  }, [q.data, q.isPending]);

  return <WorkflowUxContext.Provider value={value}>{children}</WorkflowUxContext.Provider>;
}

export function useWorkflowUx() {
  const ctx = useContext(WorkflowUxContext);
  if (!ctx) {
    return { data: undefined, effective: DEFAULT_EFFECTIVE, isLoading: false };
  }
  return ctx;
}
