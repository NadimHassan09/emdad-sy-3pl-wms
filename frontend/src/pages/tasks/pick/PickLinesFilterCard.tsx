import { useState } from 'react';
import { BarcodeScanIcon } from '../../../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../../../components/BarcodeScanModal';
import { Button } from '../../../components/Button';
import { FilterPanel } from '../../../components/FilterPanel';
import { TextField } from '../../../components/TextField';
import type { PickLineFilters } from './pick-utils';

type ScanTarget = 'product' | 'location' | null;

function FilterScanField({
  label,
  value,
  placeholder,
  ariaLabel,
  onChange,
  onScanClick,
}: {
  label: string;
  value: string;
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onScanClick: () => void;
}) {
  return (
    <div className="min-w-0 flex-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1 flex gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            name={`pickFilter-${label}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="!mt-0 w-full"
            aria-label={ariaLabel}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="mt-0 shrink-0 px-2.5"
          onClick={onScanClick}
          aria-label={`Scan ${label.toLowerCase()}`}
          title={`Scan ${label.toLowerCase()}`}
        >
          <BarcodeScanIcon className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

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
  const [scanTarget, setScanTarget] = useState<ScanTarget>(null);
  const showingFiltered = resultCount !== totalCount;

  function handleScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed || !scanTarget) return;
    onScanApply(scanTarget, trimmed);
    setScanTarget(null);
  }

  return (
    <>
      <FilterPanel
        title="Filters"
        onApply={onApply}
        onReset={onReset}
        applyLabel="Apply filters"
        resetLabel="Reset filters"
        className="!mb-0"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
          <FilterScanField
            label="Product"
            value={draft.product}
            placeholder="SKU, product name, or barcode"
            ariaLabel="Filter by product"
            onChange={(product) => onDraftChange({ ...draft, product })}
            onScanClick={() => setScanTarget('product')}
          />
          <FilterScanField
            label="Location"
            value={draft.location}
            placeholder="Bin path, name, or barcode"
            ariaLabel="Filter by location"
            onChange={(location) => onDraftChange({ ...draft, location })}
            onScanClick={() => setScanTarget('location')}
          />
        </div>
        {showingFiltered ? (
          <p className="text-xs text-slate-500">
            Showing {resultCount} of {totalCount} lines
          </p>
        ) : null}
      </FilterPanel>

      <BarcodeScanModal
        open={scanTarget != null}
        onClose={() => setScanTarget(null)}
        onScan={handleScan}
      />
    </>
  );
}
