import type { ReactElement } from 'react';

type Step = { id: number; label: string };

/** Compact horizontal step indicator for multi-step create flows. */
export function ClientWizardSteps({
  steps,
  current,
}: {
  steps: Step[];
  current: number;
}): ReactElement {
  return (
    <ol className="mb-4 flex list-none flex-wrap items-center gap-1.5 p-0" aria-label="Progress">
      {steps.map((step, index) => {
        const active = step.id === current;
        const done = step.id < current;
        return (
          <li key={step.id} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span className="mx-0.5 h-px w-4 bg-[var(--border-default)]" aria-hidden="true" />
            ) : null}
            <span
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition',
                active
                  ? 'bg-cta text-white'
                  : done
                    ? 'bg-brand-50 text-brand-800 dark:bg-white/5 dark:text-brand-400'
                    : 'bg-surface-sunken text-text-muted',
              ].join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={[
                  'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
                  active
                    ? 'bg-white/20 text-white'
                    : done
                      ? 'bg-brand-200 text-brand-900 dark:bg-white/10 dark:text-brand-300'
                      : 'bg-surface-hover text-text-muted',
                ].join(' ')}
              >
                {done ? '✓' : step.id}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Lightweight section title inside modals/forms. */
export function ClientFormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {title}
      </h3>
      <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 sm:p-3.5">
        {children}
      </div>
    </section>
  );
}
