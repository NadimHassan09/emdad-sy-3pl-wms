import { PageResult, api } from './client';

export interface LeadFormSubmission {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  activityType: string;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListLeadFormsQuery {
  search?: string;
  activityType?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export const FormsApi = {
  list(params: ListLeadFormsQuery = {}) {
    return api
      .get<PageResult<LeadFormSubmission>>('/forms', { params })
      .then((r) => r.data);
  },

  get(id: string) {
    return api.get<LeadFormSubmission>(`/forms/${id}`).then((r) => r.data);
  },

  remove(id: string) {
    return api.delete<{ id: string; deleted: boolean }>(`/forms/${id}`).then((r) => r.data);
  },

  activityTypes() {
    return api.get<string[]>('/forms/activity-types').then((r) => r.data);
  },
};
