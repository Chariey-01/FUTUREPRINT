import { m } from 'framer-motion';
import type { Occupation } from '../types/api';
import { Spinner } from './LoadingState';

const ACCENTS = ['bg-adapt', 'bg-transform', 'bg-discover'];

interface Props {
  occupation: Occupation;
  index: number;
  pending: boolean;
  disabled: boolean;
  onSelect: (occupation: Occupation) => void;
}

export function OccupationCard({ occupation, index, pending, disabled, onSelect }: Props) {
  return (
    <m.li
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.06 }}
    >
      <button
        type="button"
        onClick={() => onSelect(occupation)}
        disabled={disabled}
        aria-busy={pending}
        className="group relative flex h-full w-full flex-col overflow-hidden rounded-3xl bg-ivory-50 p-6 text-left shadow-card transition-shadow duration-200 hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className={`absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-50 transition-transform duration-500 group-hover:scale-125 ${ACCENTS[index % ACCENTS.length]}`}
        />
        {occupation.sector && (
          <span className="eyebrow relative text-midnight/80">{occupation.sector}</span>
        )}
        <span className="relative mt-3 font-display text-2xl font-semibold">
          {occupation.title}
        </span>
        <span className="relative mt-2 flex-1 text-midnight/80">{occupation.summary}</span>
        <span className="relative mt-6 inline-flex items-center gap-2 text-sm font-semibold">
          {pending ? (
            <>
              <Spinner className="h-4 w-4" /> Preparing your future…
            </>
          ) : (
            <>
              Explore this future{' '}
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </>
          )}
        </span>
      </button>
    </m.li>
  );
}
