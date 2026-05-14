import { api } from './client';

export interface WorkflowTimelineInstance {
  id: string;
  status: string;
  referenceType: string;
  referenceId: string;
  warehouseId: string;
  companyId?: string;
}

export interface WorkflowTimelineTask {
  id: string;
  taskType: string;
  status: string;
  is_current_runnable?: boolean;
  runnability_blocked_reason?: string | null;
  assignments?: Array<{
    worker?: {
      id: string;
      displayName: string;
      user?: { fullName?: string | null; email?: string | null } | null;
    };
  }>;
}

export interface WorkflowTimelineStep {
  key: string;
  label: string;
  status: 'pending' | 'locked' | 'done';
  taskId: string | null;
}

export interface WorkflowTimelineResponse {
  workflowInstance: WorkflowTimelineInstance | null;
  tasks: WorkflowTimelineTask[];
  steps?: WorkflowTimelineStep[];
}

export interface WorkflowContextSettingsResponse extends Record<string, unknown> {
  taskOnlyFlows: boolean;
  warehouseId: string;
  effective?: Record<string, unknown>;
}

export interface WorkflowGraphResponse extends WorkflowTimelineResponse {
  nodes: unknown[];
}

export const WorkflowsApi = {
  startInbound(orderId: string, body: { warehouseId: string; stagingByLineId: Record<string, string> }) {
    return api.post<unknown, unknown>(`/workflows/inbound/${orderId}/start`, body);
  },

  startOutbound(orderId: string, body: { warehouseId: string }) {
    return api.post<unknown, unknown>(`/workflows/outbound/${orderId}/start`, body);
  },

  async getTimeline(
    referenceType: 'inbound_order' | 'outbound_order',
    referenceId: string,
    companyIdOverride?: string,
  ): Promise<WorkflowTimelineResponse> {
    const { data } = await api.get<WorkflowTimelineResponse>(
      `/workflows/references/${referenceType}/${referenceId}`,
      {
        headers: companyIdOverride ? { 'X-Company-Id': companyIdOverride } : undefined,
      },
    );
    return data;
  },

  async getInstanceGraph(instanceId: string): Promise<WorkflowGraphResponse> {
    const { data } = await api.get<WorkflowGraphResponse>(`/workflows/instances/${instanceId}/graph`);
    return data;
  },

  async getInstanceGraphByReference(
    referenceType: 'inbound_order' | 'outbound_order',
    referenceId: string,
  ): Promise<WorkflowGraphResponse> {
    const { data } = await api.get<WorkflowGraphResponse>(`/workflows/instances/by-reference`, {
      params: { reference_type: referenceType, reference_id: referenceId },
    });
    return data;
  },

  async getContextSettings(warehouseId?: string): Promise<WorkflowContextSettingsResponse> {
    const { data } = await api.get<WorkflowContextSettingsResponse>(`/workflows/context-settings`, {
      params: warehouseId ? { warehouse_id: warehouseId } : undefined,
    });
    return data;
  },
};
