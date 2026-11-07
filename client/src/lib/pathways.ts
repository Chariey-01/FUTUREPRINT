import type { PathwayId } from '../types/api';

/** Presentation metadata only — the server decides which pathway a choice belongs to. */
export const PATHWAYS: Record<
  PathwayId,
  { name: string; tagline: string; chip: string; accent: string; soft: string; ink: string }
> = {
  adapt: {
    name: 'Adapt',
    tagline: 'Build on your skills in new ways',
    chip: 'bg-adapt-soft text-adapt-ink',
    accent: 'bg-adapt',
    soft: 'bg-adapt-soft',
    ink: 'text-adapt-ink',
  },
  transform: {
    name: 'Transform',
    tagline: 'Take your career in a bold new direction',
    chip: 'bg-transform-soft text-transform-ink',
    accent: 'bg-transform',
    soft: 'bg-transform-soft',
    ink: 'text-transform-ink',
  },
  discover: {
    name: 'Discover',
    tagline: 'Explore new possibilities and growing fields',
    chip: 'bg-discover-soft text-discover-ink',
    accent: 'bg-discover',
    soft: 'bg-discover-soft',
    ink: 'text-discover-ink',
  },
};

export const PATHWAY_ORDER: PathwayId[] = ['adapt', 'transform', 'discover'];
