import { api } from './client';

export type DocumentType = 'grn' | 'delivery_note';
export type DocumentLang = 'en' | 'ar';
export type DocumentReferenceType = 'inbound_order' | 'outbound_order';

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

export const DocumentsApi = {
  list(referenceType: DocumentReferenceType, referenceId: string): Promise<DocumentMeta[]> {
    return api
      .get('/documents', { params: { referenceType, referenceId } })
      .then((r) => r.data as DocumentMeta[]);
  },

  generateGrn(taskId: string, lang: DocumentLang): Promise<GeneratedDocument | null> {
    return api.post(`/documents/grn/${taskId}`, null, { params: { lang } }).then((r) => r.data);
  },

  generateDn(taskId: string, lang: DocumentLang): Promise<GeneratedDocument | null> {
    return api.post(`/documents/dn/${taskId}`, null, { params: { lang } }).then((r) => r.data);
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
