export function ProgressSteps({ current, total }: { current: number; total: number }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  const shown = Math.min(current, total);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="eyebrow text-midnight/80" data-testid="step-label">
        Step {shown} of {total}
      </p>
      <ol className="flex items-center gap-2" aria-label="Progress">
        {steps.map((s) => {
          const state = s < current ? 'done' : s === current ? 'current' : 'upcoming';
          return (
            <li key={s} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="sr-only">
                Step {s}:{' '}
                {state === 'done' ? 'completed' : state === 'current' ? 'current' : 'not started'}
              </span>
              <span
                aria-hidden="true"
                className={`block h-1.5 rounded-full transition-all duration-500 ${
                  state === 'current'
                    ? 'w-10 bg-midnight'
                    : state === 'done'
                      ? 'w-6 bg-midnight/60'
                      : 'w-6 bg-midnight/15'
                }`}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
