import { PATHWAYS } from '../lib/pathways';
import type { PathwayId } from '../types/api';

export function PathwayChip({ pathway }: { pathway: PathwayId }) {
  const p = PATHWAYS[pathway];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${p.chip}`}
    >
      <span className={`h-2 w-2 rounded-full ${p.accent}`} aria-hidden="true" />
      {p.name}
    </span>
  );
}

export function PathwayCard({ pathway, index }: { pathway: PathwayId; index?: number }) {
  const p = PATHWAYS[pathway];
  return (
    <div className={`relative overflow-hidden rounded-3xl p-6 ${p.soft}`}>
      <span
        className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-70 ${p.accent}`}
        aria-hidden="true"
      />
      {index !== undefined && (
        <span className={`eyebrow ${p.ink}`}>Pathway {String(index + 1).padStart(2, '0')}</span>
      )}
      <h3 className="relative mt-2 text-2xl font-semibold text-midnight">{p.name}</h3>
      <p className="relative mt-2 text-midnight/80">{p.tagline}</p>
    </div>
  );
}
