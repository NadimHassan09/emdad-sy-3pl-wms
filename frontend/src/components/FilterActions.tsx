import { Button } from '@ds';

export function FilterActions({
  onApply,
  onReset,
  applyDisabled,
  loading,
  applyLabel = 'Apply filters',
  resetLabel = 'Reset',
}: {
  onApply: () => void;
  onReset: () => void;
  applyDisabled?: boolean;
  loading?: boolean;
  applyLabel?: string;
  resetLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 py-3 mt-1">
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={onApply}
        disabled={applyDisabled || loading}
        loading={loading}
      >
        {applyLabel}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onReset}
        disabled={loading}
      >
        {resetLabel}
      </Button>
    </div>
  );
}
