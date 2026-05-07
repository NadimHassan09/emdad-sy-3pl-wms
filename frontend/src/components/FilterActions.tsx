import { Button } from './Button';

export function FilterActions({
  onApply,
  onReset,
  applyDisabled,
  loading,
}: {
  onApply: () => void;
  onReset: () => void;
  applyDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 py-3 mt-1">
      <Button
        type="button"
        size="sm"
        onClick={onApply}
        disabled={applyDisabled || loading}
        loading={loading}
        className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
      >
        Apply filters
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onReset}
        disabled={loading}
        className="border border-rose-600 bg-rose-600 text-white hover:bg-rose-700"
      >
        Reset filters
      </Button>
    </div>
  );
}
