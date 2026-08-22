import type { ReactNode } from 'react';

import { Button } from '@ds';

type Props = {
  onSavePlan?: () => void;
  savePlanLabel?: string;
  savePlanLoading?: boolean;
  savePlanDisabled?: boolean;
  onPrint?: () => void;
  printLabel?: string;
  printDisabled?: boolean;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmLoading?: boolean;
  confirmDisabled?: boolean;
  extra?: ReactNode;
};

export function OrderWorkspaceStageFooter({
  onSavePlan,
  savePlanLabel = 'Save plan',
  savePlanLoading,
  savePlanDisabled,
  onPrint,
  printLabel = 'Print',
  printDisabled,
  onConfirm,
  confirmLabel = 'Confirm',
  confirmLoading,
  confirmDisabled,
  extra,
}: Props) {
  return (
    <>
      {extra}
      {onSavePlan ? (
        <Button
          type="button"
          variant="secondary"
          loading={savePlanLoading}
          disabled={savePlanDisabled}
          onClick={onSavePlan}
        >
          {savePlanLabel}
        </Button>
      ) : null}
      {onPrint ? (
        <Button type="button" variant="secondary" disabled={printDisabled} onClick={onPrint}>
          {printLabel}
        </Button>
      ) : null}
      {onConfirm ? (
        <Button
          type="button"
          variant="primary"
          loading={confirmLoading}
          disabled={confirmDisabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      ) : null}
    </>
  );
}
