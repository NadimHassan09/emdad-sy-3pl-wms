import { useState } from 'react';

import { BarcodeScanModal } from '../BarcodeScanModal';
import { FilterPanel } from '../FilterPanel';
import { FilterScanField } from '../FilterScanField';
import { SelectField } from '../SelectField';
import type { TaskLineFilters } from '../../lib/task-line-filters';

export type TaskLineStatusOption = { value: string; label: string };

export function TaskLinesFilterCard({
  draft,
  onDraftChange,
  onApply,
  onReset,
  onBarcodeScan,
  resultCount,
  totalCount,
  statusOptions,
  searchPlaceholder = 'SKU, product name, barcode, or lot',
}: {
  draft: TaskLineFilters;
  onDraftChange: (next: TaskLineFilters) => void;
  onApply: () => void;
  onReset: () => void;
  /** Called with scanned code; parent should update draft/applied filters. */
  onBarcodeScan?: (code: string) => void;
  resultCount: number;
  totalCount: number;
  statusOptions: TaskLineStatusOption[];
  searchPlaceholder?: string;
}) {
  const [scanOpen, setScanOpen] = useState(false);
  const showingFiltered = resultCount !== totalCount;

  function handleScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (onBarcodeScan) {
      onBarcodeScan(trimmed);
    } else {
      onDraftChange({ ...draft, search: trimmed });
      onApply();
    }
    setScanOpen(false);
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
        <FilterScanField
          label="Search"
          value={draft.search}
          onChange={(search) => onDraftChange({ ...draft, search })}
          placeholder={searchPlaceholder}
          scanTitle="Scan barcode to search"
          scanAriaLabel="Scan barcode"
          onScanClick={() => setScanOpen(true)}
        />
        <SelectField
          label="Line status"
          name="taskLineStatus"
          value={draft.status}
          onChange={(e) => onDraftChange({ ...draft, status: e.target.value })}
          options={statusOptions}
        />
      </FilterPanel>
      {showingFiltered ? (
        <p className="mb-4 text-xs text-text-muted">
          Showing {resultCount} of {totalCount} lines
        </p>
      ) : null}

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
      />
    </>
  );
}
