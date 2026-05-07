import { api } from './client';

export type CompanyStatus = 'active' | 'paused' | 'offboarding' | 'closed';

export type CompanyListRow = {
  id: string;
  name: string;
  tradeName: string | null;
  contactEmail: string;
  contactPhone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  status: CompanyStatus;
  billingCycle: string;
  paymentTermsDays: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCompanyPayload = {
  name: string;
  tradeName?: string;
  contactEmail: string;
  country?: string;
  city?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
};

export type UpdateCompanyPayload = Partial<CreateCompanyPayload> & {
  status?: CompanyStatus;
};

export const CompaniesApi = {
  async list(options?: { includeAll?: boolean }): Promise<CompanyListRow[]> {
    const params = options?.includeAll ? { includeAll: true } : {};
    const { data } = await api.get<CompanyListRow[]>('/companies', { params });
    return data;
  },

  async get(id: string): Promise<CompanyListRow> {
    const { data } = await api.get<CompanyListRow>(`/companies/${id}`);
    return data;
  },

  async create(payload: CreateCompanyPayload): Promise<CompanyListRow> {
    const { data } = await api.post<CompanyListRow>('/companies', payload);
    return data;
  },

  async update(id: string, payload: UpdateCompanyPayload): Promise<CompanyListRow> {
    const { data } = await api.patch<CompanyListRow>(`/companies/${id}`, payload);
    return data;
  },

  async suspend(id: string): Promise<CompanyListRow> {
    const { data } = await api.post<CompanyListRow>(`/companies/${id}/suspend`);
    return data;
  },

  async close(id: string): Promise<CompanyListRow> {
    const { data } = await api.post<CompanyListRow>(`/companies/${id}/close`);
    return data;
  },

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const { data } = await api.delete<{ id: string; deleted: true }>(`/companies/${id}`);
    return data;
  },
};
