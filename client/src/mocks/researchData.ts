/**
 * SAMPLE research content in the Flask API's wire format (GET /occupations/{slug} and
 * GET /workforce-events). Placeholders only: nothing here describes a real organisation,
 * event or study, and every source points at example.org. Real content: server/seed_data.
 */
import type { ServerOccupationDetail, ServerTask, ServerWorkforceEvent } from '../types/server';
import { findOccupation, listItem, mockSource } from './data';

const EVENTS: Omit<ServerWorkforceEvent, 'primary_source'>[] = [
  {
    slug: 'ev-1',
    title: '[Sample] A design studio adopts generative image tools',
    event_date: '2025-03-01',
    event_type: 'technology_adoption',
    company: {
      slug: 'example-studio',
      name: 'Example Studio',
      headquarters_country: 'KE',
      sector: 'Creative industries',
    },
    summary:
      'Placeholder for an evidence-backed event describing how a creative team changed its workflow.',
    interpretation_note: '[Sample] Placeholder note on how to interpret this event.',
    region: 'kenya',
    is_african_evidence: true,
  },
  {
    slug: 'ev-2',
    title: '[Sample] New “AI operations” roles appear in finance teams',
    event_date: '2025-06-01',
    event_type: 'ai_deployment',
    company: {
      slug: 'example-bank',
      name: 'Example Bank',
      headquarters_country: null,
      sector: 'Finance',
    },
    summary:
      'Placeholder for an event about emerging roles that combine finance knowledge with tooling.',
    region: 'global',
    is_african_evidence: false,
  },
  {
    slug: 'ev-3',
    title: '[Sample] A hospital network pilots assisted clinical documentation',
    event_date: '2024-11-01',
    event_type: 'technology_adoption',
    company: {
      slug: 'example-health',
      name: 'Example Health Network',
      headquarters_country: null,
      sector: 'Healthcare',
    },
    summary:
      'Placeholder for a pilot study describing time spent on documentation before and after.',
    region: 'outside_africa',
    is_african_evidence: false,
  },
  {
    slug: 'ev-4',
    title: '[Sample] National reskilling programme for service workers',
    event_date: '2024-08-01',
    event_type: 'skills_programme',
    company: null,
    summary: 'Placeholder for a policy event describing a training programme and who it covers.',
    region: 'kenya',
    is_african_evidence: true,
  },
  {
    slug: 'ev-5',
    title: '[Sample] Contact centre restructures around conversational assistants',
    event_date: '2025-09-01',
    event_type: 'workforce_reduction',
    company: {
      slug: 'example-support',
      name: 'Example Support Co.',
      headquarters_country: null,
      sector: 'Services',
    },
    summary: 'Placeholder for an event describing changes to team structure and responsibilities.',
    region: 'africa',
    is_african_evidence: true,
  },
  {
    slug: 'ev-6',
    title: '[Sample] Professional body launches data-skills certificate',
    event_date: '2025-01-01',
    event_type: 'skills_programme',
    company: {
      slug: 'example-body',
      name: 'Example Professional Body',
      headquarters_country: null,
      sector: 'Finance',
    },
    summary: 'Placeholder for a training event describing a new qualification.',
    region: 'global',
    is_african_evidence: false,
  },
];

export function workforceEvents(): ServerWorkforceEvent[] {
  return EVENTS.map((e, i) => ({
    ...e,
    primary_source: {
      ...mockSource(i + 1, 'Example Publisher', 2025, e.region),
      confidence: i % 2 ? 'medium' : 'high',
    },
  }));
}

const TASKS: Omit<ServerTask, 'evidence'>[] = [
  {
    slug: 'routine-preparation',
    title: '[Sample] Routine preparation and formatting',
    exposure: { level: 'high', ilo_task_score: 0.7 },
    likely_change: 'partial_automation',
    transformation_note:
      'Placeholder: tasks the research suggests are increasingly handled by tools.',
    skills: [
      { slug: 'quality-checking', name: 'Quality checking', category: 'technical' },
      { slug: 'tool-configuration', name: 'Tool configuration', category: 'digital' },
    ],
  },
  {
    slug: 'drafting',
    title: '[Sample] Drafting and first versions',
    exposure: { level: 'medium', ilo_task_score: 0.5 },
    likely_change: 'augmentation',
    transformation_note:
      'Placeholder: tasks where people work alongside tools, reviewing and refining output.',
    skills: [
      { slug: 'critical-evaluation', name: 'Critical evaluation', category: 'ai' },
      { slug: 'briefing', name: 'Prompting and briefing', category: 'ai' },
    ],
  },
  {
    slug: 'judgement-care',
    title: '[Sample] Judgement, relationships and care',
    exposure: { level: 'low', ilo_task_score: 0.2 },
    likely_change: 'mostly_human',
    transformation_note:
      'Placeholder: tasks the research describes as relying on human judgement and trust.',
    skills: [
      { slug: 'communication', name: 'Communication', category: 'human' },
      { slug: 'empathy', name: 'Empathy', category: 'human' },
    ],
  },
  {
    slug: 'coordination',
    title: '[Sample] Coordination and oversight',
    exposure: { level: 'very_low', ilo_task_score: 0.1 },
    likely_change: 'mostly_human',
    transformation_note: 'Placeholder: oversight work that grows as new tools are introduced.',
    skills: [
      { slug: 'process-design', name: 'Process design', category: 'domain' },
      { slug: 'data-literacy', name: 'Data literacy', category: 'digital' },
    ],
  },
];

export function occupationDetail(slug: string): ServerOccupationDetail | null {
  const occ = findOccupation(slug);
  if (!occ) return null;
  const item = listItem(occ);
  return {
    content_version: 'mock',
    occupation: {
      slug: occ.slug,
      name: occ.name,
      category: occ.category,
      summary: occ.summary,
      kenya_context: '[Sample] Placeholder for Kenya-specific context from the research team.',
      limitations:
        'Sample data for frontend development — not research, and not specific to this occupation. Real task breakdowns state which studies, regions and timeframes they draw on.',
      exposure: {
        ...item.exposure,
        summary: '[Sample] Placeholder exposure summary.',
        measures: 'potential exposure of tasks to generative AI, not job loss',
      },
    },
    tasks: TASKS.map((t, i) => ({
      ...t,
      evidence: [
        {
          ...mockSource(10 + i, 'Example Research Institute', 2025),
          relevance: '[Sample] relevance',
        },
      ],
    })),
    skills: [],
    pathways: [],
    evidence: [],
    workforce_events: [],
    sources: [],
    simulation: { available: true, scenario_count: 4 },
  };
}
