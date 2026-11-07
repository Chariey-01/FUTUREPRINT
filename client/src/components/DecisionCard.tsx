import { m } from 'framer-motion';
import { PATHWAYS } from '../lib/pathways';
import type { ChoiceOption } from '../types/api';
import { Spinner } from './LoadingState';
import { PathwayIcon } from './PathwayIcon';

interface Props {
  option: ChoiceOption;
  name: string;
  index: number;
  checked: boolean;
  disabled: boolean;
  submitting: boolean;
  onSelect: (optionId: string) => void;
}

/**
 * A large, readable radio card. The native radio input keeps arrow-key and screen-reader
 * behaviour; pathway is conveyed by icon + text label as well as colour.
 */
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
      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-4xl border-2 p-5 text-left transition-[border-color,box-shadow,background-color] duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-midnight sm:p-6 ${
        checked
          ? `border-midnight ${p.soft} shadow-lift`
          : 'border-transparent bg-ivory-50 shadow-card hover:border-midnight/25 hover:shadow-lift'
      } ${disabled ? 'cursor-not-allowed' : ''} ${disabled && !checked ? 'opacity-55' : ''}`}
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
      <span className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-midnight transition-transform duration-300 motion-reduce:transition-none ${p.accent} ${
              checked ? 'scale-105' : 'group-hover:scale-105'
            }`}
          >
            <PathwayIcon pathway={option.pathway} />
          </span>
          <span className={`eyebrow ${p.ink}`}>{p.name}</span>
        </span>
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            checked ? 'border-midnight bg-midnight text-ivory-50' : 'border-midnight/30 bg-ivory-50'
          }`}
        >
          {checked && submitting ? (
            <Spinner className="h-4 w-4" />
          ) : checked ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
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
      <span className="mt-6 font-display text-2xl font-bold leading-tight">{option.label}</span>
      <span id={descId} className="mt-2 text-base leading-relaxed text-midnight/80">
        {option.description}
      </span>
    </m.label>
  );
}
