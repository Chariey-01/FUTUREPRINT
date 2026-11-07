import type { ReactNode } from 'react';

interface Props {
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: Props) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-midnight/10 bg-ivory-50 px-6 py-10 text-center shadow-card">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-midnight/80">{message}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
