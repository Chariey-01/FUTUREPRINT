import type { Source } from '../types/api';

export function SourceLink({
  source,
  tone = 'light',
}: {
  source: Source;
  tone?: 'light' | 'dark';
}) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex flex-wrap items-baseline gap-x-1 text-sm font-medium underline decoration-1 underline-offset-4 hover:decoration-2 ${
        tone === 'dark' ? 'text-ivory-50' : 'text-midnight'
      }`}
    >
      <span>{source.title}</span>
      <span className={tone === 'dark' ? 'text-ivory-200' : 'text-midnight/80'}>
        — {source.publisher}
        {source.year ? `, ${source.year}` : ''}
      </span>
      <span className="sr-only">(opens in a new tab)</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
