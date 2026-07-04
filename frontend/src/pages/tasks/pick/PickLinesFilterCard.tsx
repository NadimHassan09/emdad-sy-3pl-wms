import { useState } from 'react';

import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { FilterPanel } from '../../../components/FilterPanel';
import { FilterScanField } from '../../../components/FilterScanField';
import { useWmsTranslation } from '../../../lib/ui-i18n';
import type { PickLineFilters } from './pick-utils';

type ScanTarget = 'product' | 'location' | null;

export function PickLinesFilterCard({
  draft,
  onDraftChange,
  onApply,
  onReset,
  onScanApply,
  resultCount,
  totalCount,
}: {
  draft: PickLineFilters;
  onDraftChange: (next: PickLineFilters) => void;
  onApply: () => void;
  onReset: () => void;
  /** Apply scanned code to the active field and sync applied filters. */
  onScanApply: (field: 'product' | 'location', code: string) => void;
  resultCount: number;
  totalCount: number;
}) {
  const { t } = useWmsTranslation();
  const [scanTarget, setScanTarget] = useState<ScanTarget>(null);
  const showingFiltered = resultCount !== totalCount;

  function handleScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed || !scanTarget) return;
    onScanApply(scanTarget, trimmed);
    setScanTarget(null);
  }

  const productLabel = t(['Product', 'المنتج']);
  const locationLabel = t(['Location', 'الموقع']);

  return (
    <>
      <FilterPanel
        title={t(['Filters', 'الفلاتر'])}
        onApply={onApply}
        onReset={onReset}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset filters', 'إعادة تعيين الفلاتر'])}
        className="!mb-0"
      >
        <FilterScanField
          label={productLabel}
          value={draft.product}
          placeholder={t(['SKU, product name, or Barcode', 'SKU أو اسم المنتج أو Barcode'])}
          scanTitle={t(['Scan product', 'مسح المنتج'])}
          scanAriaLabel={t(['Scan product', 'مسح المنتج'])}
          onChange={(product) => onDraftChange({ ...draft, product })}
          onScanClick={() => setScanTarget('product')}
        />
        <FilterScanField
          label={locationLabel}
          value={draft.location}
          placeholder={t(['Bin path, name, or Barcode', 'مسار Bin أو الاسم أو Barcode'])}
          scanTitle={t(['Scan location', 'مسح الموقع'])}
          scanAriaLabel={t(['Scan location', 'مسح الموقع'])}
          onChange={(location) => onDraftChange({ ...draft, location })}
          onScanClick={() => setScanTarget('location')}
        />
      </FilterPanel>
      {showingFiltered ? (
        <p className="mb-4 text-xs text-slate-500">
          {t([
            `Showing ${resultCount} of ${totalCount} lines`,
            `عرض ${resultCount} من ${totalCount} سطر`,
          ])}
        </p>
      ) : null}

      <BarcodeScanModal
        open={scanTarget != null}
        onClose={() => setScanTarget(null)}
        onScan={handleScan}
      />
    </>
  );
}
