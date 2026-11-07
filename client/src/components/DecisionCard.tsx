import { m } from 'framer-motion';
import { PATHWAYS } from '../lib/pathways';
import type { ChoiceOption } from '../types/api';
import { Spinner } from './LoadingState';

interface Props {
  option: ChoiceOption;
  name: string;
  index: number;
  checked: boolean;
  disabled: boolean;
  submitting: boolean;
  onSelect: (optionId: string) => void;
}

/** A large, readable radio card. Native radio input keeps arrow-key and screen-reader behaviour. */
export function DecisionCard({
  option,
  name,
  index,
  checked,
  disabled,
  submitting,
  onSelect,
}: Props) {
  const p = PATHWAYS[option.pathway];
  const descId = `${option.id}-desc`;
  return (
    <m.label
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      whileHover={disabled ? undefined : { y: -4 }}
      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border-2 bg-ivory-50 p-5 text-left shadow-card transition-[border-color,box-shadow] duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-midnight sm:p-6 ${
        checked ? 'border-midnight shadow-lift' : 'border-transparent hover:border-midnight/25'
      } ${disabled ? 'cursor-not-allowed' : ''} ${disabled && !checked ? 'opacity-60' : ''}`}
      data-testid="decision-card"
      data-checked={checked}
    >
      <input
        type="radio"
        className="sr-only"
        name={name}
        value={option.id}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(option.id)}
        aria-describedby={descId}
      />
      <span className={`absolute inset-x-0 top-0 h-1.5 ${p.accent}`} aria-hidden="true" />
      <span className="flex items-center justify-between gap-3">
        <span className={`eyebrow ${p.ink}`}>{p.name}</span>
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
            checked ? 'border-midnight bg-midnight text-ivory-50' : 'border-midnight/30'
          }`}
        >
          {checked && submitting ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : checked ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
              <path
                d="M3.5 8.5l3 3 6-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
      </span>
      <span className="mt-4 font-display text-xl font-semibold leading-snug sm:text-2xl">
        {option.label}
      </span>
      <span id={descId} className="mt-2 text-base leading-relaxed text-midnight/80">
        {option.description}
      </span>
    </m.label>
  );
}
