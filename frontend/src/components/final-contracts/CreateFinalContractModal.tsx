import { useMutation, useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { CompaniesApi } from '../../api/companies';
import {
  FinalContractsApi,
  type CreateFinalContractInput,
  type FinalContractRow,
} from '../../api/final-contracts';
import { Button } from '../Button';
import { Combobox } from '../Combobox';
import { Modal } from '../Modal';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';
import { localCalendarDateYmd } from '../../lib/order-planning-dates';
import { useWmsTranslation } from '../../lib/ui-i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  contract?: FinalContractRow | null;
};

const DEFAULT_RATES = {
  rateStorage: 25,
  rateInboundHandling: 8,
  rateOutboundHandling: 12,
  rateValueAddedServices: 15,
  rateReturnProcessing: 10,
};

export function CreateFinalContractModal({ open, onClose, onSaved, contract }: Props) {
  const isEdit = !!contract;
  const { t, isArabic } = useWmsTranslation();
  const toast = useToast();
  const [companyId, setCompanyId] = useState('');
  const [issueDate, setIssueDate] = useState(localCalendarDateYmd());
  const [clientCompanyName, setClientCompanyName] = useState('');
  const [clientCompanyType, setClientCompanyType] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [clientSignatoryName, setClientSignatoryName] = useState('');
  const [clientSignatoryTitle, setClientSignatoryTitle] = useState('');
  const [rates, setRates] = useState(DEFAULT_RATES);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const companyOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t(['Select client…', 'اختر العميل…'])),
    [companies.data, isArabic],
  );

  const selectedCompany = useMemo(
    () => companies.data?.find((c) => c.id === companyId),
    [companies.data, companyId],
  );

  useEffect(() => {
    if (!selectedCompany || isEdit) return;
    setClientCompanyName(selectedCompany.name);
    setClientAddress(selectedCompany.address ?? '');
    setClientPhone(selectedCompany.contactPhone ?? '');
    setClientEmail(selectedCompany.contactEmail ?? '');
  }, [selectedCompany, isEdit]);

  useEffect(() => {
    if (!open) return;
    if (contract) {
      setCompanyId(contract.companyId);
      setIssueDate(contract.issueDate);
      setClientCompanyName(contract.clientCompanyName);
      setClientCompanyType(contract.clientCompanyType ?? '');
      setClientAddress(contract.clientAddress ?? '');
      setClientPhone(contract.clientPhone ?? '');
      setClientEmail(contract.clientEmail ?? '');
      setClientTaxId(contract.clientTaxId ?? '');
      setClientSignatoryName(contract.clientSignatoryName ?? '');
      setClientSignatoryTitle(contract.clientSignatoryTitle ?? '');
      setRates({
        rateStorage: contract.rateStorage,
        rateInboundHandling: contract.rateInboundHandling,
        rateOutboundHandling: contract.rateOutboundHandling,
        rateValueAddedServices: contract.rateValueAddedServices,
        rateReturnProcessing: contract.rateReturnProcessing,
      });
      return;
    }
    setCompanyId('');
    setIssueDate(localCalendarDateYmd());
    setClientCompanyName('');
    setClientCompanyType('');
    setClientAddress('');
    setClientPhone('');
    setClientEmail('');
    setClientTaxId('');
    setClientSignatoryName('');
    setClientSignatoryTitle('');
    setRates(DEFAULT_RATES);
  }, [open, contract]);

  const saveMutation = useMutation({
    mutationFn: (input: CreateFinalContractInput) =>
      isEdit && contract
        ? FinalContractsApi.update(contract.id, input)
        : FinalContractsApi.create(input),
    onSuccess: () => {
      toast.success(
        isEdit
          ? t(['Final contract updated.', 'تم تحديث العقد النهائي.'])
          : t(['Final contract created.', 'تم إنشاء العقد النهائي.']),
      );
      onSaved();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!companyId) {
      toast.error(t(['Client is required.', 'العميل مطلوب.']));
      return;
    }
    if (!clientCompanyName.trim()) {
      toast.error(t(['Client company name is required.', 'اسم شركة العميل مطلوب.']));
      return;
    }

    saveMutation.mutate({
      companyId,
      issueDate,
      clientCompanyName: clientCompanyName.trim(),
      clientCompanyType: clientCompanyType.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      clientTaxId: clientTaxId.trim() || undefined,
      clientSignatoryName: clientSignatoryName.trim() || undefined,
      clientSignatoryTitle: clientSignatoryTitle.trim() || undefined,
      ...rates,
    });
  }

  function rateField(
    key: keyof typeof DEFAULT_RATES,
    labelEn: string,
    labelAr: string,
  ) {
    return (
      <TextField
        key={key}
        label={t([labelEn, labelAr])}
        type="number"
        min={0}
        step="0.01"
        value={String(rates[key])}
        onChange={(event) =>
          setRates((prev) => ({ ...prev, [key]: Number(event.target.value) || 0 }))
        }
      />
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEdit
          ? t(['Edit final contract', 'تعديل العقد النهائي'])
          : t(['Create final contract', 'إنشاء العقد النهائي'])
      }
      widthClass="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(['Cancel', 'إلغاء'])}
          </Button>
          <Button type="submit" form="create-final-contract-form" loading={saveMutation.isPending}>
            {isEdit ? t(['Save changes', 'حفظ التغييرات']) : t(['Create contract', 'إنشاء العقد'])}
          </Button>
        </>
      }
    >
        <form id="create-final-contract-form" onSubmit={handleSubmit} className="space-y-4">
          {isEdit && contract ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t(['Contract #', 'رقم العقد'])}
              </label>
              <div className="font-mono rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {contract.contractNumber}
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
          <Combobox
            label={t(['Client', 'العميل'])}
            value={companyId}
            onChange={setCompanyId}
            options={companyOptions}
            placeholder={t(['Select client…', 'اختر العميل…'])}
          />
          <TextField
            label={t(['Issue date', 'تاريخ الإصدار'])}
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
            required
          />
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            {t(['Client details', 'بيانات العميل'])}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t(['Company name', 'اسم الشركة'])}
              value={clientCompanyName}
              onChange={(event) => setClientCompanyName(event.target.value)}
              required
            />
            <TextField
              label={t(['Company type', 'نوع الشركة'])}
              value={clientCompanyType}
              onChange={(event) => setClientCompanyType(event.target.value)}
              placeholder={t(['e.g. Trading Company', 'مثال: شركة تجارية'])}
            />
            <TextField
              label={t(['Address', 'العنوان'])}
              value={clientAddress}
              onChange={(event) => setClientAddress(event.target.value)}
              className="sm:col-span-2"
            />
            <TextField
              label={t(['Phone', 'الهاتف'])}
              value={clientPhone}
              onChange={(event) => setClientPhone(event.target.value)}
            />
            <TextField
              label={t(['Email', 'البريد الإلكتروني'])}
              type="email"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
            />
            <TextField
              label={t(['Tax ID', 'الرقم الضريبي'])}
              value={clientTaxId}
              onChange={(event) => setClientTaxId(event.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            {t(['Pricing & fees (USD)', 'التسعير والرسوم (USD)'])}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {rateField('rateStorage', 'Storage (per pallet / month)', 'التخزين (لكل طبلية / شهر)')}
            {rateField('rateInboundHandling', 'Inbound handling (per pallet)', 'معالجة الوارد (لكل طبلية)')}
            {rateField('rateOutboundHandling', 'Outbound handling (per order)', 'معالجة الصادر (لكل طلب)')}
            {rateField(
              'rateValueAddedServices',
              'Value added services (per unit / hour)',
              'خدمات القيمة المضافة (لكل وحدة / ساعة)',
            )}
            {rateField('rateReturnProcessing', 'Return processing (per return)', 'معالجة المرتجعات (لكل مرتجع)')}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            {t(['Client signatory', 'موقع العميل'])}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t(['Signatory name', 'اسم الموقّع'])}
              value={clientSignatoryName}
              onChange={(event) => setClientSignatoryName(event.target.value)}
            />
            <TextField
              label={t(['Signatory title', 'المسمى الوظيفي'])}
              value={clientSignatoryTitle}
              onChange={(event) => setClientSignatoryTitle(event.target.value)}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
