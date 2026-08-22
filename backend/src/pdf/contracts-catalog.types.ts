import type { DocumentType } from '@prisma/client';

export type ContractLangSlot = {
  documentId: string;
  documentNumber: string;
  fileSize: number;
  createdAt: Date;
  pdfUrl: string;
};

export type ContractCatalogRow = {
  slotKey: string;
  type: DocumentType;
  taskId: string;
  referenceType: 'inbound_order' | 'outbound_order';
  referenceId: string;
  orderNumber: string | null;
  companyId: string;
  company: { id: string; name: string };
  completedAt: Date | null;
  generationStatus: 'complete' | 'partial' | 'pending';
  en: ContractLangSlot | null;
  ar: ContractLangSlot | null;
};
