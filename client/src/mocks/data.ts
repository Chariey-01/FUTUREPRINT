/**
 * MOCK CONTENT — placeholders only.
 *
 * Final occupations and scenarios come from Person 4; research findings and sources
 * from Person 3; suggestions from Person 5's recommendation engine. Nothing here is
 * real research and every mock source points at example.org on purpose.
 */
import type {
  ChoiceOption,
  Occupation,
  PathwayId,
  ResearchFinding,
  Scenario,
  Suggestion,
} from '../types/api';

interface OccupationSeed extends Occupation {
  flavor: {
    tool: string;
    routineTask: string;
    output: string;
    adjacent: string;
  };
}

export const OCCUPATIONS: OccupationSeed[] = [
  {
    id: 'graphic-designer',
    title: 'Graphic Designer',
    summary: 'Shapes how brands, products and ideas look and feel across print and screen.',
    sector: 'Creative industries',
    flavor: {
      tool: 'an image-generation assistant',
      routineTask: 'first-draft layouts and asset resizing',
      output: 'visual identities',
      adjacent: 'motion and interaction design',
    },
  },
  {
    id: 'accountant',
    title: 'Accountant',
    summary: 'Keeps organisations financially healthy through reporting, compliance and advice.',
    sector: 'Finance',
    flavor: {
      tool: 'an automated bookkeeping platform',
      routineTask: 'reconciliations and routine reporting',
      output: 'financial advice',
      adjacent: 'data analytics and sustainability reporting',
    },
  },
  {
    id: 'nurse',
    title: 'Registered Nurse',
    summary: 'Provides and coordinates patient care, education and support in clinical settings.',
    sector: 'Healthcare',
    flavor: {
      tool: 'an AI-assisted charting system',
      routineTask: 'documentation and shift handover notes',
      output: 'patient care',
      adjacent: 'health informatics and community care',
    },
  },
  {
    id: 'customer-support',
    title: 'Customer Support Specialist',
    summary: 'Helps people solve problems with products and services, by chat, phone and email.',
    sector: 'Services',
    flavor: {
      tool: 'a conversational support assistant',
      routineTask: 'answering common questions',
      output: 'customer experiences',
      adjacent: 'product operations and service design',
    },
  },
];

export const publicOccupation = ({ id, title, summary, sector }: OccupationSeed): Occupation => ({
  id,
  title,
  summary,
  sector,
});

export const TOTAL_STEPS = 3;

function options(scenarioId: string, defs: Record<PathwayId, [string, string]>): ChoiceOption[] {
  return (Object.keys(defs) as PathwayId[]).map((pathway) => ({
    id: `${scenarioId}.${pathway}`,
    pathway,
    label: defs[pathway][0],
    description: defs[pathway][1],
  }));
}

/** Mock "server-side" scenario graph: step 2 branches on the pathway chosen in step 1. */
export function scenarioFor(
  occ: OccupationSeed,
  step: number,
  previous: PathwayId[],
): Scenario | null {
  const f = occ.flavor;
  if (step === 1) {
    const id = `${occ.id}.s1`;
    return {
      id,
      step,
      title: 'A new tool arrives',
      prompt: `Your team adopts ${f.tool} that can take on ${f.routineTask}. How do you respond?`,
      context: 'Nobody knows yet exactly how the work will change. Your first move sets the tone.',
      options: options(id, {
        adapt: [
          'Master the tool',
          'Learn its strengths and limits, and become the person colleagues turn to.',
        ],
        transform: [
          'Redesign the work',
          `Use the time it frees to rethink how your team delivers ${f.output}.`,
        ],
        discover: [
          'Follow your curiosity',
          `Explore the neighbouring field it opens up: ${f.adjacent}.`,
        ],
      }),
    };
  }
  if (step === 2) {
    const branch = previous[0] ?? 'adapt';
    const id = `${occ.id}.s2.${branch}`;
    const copy: Record<PathwayId, { title: string; prompt: string }> = {
      adapt: {
        title: 'The bar rises',
        prompt: `Now that the tool is routine, people expect more from ${f.output}. Where do you invest your growth?`,
      },
      transform: {
        title: 'Your pilot works',
        prompt: 'Leadership notices your redesign and asks what should happen next.',
      },
      discover: {
        title: 'An unexpected door',
        prompt: `Someone working in ${f.adjacent} invites you to join a short project.`,
      },
    };
    return {
      id,
      step,
      ...copy[branch],
      options: options(id, {
        adapt: [
          'Deepen your craft',
          'Specialise in the judgement-heavy work the tool cannot do well.',
        ],
        transform: [
          'Lead the change',
          'Coach others and turn the new way of working into a team habit.',
        ],
        discover: ['Cross-train', 'Take on a stretch role that blends your field with a new one.'],
      }),
    };
  }
  if (step === 3) {
    const id = `${occ.id}.s3`;
    return {
      id,
      step,
      title: 'Five years on',
      prompt: 'Looking ahead, which kind of future do you want to build toward?',
      context: 'There is no right answer — each path is a plausible, valuable future.',
      options: options(id, {
        adapt: [
          'The trusted expert',
          'Known for depth, quality and sound judgement in your field.',
        ],
        transform: ['The architect of new work', 'Designing how people and tools work together.'],
        discover: ['The explorer', 'Building a career that crosses boundaries between fields.'],
      }),
    };
  }
  return null;
}

