import type { ReactNode } from 'react';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, action }: Props) {
  return (
    <div
      role="alert"
      className="mx-auto max-w-lg rounded-3xl border border-transform-ink/30 bg-transform-soft px-6 py-8 text-center"
    >
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-midnight/80">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button type="button" className="btn-primary" onClick={onRetry}>
            Try again
          </button>
        )}
        {action}
      </div>
    </div>
  );
}
