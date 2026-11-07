import type { EvidenceLevel, TaskClassification, WorkforceEventType } from '../types/api';

/** Presentation labels only. Classification itself always comes from the research data. */
export const EVIDENCE_LABELS: Record<EvidenceLevel, { label: string; description: string }> = {
  official_statistics: {
    label: 'Official statistics',
    description: 'Published by a national statistics office or government body.',
  },
  peer_reviewed: {
    label: 'Peer-reviewed',
    description: 'Published in an academic journal after independent review.',
  },
  industry_report: {
    label: 'Industry report',
    description: 'Published by an industry body, consultancy or professional association.',
  },
  news_report: {
    label: 'News report',
    description: 'Reported by a news organisation; useful for recent events, weaker as evidence.',
  },
};

export const EVENT_TYPE_LABELS: Record<WorkforceEventType, string> = {
  adoption: 'Technology adoption',
  restructuring: 'Restructuring',
  new_role: 'New role',
  policy: 'Policy',
  training: 'Training',
};

export const TASK_CLASSES: Record<
  TaskClassification,
  { label: string; description: string; chip: string; mark: string }
> = {
  routine: {
    label: 'Routine',
    description: 'Increasingly handled by tools.',
    chip: 'bg-midnight/10 text-midnight',
    mark: '○',
  },
  augmented: {
    label: 'Augmented',
    description: 'People and tools working together.',
    chip: 'bg-adapt-soft text-adapt-ink',
    mark: '◐',
  },
  human_led: {
    label: 'Human-led',
    description: 'Relies on judgement, relationships and care.',
    chip: 'bg-transform-soft text-transform-ink',
    mark: '●',
  },
  emerging: {
    label: 'Emerging',
    description: 'New work appearing as tools arrive.',
    chip: 'bg-discover-soft text-discover-ink',
    mark: '✦',
  },
};