export const PATHWAY_SUMMARIES: Record<PathwayId, string> = {
  adapt:
    'Your choices lean toward Adapt: growing within your occupation by combining new tools with the human judgement that makes your work valuable.',
  transform:
    'Your choices lean toward Transform: reshaping how work gets done, and helping the people around you change with it.',
  discover:
    'Your choices lean toward Discover: following curiosity into neighbouring fields and building a career that crosses boundaries.',
};

export const MOCK_FINDINGS: ResearchFinding[] = [
  {
    id: 'mock-f1',
    statement:
      '[Mock finding] Placeholder for an evidence-backed statement about how tasks in this occupation are changing.',
    source: {
      id: 'mock-src-1',
      title: 'Mock source A — placeholder for the research team',
      publisher: 'Example Research Institute (mock)',
      year: 2025,
      url: 'https://example.org/futureprint/mock-source-a',
    },
  },
  {
    id: 'mock-f2',
    statement:
      '[Mock finding] Placeholder for a finding on which skills are growing in demand alongside new tools.',
    source: {
      id: 'mock-src-2',
      title: 'Mock source B — placeholder for the research team',
      publisher: 'Example Labour Observatory (mock)',
      year: 2024,
      url: 'https://example.org/futureprint/mock-source-b',
    },
  },
];

export const MOCK_LIMITATIONS = [
  'This is mock data for frontend development. It is not research and should not inform real decisions.',
  'Real reports will describe the limits of the underlying studies, such as regional coverage and timeframes.',
];

export function suggestionsFor(
  pathway: PathwayId,
  occupationTitle: string,
  choiceLabels: string[],
): Suggestion[] {
  const because = (i: number) =>
    choiceLabels[i] ? `You chose “${choiceLabels[i]}” in step ${i + 1}.` : 'Based on your choices.';
  const byPathway: Record<PathwayId, Omit<Suggestion, 'id' | 'reason'>[]> = {
    adapt: [
      {
        category: 'skill',
        title: 'Critical evaluation of AI output',
        description: 'Practise reviewing and correcting tool-generated work.',
      },
      {
        category: 'career_direction',
        title: `Senior ${occupationTitle}`,
        description: 'A path built on depth and quality.',
      },
    ],
    transform: [
      {
        category: 'skill',
        title: 'Workflow and process design',
        description: 'Map how work flows and where tools fit best.',
      },
      {
        category: 'career_direction',
        title: 'Change or operations lead',
        description: 'Guide teams through new ways of working.',
      },
    ],
    discover: [
      {
        category: 'skill',
        title: 'Rapid learning in a new domain',
        description: 'Build a habit of short, structured learning sprints.',
      },
      {
        category: 'career_direction',
        title: 'Hybrid or cross-disciplinary role',
        description: 'Combine your field with an adjacent one.',
      },
    ],
  };
  const common: Omit<Suggestion, 'id' | 'reason'>[] = [
    {
      category: 'transferable_capability',
      title: 'Communicating complex ideas',
      description: 'Valued across every pathway you explored.',
    },
    {
      category: 'learning_activity',
      title: 'Shadow someone for a day',
      description: 'Spend time with a person already doing the work you are curious about.',
    },
    {
      category: 'next_step',
      title: 'Write down one experiment',
      description: 'Pick one small action from this report to try in the next month.',
    },
  ];
  return [...byPathway[pathway], ...common].map((s, i) => ({
    ...s,
    id: `mock-sg-${i + 1}`,
    reason: `[Mock reason] ${because(i % Math.max(choiceLabels.length, 1))}`,
  }));
}
