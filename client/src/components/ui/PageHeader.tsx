import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  eyebrowClass?: string;
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  id?: string;
}

/** Standard editorial page opener used by every inner page. */
export function PageHeader({
  eyebrow,
  eyebrowClass = 'text-transform-ink',
  title,
  intro,
  actions,
  id,
}: Props) {
  return (
    <header className="max-w-3xl">
      {eyebrow && <p className={`eyebrow ${eyebrowClass}`}>{eyebrow}</p>}
      <h1 id={id} className="mt-3 text-4xl font-bold leading-[1.05] sm:text-6xl">
        {title}
      </h1>
      {intro && (
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-midnight/80 sm:text-xl">
          {intro}
        </p>
      )}
      {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
