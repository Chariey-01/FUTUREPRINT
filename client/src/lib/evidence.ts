import type { LikelyChange, TaskExposureLevel } from '../types/api';
import { humanise } from './mapping';

/**
 * Presentation labels for the server's research classifications (server/app/models/base.py).
 * The classification of each task, source and event always comes from the API.
 */

/** How the research expects a task to change (`likely_change`). Text + symbol, never colour alone. */
export const LIKELY_CHANGE: Record<
  LikelyChange,
  { label: string; description: string; chip: string; mark: string }
> = {
  mostly_human: {
    label: 'Mostly human',
    description: 'Relies on judgement, relationships and care; tools play a small part.',
    chip: 'bg-transform-soft text-transform-ink',
    mark: '●',
  },
  augmentation: {
    label: 'Augmented',
    description: 'People and tools working together, with people reviewing the output.',
    chip: 'bg-adapt-soft text-adapt-ink',
    mark: '◐',
  },
  partial_automation: {
    label: 'Partly automated',
    description: 'Parts of the task are increasingly handled by tools.',
    chip: 'bg-midnight/10 text-midnight',
    mark: '○',
  },
};

export const LIKELY_CHANGE_ORDER: LikelyChange[] = [
  'partial_automation',
  'augmentation',
  'mostly_human',
];

export function likelyChange(value: string) {
  return (
    LIKELY_CHANGE[value as LikelyChange] ?? {
      label: humanise(value),
      description: '',
      chip: 'bg-midnight/10 text-midnight',
      mark: '•',
    }
  );
}

/** Potential exposure of a task to generative AI (ILO-based). Not a measure of job loss. */
export const EXPOSURE_LEVELS: Record<TaskExposureLevel, string> = {
  very_low: 'Very low exposure',
  low: 'Low exposure',
  medium: 'Medium exposure',
  high: 'High exposure',
};

export const exposureLabel = (level: string) =>
  EXPOSURE_LEVELS[level as TaskExposureLevel] ?? `${humanise(level)} exposure`;

/** Confidence ratings assigned by the research team. Definitions are theirs (GET /methodology). */
export const CONFIDENCE_LEVELS = ['High confidence', 'Medium confidence', 'Low confidence'];

export const REGIONS = [
  { label: 'Kenya', description: 'Evidence specific to Kenya.' },
  { label: 'Africa', description: 'Evidence from elsewhere on the continent.' },
  { label: 'Global', description: 'Cross-country evidence.' },
  {
    label: 'Outside Africa',
    description: 'Evidence from other regions, labelled so you can weigh it.',
  },
];
