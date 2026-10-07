import { api } from './client';

export type DocumentType = 'grn' | 'delivery_note';
export type DocumentLang = 'en' | 'ar';
export type DocumentReferenceType = 'inbound_order' | 'outbound_order';
export type ContractGenerationStatus = 'pending' | 'partial' | 'complete';
export type ContractGenerationFilter = 'pending' | 'generated' | 'complete';

export interface DocumentMeta {
  id: string;
  type: DocumentType;
  taskId: string | null;
  documentNumber: string;
  language: DocumentLang;
  fileName: string;
  fileSize: number;
  createdAt: string;
  pdfUrl: string;
}

export interface GeneratedDocument {
  id: string;
  documentNumber: string;
  pdfUrl: string;
  pdfPath: string;
  generatedAt: string;
  language: DocumentLang;
}

export interface ContractLangSlot {
  documentId: string;
  documentNumber: string;
  fileSize: number;
  createdAt: string;
  pdfUrl: string;
}

export interface ContractCatalogRow {
  slotKey: string;
  type: DocumentType;
  taskId: string;
  referenceType: DocumentReferenceType;
  referenceId: string;
  orderNumber: string | null;
  companyId: string;
  company: { id: string; name: string };
  completedAt: string | null;
  generationStatus: ContractGenerationStatus;
  en: ContractLangSlot | null;
  ar: ContractLangSlot | null;
}

export interface DocumentSlotFields {
  clientReference: string;
  notes: string;
  supplier: string;
  poNumber: string;
  operatorName: string;
  destination: string;
  carrier: string;
  trackingNumber: string;
  vehicle: string;
  driver: string;
}

export interface ListContractsParams {
  companyId?: string;
  search?: string;
  type?: DocumentType;
  language?: DocumentLang;
  referenceType?: DocumentReferenceType;
  generationStatus?: ContractGenerationFilter;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
  offset?: number;
}

export const DocumentsApi = {
  list(referenceType: DocumentReferenceType, referenceId: string): Promise<DocumentMeta[]> {
    return api
      .get('/documents', { params: { referenceType, referenceId } })
      .then((r) => r.data as DocumentMeta[]);
  },

  listCatalog(params: ListContractsParams = {}) {
    return api
      .get<{ items: ContractCatalogRow[]; total: number; limit: number; offset: number }>(
        '/documents/catalog',
        { params: { limit: 50, ...params } },
      )
      .then((r) => r.data);
  },

  generateGrn(taskId: string, lang: DocumentLang): Promise<GeneratedDocument | null> {
    return api.post(`/documents/grn/${taskId}`, null, { params: { lang } }).then((r) => r.data);
  },

  generateDn(taskId: string, lang: DocumentLang): Promise<GeneratedDocument | null> {
    return api.post(`/documents/dn/${taskId}`, null, { params: { lang } }).then((r) => r.data);
  },

  getDocumentSlot(taskId: string, type: DocumentType) {
    return api
      .get<{ taskId: string; type: DocumentType; fields: DocumentSlotFields }>(
        `/documents/slot/${taskId}`,
        { params: { type } },
      )
      .then((r) => r.data);
  },

  updateDocumentSlot(
    taskId: string,
    payload: DocumentSlotFields & { type: DocumentType },
  ) {
    return api
      .patch<{ taskId: string; type: DocumentType; fields: DocumentSlotFields }>(
        `/documents/slot/${taskId}`,
        payload,
      )
      .then((r) => r.data);
  },

  /** Fetch the immutable PDF as a blob (carries auth) and open it in a new tab. */
  async openInNewTab(id: string): Promise<void> {
    const blob = await api
      .get(`/documents/${id}/file`, {
        params: { v: Date.now() },
        responseType: 'blob',
      })
      .then((r) => r.data as Blob);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    // Revoke after the tab has had time to load the resource.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
