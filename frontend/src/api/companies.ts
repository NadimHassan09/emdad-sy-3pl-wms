import { api } from './client';

export type CompanyStatus =
  | 'active'
  | 'paused'
  | 'offboarding'
  | 'closed'
  | 'restricted'
  | 'suspended'
  | 'archived'
  | 'purged';

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
  suspendedAt: string | null;
  suspensionReason: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  purgedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerLifecycleCounts = {
  products: number;
  inboundOrders: number;
  outboundOrders: number;
  returns: number;
  openInbound: number;
  openOutbound: number;
  openReturns: number;
  stockOnHand: number;
  stockRows: number;
  ledgerEntries: number;
  invoices: number;
  unresolvedInvoices: number;
  openBillingCycles: number;
  users: number;
  activeUsers: number;
  auditReferences: number;
};

export type CustomerLifecycleContext = {
  companyId: string;
  name: string;
  status: CompanyStatus;
  archivedAt: string | null;
  suspendedAt: string | null;
  purgedAt: string | null;
  retentionDays: number;
  retentionElapsedDays: number | null;
  counts: CustomerLifecycleCounts;
  flags: {
    hasStock: boolean;
    hasOpenOrders: boolean;
    hasHistory: boolean;
    isEmpty: boolean;
  };
  actions: {
    canSuspend: boolean;
    canRestore: boolean;
    canArchive: boolean;
    canHardDelete: boolean;
    canPurge: boolean;
  };
  blockers: {
    archive: string[];
    delete: string[];
    purge: string[];
  };
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
  async list(options?: {
    includeAll?: boolean;
    status?: CompanyStatus;
  }): Promise<CompanyListRow[]> {
    const params: Record<string, unknown> = {};
    if (options?.includeAll) params.includeAll = true;
    if (options?.status) params.status = options.status;
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

  async getLifecycle(id: string): Promise<CustomerLifecycleContext> {
    const { data } = await api.get<CustomerLifecycleContext>(`/companies/${id}/lifecycle`);
    return data;
  },

  async suspend(id: string, reason?: string): Promise<CompanyListRow> {
    const { data } = await api.post<CompanyListRow>(`/companies/${id}/suspend`, { reason });
    return data;
  },

  async archive(id: string, reason?: string): Promise<CompanyListRow> {
    const { data } = await api.post<CompanyListRow>(`/companies/${id}/archive`, { reason });
    return data;
  },

  async restore(id: string, reason?: string): Promise<CompanyListRow> {
    const { data } = await api.post<CompanyListRow>(`/companies/${id}/restore`, { reason });
    return data;
  },

  async close(id: string): Promise<CompanyListRow> {
    const { data } = await api.post<CompanyListRow>(`/companies/${id}/close`);
    return data;
  },

  async purge(id: string): Promise<{ id: string; purged: true; mode: 'deleted' | 'anonymized' }> {
    const { data } = await api.post<{ id: string; purged: true; mode: 'deleted' | 'anonymized' }>(
      `/companies/${id}/purge`,
    );
    return data;
  },

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const { data } = await api.delete<{ id: string; deleted: true }>(`/companies/${id}`);
    return data;
  },
};
