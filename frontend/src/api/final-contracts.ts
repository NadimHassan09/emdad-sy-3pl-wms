import { api } from './client';
import type { ContractGenerationFilter, ContractGenerationStatus, DocumentLang } from './documents';

export interface ContractLangSlot {
  documentId: string;
  documentNumber: string;
  fileSize: number;
  createdAt: string;
  pdfUrl: string;
}

export interface FinalContractRow {
  id: string;
  contractNumber: string;
  issueDate: string;
  companyId: string;
  company: { id: string; name: string };
  clientCompanyName: string;
  clientCompanyType: string | null;
  clientAddress: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  clientTaxId: string | null;
  clientSignatoryName: string | null;
  clientSignatoryTitle: string | null;
  rateStorage: number;
  rateInboundHandling: number;
  rateOutboundHandling: number;
  rateValueAddedServices: number;
  rateReturnProcessing: number;
  createdAt: string;
  generationStatus: ContractGenerationStatus;
  en: ContractLangSlot | null;
  ar: ContractLangSlot | null;
}

export interface CreateFinalContractInput {
  companyId: string;
  issueDate: string;
  clientCompanyName: string;
  clientCompanyType?: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientTaxId?: string;
  clientSignatoryName?: string;
  clientSignatoryTitle?: string;
  rateStorage: number;
  rateInboundHandling: number;
  rateOutboundHandling: number;
  rateValueAddedServices: number;
  rateReturnProcessing: number;
}

export interface ListFinalContractsParams {
  companyId?: string;
  search?: string;
  generationStatus?: ContractGenerationFilter;
  issueFrom?: string;
  issueTo?: string;
  limit?: number;
  offset?: number;
}

export const FinalContractsApi = {
  list(params: ListFinalContractsParams = {}) {
    return api
      .get<{ items: FinalContractRow[]; total: number; limit: number; offset: number }>(
        '/final-contracts',
        { params: { limit: 50, ...params } },
      )
      .then((r) => r.data);
  },

  create(input: CreateFinalContractInput): Promise<FinalContractRow> {
    return api.post('/final-contracts', input).then((r) => r.data as FinalContractRow);
  },

  update(id: string, input: Partial<CreateFinalContractInput>): Promise<FinalContractRow> {
    return api.patch(`/final-contracts/${id}`, input).then((r) => r.data as FinalContractRow);
  },

  generatePdf(contractId: string, lang: DocumentLang) {
    return api
      .post(`/documents/final-contract/${contractId}`, null, { params: { lang } })
      .then((r) => r.data);
  },
};
