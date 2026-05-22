import { useState } from 'react';
import { BarcodeScanIcon } from '../BarcodeScanIcon';
import { BarcodeScanModal } from '../BarcodeScanModal';
import { Button } from '../Button';
import { FilterPanel } from '../FilterPanel';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <div className="mt-1 flex gap-2">
              <div className="min-w-0 flex-1">
                <TextField
                  name="taskLineSearch"
                  value={draft.search}
                  onChange={(e) => onDraftChange({ ...draft, search: e.target.value })}
                  placeholder={searchPlaceholder}
                  className="!mt-0 w-full"
                  aria-label="Search lines"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="mt-0 shrink-0 px-2.5"
                onClick={() => setScanOpen(true)}
                aria-label="Scan barcode"
                title="Scan barcode to search"
              >
                <BarcodeScanIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-52">
            <SelectField
              label="Line status"
              name="taskLineStatus"
              value={draft.status}
              onChange={(e) => onDraftChange({ ...draft, status: e.target.value })}
              options={statusOptions}
            />
          </div>
        </div>
        {showingFiltered ? (
          <p className="text-xs text-slate-500">
            Showing {resultCount} of {totalCount} lines
          </p>
        ) : null}
      </FilterPanel>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
      />
    </>
  );
}
