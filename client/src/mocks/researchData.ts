/**
 * SAMPLE research content for the Observatory and Task Scanner — placeholders only.
 * Nothing here describes a real organisation, event or study. Real content comes from
 * Person 3 (research). Every source points at example.org on purpose.
 */
import type { OccupationTask, Source, TaskBreakdown, WorkforceEvent } from '../types/api';
import { OCCUPATIONS, publicOccupation } from './data';

const src = (n: number, publisher: string, year: number): Source => ({
  id: `sample-src-${n}`,
  title: `Sample source ${n} — placeholder for the research team`,
  publisher: `${publisher} (sample)`,
  year,
  url: `https://example.org/futureprint/sample-source-${n}`,
});

export const SAMPLE_EVENTS: WorkforceEvent[] = [
  {
    id: 'ev-1',
    date: '2025-03',
    title: '[Sample] A design studio adopts generative image tools',
    summary:
      'Placeholder for an evidence-backed event describing how a creative team changed its workflow.',
    industry: 'Creative industries',
    organisation: 'Example Studio',
    eventType: 'adoption',
    evidenceLevel: 'news_report',
    source: src(1, 'Example News', 2025),
  },
  {
    id: 'ev-2',
    date: '2025-06',
    title: '[Sample] New “AI operations” roles appear in finance teams',
    summary:
      'Placeholder for an event about emerging roles that combine finance knowledge with tooling.',
    industry: 'Finance',
    eventType: 'new_role',
    evidenceLevel: 'industry_report',
    source: src(2, 'Example Industry Council', 2025),
  },
  {
    id: 'ev-3',
    date: '2024-11',
    title: '[Sample] A hospital network pilots assisted clinical documentation',
    summary:
      'Placeholder for a pilot study describing time spent on documentation before and after.',
    industry: 'Healthcare',
    organisation: 'Example Health Network',
    eventType: 'adoption',
    evidenceLevel: 'peer_reviewed',
    source: src(3, 'Example Journal of Health Informatics', 2024),
  },
  {
    id: 'ev-4',
    date: '2024-08',
    title: '[Sample] National reskilling programme for service workers',
    summary: 'Placeholder for a policy event describing a training programme and who it covers.',
    industry: 'Services',
    eventType: 'policy',
    evidenceLevel: 'official_statistics',
    source: src(4, 'Example Ministry of Labour', 2024),
  },
  {
    id: 'ev-5',
    date: '2025-09',
    title: '[Sample] Contact centre restructures around conversational assistants',
    summary: 'Placeholder for an event describing changes to team structure and responsibilities.',
    industry: 'Services',
    organisation: 'Example Support Co.',
    eventType: 'restructuring',
    evidenceLevel: 'news_report',
    source: src(5, 'Example Business Daily', 2025),
  },
  {
    id: 'ev-6',
    date: '2025-01',
    title: '[Sample] Professional body launches data-skills certificate',
    summary: 'Placeholder for a training event describing a new qualification.',
    industry: 'Finance',
    eventType: 'training',
    evidenceLevel: 'industry_report',
    source: src(6, 'Example Professional Body', 2025),
  },
];

const TASK_TEMPLATES: Omit<OccupationTask, 'id' | 'source'>[] = [
  {
    name: '[Sample] Routine preparation and formatting',
    classification: 'routine',
    explanation: 'Placeholder: tasks the research suggests are increasingly handled by tools.',
    skills: ['Quality checking', 'Tool configuration'],
  },
  {
    name: '[Sample] Drafting and first versions',
    classification: 'augmented',
    explanation:
      'Placeholder: tasks where people work alongside tools, reviewing and refining output.',
    skills: ['Critical evaluation', 'Prompting and briefing'],
  },
  {
    name: '[Sample] Judgement, relationships and care',
    classification: 'human_led',
    explanation:
      'Placeholder: tasks the research describes as relying on human judgement and trust.',
    skills: ['Communication', 'Ethical judgement', 'Empathy'],
  },
  {
    name: '[Sample] New coordination and oversight work',
    classification: 'emerging',
    explanation: 'Placeholder: tasks that appear as new tools are introduced.',
    skills: ['Process design', 'Data literacy'],
  },
];

export function sampleTaskBreakdown(occupationId: string): TaskBreakdown | null {
  const occ = OCCUPATIONS.find((o) => o.id === occupationId);
  if (!occ) return null;
  return {
    occupation: publicOccupation(occ),
    tasks: TASK_TEMPLATES.map((t, i) => ({
      ...t,
      id: `${occ.id}-task-${i + 1}`,
      source: src(10 + i, 'Example Research Institute', 2025),
    })),
    limitations: [
      'Sample data for frontend development — not research, and not specific to this occupation.',
      'Real task breakdowns will state which studies, regions and timeframes they draw on.',
    ],
  };
}
