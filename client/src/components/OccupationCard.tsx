import { m } from 'framer-motion';
import { occupationPhoto } from '../lib/occupationImages';
import type { Occupation } from '../types/api';
import { Spinner } from './LoadingState';

interface Props {
  occupation: Occupation;
  index: number;
  pending: boolean;
  disabled: boolean;
  onSelect: (occupation: Occupation) => void;
}

/** An occupation card: a photo of the work when we have one, otherwise a door into its future. */
export function OccupationCard({ occupation, index, pending, disabled, onSelect }: Props) {
  const photo = occupationPhoto(occupation.id);
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
        className={`group flex h-full w-full gap-5 rounded-4xl bg-ivory-50 text-left shadow-card transition-shadow duration-200 hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-60 sm:gap-6 ${
          photo ? 'flex-col p-3 sm:flex-row sm:items-stretch sm:pr-6' : 'items-stretch p-4 sm:p-5'
        }`}
      >
        {photo ? <Photo src={photo} /> : <Door />}
        <span
          className={`flex min-w-0 flex-1 flex-col ${photo ? 'px-2 pb-3 sm:px-0 sm:py-4' : 'py-1'}`}
        >
          {occupation.sector && (
            <span className="eyebrow text-midnight/80">{occupation.sector}</span>
          )}
          <span className="mt-2 font-display text-2xl font-bold leading-tight sm:text-[1.7rem]">
            {occupation.title}
          </span>
          <span className="mt-2 flex-1 text-midnight/80">{occupation.summary}</span>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
            {pending ? (
              <>
                <Spinner className="h-4 w-4" /> Opening this future…
              </>
            ) : (
              <>
                Step through
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </>
            )}
          </span>
        </span>
      </button>
    </m.li>
  );
}

/**
 * Decorative photo: the occupation title sits right beside it, so alt="" avoids repeating it
 * to screen readers. Lazy-loaded with intrinsic size to prevent layout shift.
 */
function Photo({ src }: { src: string }) {
  return (
    <span className="relative block aspect-[16/10] w-full shrink-0 overflow-hidden rounded-3xl bg-midnight/10 sm:aspect-auto sm:w-[40%] sm:min-h-[200px]">
      <img
        src={src}
        alt=""
        width={322}
        height={290}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-[50%_25%] transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
      />
    </span>
  );
}

/** Arched doorway framing a horizon where all three pathways are still open. */
function Door() {
  return (
    <span
      aria-hidden="true"
      className="relative block w-24 shrink-0 overflow-hidden rounded-b-2xl rounded-t-full bg-midnight sm:w-28"
    >
      <svg
        viewBox="0 0 112 160"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <radialGradient id="door-glow" cx="0.5" cy="0.7" r="0.6">
            <stop offset="0%" stopColor="#FBE3B8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E7A18F" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="112" height="160" fill="url(#door-glow)" />
        <circle
          cx="56"
          cy="112"
          r="18"
          fill="#FFF3DC"
          className="transition-transform duration-500 ease-out motion-safe:group-hover:-translate-y-2"
        />
        <path d="M0 112 C30 100 80 104 112 110 V160 H0 Z" fill="#6E6496" />
        <path d="M54 112 C40 130 20 145 6 160 H26 C36 146 48 130 56 113 Z" fill="#C7B9E6" />
        <path d="M56 113 C54 130 58 146 52 160 H64 C62 146 60 130 58 113 Z" fill="#EDA894" />
        <path d="M58 112 C72 130 92 145 108 160 H88 C78 146 66 130 58 113 Z" fill="#9CC4A6" />
      </svg>
      <span className="block min-h-[150px]" />
    </span>
  );
}
