/**
 * MOCK CONTENT — placeholders in the Flask API's wire format (types/server.ts).
 *
 * Real content lives in server/seed_data and is served by the backend. Nothing here is real
 * research: every mock source points at example.org. Slugs match the backend seed so the UI
 * (photos, links) behaves the same against mock and real data.
 */
import type {
  ServerOccupationListItem,
  ServerPathwayKind,
  ServerScenario,
  ServerSourceSummary,
} from '../types/server';

export const PATHWAY_ORDER: ServerPathwayKind[] = ['adapt', 'transform', 'discover'];

interface OccupationSeed {
  slug: string;
  name: string;
  category: string;
  summary: string;
  flavor: { tool: string; routineTask: string; output: string; adjacent: string };
}

export const OCCUPATIONS: OccupationSeed[] = [
  {
    slug: 'graphic-designer',
    name: 'Graphic Designer',
    category: 'Creative industries',
    summary: 'Shapes how brands, products and ideas look and feel across print and screen.',
    flavor: {
      tool: 'an image-generation assistant',
      routineTask: 'first-draft layouts and asset resizing',
      output: 'visual identities',
      adjacent: 'motion and interaction design',
    },
  },
  {
    slug: 'accountant',
    name: 'Accountant',
    category: 'Finance',
    summary: 'Keeps organisations financially healthy through reporting, compliance and advice.',
    flavor: {
      tool: 'an automated bookkeeping platform',
      routineTask: 'reconciliations and routine reporting',
      output: 'financial advice',
      adjacent: 'data analytics and sustainability reporting',
    },
  },
  {
    slug: 'registered-nurse',
    name: 'Registered Nurse',
    category: 'Healthcare',
    summary: 'Provides and coordinates patient care, education and support in clinical settings.',
    flavor: {
      tool: 'an AI-assisted charting system',
      routineTask: 'documentation and shift handover notes',
      output: 'patient care',
      adjacent: 'health informatics and community care',
    },
  },
  {
    slug: 'customer-service-agent',
    name: 'Customer Support Specialist',
    category: 'Services',
    summary: 'Helps people solve problems with products and services, by chat, phone and email.',
    flavor: {
      tool: 'a conversational support assistant',
      routineTask: 'answering common questions',
      output: 'customer experiences',
      adjacent: 'product operations and service design',
    },
  },
];

export const findOccupation = (slug: string) => OCCUPATIONS.find((o) => o.slug === slug);

export const listItem = (o: OccupationSeed): ServerOccupationListItem => ({
  slug: o.slug,
  name: o.name,
  category: o.category,
  summary: o.summary,
  isco_08_code: '0000',
  exposure: {
    gradient: 'gradient_2',
    gradient_label: 'Exposed: Gradient 2 (moderate exposure, high task variability)',
    ilo_mean_score: 0.5,
  },
  task_count: 4,
  pathway_kinds: [...PATHWAY_ORDER],
  simulation_available: true,
});

export const TOTAL_STEPS = 3;

type ChoiceDefs = Record<ServerPathwayKind, [string, string]>;

function choices(scenarioId: string, defs: ChoiceDefs) {
  return PATHWAY_ORDER.map((pathway) => ({
    id: `${scenarioId}.${pathway}`,
    pathway,
    label: defs[pathway][0],
    description: defs[pathway][1],
  }));
}

/** Mock scenario graph in the engine's `present_scenario` shape; step 2 branches on step 1. */
export function scenarioFor(
  occ: OccupationSeed,
  step: number,
  previous: ServerPathwayKind[],
): ServerScenario | null {
  const f = occ.flavor;
  const task = {
    slug: 'routine-work',
    title: f.routineTask.charAt(0).toUpperCase() + f.routineTask.slice(1),
    exposure_level: 'medium',
  };
  const base = { step_number: step, total_steps: TOTAL_STEPS, task };
  if (step === 1) {
    const id = `${occ.slug}.s1`;
    return {
      ...base,
      id,
      key: 's1',
      title: 'A new tool arrives',
      narrative: `Your team adopts ${f.tool} that can take on ${f.routineTask}. How do you respond?`,
      choices: choices(id, {
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
    const id = `${occ.slug}.s2.${branch}`;
    const copy: Record<ServerPathwayKind, { title: string; narrative: string }> = {
      adapt: {
        title: 'The bar rises',
        narrative: `Now that the tool is routine, people expect more from ${f.output}. Where do you invest your growth?`,
      },
      transform: {
        title: 'Your pilot works',
        narrative: 'Leadership notices your redesign and asks what should happen next.',
      },
      discover: {
        title: 'An unexpected door',
        narrative: `Someone working in ${f.adjacent} invites you to join a short project.`,
      },
    };
    return {
      ...base,
      id,
      key: `s2.${branch}`,
      ...copy[branch],
      choices: choices(id, {
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
    const id = `${occ.slug}.s3`;
    return {
      ...base,
      id,
      key: 's3',
      title: 'Five years on',
      narrative: 'Looking ahead, which kind of future do you want to build toward?',
      choices: choices(id, {
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

export const FEEDBACK: Record<ServerPathwayKind, string> = {
  adapt:
    '[Mock feedback] Building on your strengths keeps your experience valuable as tools change.',
  transform: '[Mock feedback] Reshaping the work spreads the benefit of new tools across the team.',
  discover: '[Mock feedback] Exploring a neighbouring field widens the options open to you.',
};

export const PATHWAY_CONTENT: Record<
  ServerPathwayKind,
  { title: string; summary: string; steps: string[] }
> = {
  adapt: {
    title: 'Adapt: grow within your role',
    summary:
      'Your choices lean toward Adapt: growing within your occupation by combining new tools with the human judgement that makes your work valuable.',
    steps: [
      '[Mock step] Learn the tools your team uses',
      '[Mock step] Specialise in judgement-heavy work',
    ],
  },
  transform: {
    title: 'Transform: reshape the work',
    summary:
      'Your choices lean toward Transform: reshaping how work gets done, and helping the people around you change with it.',
    steps: [
      '[Mock step] Map how work flows today',
      '[Mock step] Pilot one improvement with your team',
    ],
  },
  discover: {
    title: 'Discover: cross into new fields',
    summary:
      'Your choices lean toward Discover: following curiosity into neighbouring fields and building a career that crosses boundaries.',
    steps: [
      '[Mock step] Shadow someone in a neighbouring field',
      '[Mock step] Take a short course',
    ],
  },
};

export const mockSource = (
  n: number,
  organisation: string,
  year: number,
  region = 'global',
): ServerSourceSummary => ({
  key: `mock-source-${n}`,
  organisation: `${organisation} (mock)`,
  title: `Mock source ${String.fromCharCode(64 + n)} — placeholder for the research team`,
  url: `https://example.org/futureprint/mock-source-${n}`,
  publication_date: `${year}-01-01`,
  region,
  is_african_evidence: region === 'kenya' || region === 'africa',
  evidence_category: 'ai_exposure_research',
  source_type: 'primary',
  confidence: 'medium',
});

export const MOCK_DISCLAIMER =
  '[Mock] This report reflects the choices you made in an illustrative simulation using sample data. It is not a prediction about your job or career, and the sources are placeholders.';
