import type { ReactNode } from 'react';

type Tone = 'neutral' | 'adapt' | 'transform' | 'discover' | 'sample';

const TONES: Record<Tone, string> = {
  neutral: 'bg-midnight/5 text-midnight',
  adapt: 'bg-adapt-soft text-adapt-ink',
  transform: 'bg-transform-soft text-transform-ink',
  discover: 'bg-discover-soft text-discover-ink',
  sample: 'border border-dashed border-transform-ink bg-ivory-50 text-transform-ink',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** A skill chip. Kept separate from Badge so skill lists can evolve (e.g. "validated"). */
export function SkillTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-midnight/15 bg-ivory-50 px-3 py-1 text-sm font-medium">
      {children}
    </span>
  );
}
