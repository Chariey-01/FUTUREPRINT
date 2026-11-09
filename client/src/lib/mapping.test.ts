import type { ServerReportSnapshot, ServerSession, ServerWorkforceEvent } from '../types/server';
import { mapErrorCode, mapOccupation, mapReport, mapSession, mapWorkforceEvent } from './mapping';

/** Fixtures follow the examples in server/README.md and the server serializers. */
const activeSession: ServerSession = {
  status: 'active',
  occupation: { slug: 'software-developer', name: 'Software Developer' },
  content_version: '2026.11.07+589cc455',
  step_count: 1,
  current_scenario: {
    id: 'scn-2',
    title: 'Your team adopts an AI coding assistant',
    narrative: 'You are a junior developer at a Nairobi start-up ...',
    task: { slug: 'design-and-build-software', title: 'Design and build software systems' },
    step_number: 2,
    total_steps: 4,
    choices: [
      { id: 'c-1', label: 'Use it, but review everything', description: '...', pathway: 'adapt' },
      { id: 'c-2', label: 'Avoid it', description: '...', pathway: null },
    ],
  },
  history: [
    {
      step_index: 1,
      scenario: { id: 'scn-1', title: 'First week' },
      choice: { id: 'c-0', label: 'Ask questions' },
      feedback: 'Good start.',
      pathway_kind: 'discover',
      chosen_at: '2026-11-09T10:00:00+00:00',
    },
  ],
  report_available: false,
  report_generated: false,
  created_at: '2026-11-09T09:00:00+00:00',
  expires_at: '2026-11-12T09:00:00+00:00',
  completed_at: null,
};

describe('mapSession', () => {
  it('maps an active session, keeping the server as the source of truth for steps', () => {
    const s = mapSession(activeSession);
    expect(s.status).toBe('in_progress');
    expect(s.occupation).toMatchObject({ id: 'software-developer', title: 'Software Developer' });
    expect(s.currentStep).toBe(2);
    expect(s.totalSteps).toBe(4);
    expect(s.currentScenario).toMatchObject({
      id: 'scn-2',
      step: 2,
      prompt: 'You are a junior developer at a Nairobi start-up ...',
      context: 'Task in focus: Design and build software systems',
    });
    expect(s.currentScenario!.options.map((o) => o.pathway)).toEqual(['adapt', null]);
    expect(s.choices[0]).toMatchObject({
      step: 1,
      optionLabel: 'Ask questions',
      pathway: 'discover',
      feedback: 'Good start.',
    });
  });

  it('maps a completed session (no current scenario) using step_count as the total', () => {
    const s = mapSession({
      ...activeSession,
      status: 'completed',
      step_count: 4,
      current_scenario: null,
    });
    expect(s.status).toBe('completed');
    expect(s.currentScenario).toBeNull();
    expect(s.totalSteps).toBe(4);
  });

  it('tolerates the reference engine (no step_number, total_steps or pathway)', () => {
    const scenario = {
      ...activeSession.current_scenario!,
      step_number: undefined,
      total_steps: undefined,
    };
    scenario.choices = scenario.choices.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
    }));
    const s = mapSession({ ...activeSession, current_scenario: scenario });
    expect(s.currentStep).toBe(2); // step_count + 1
    expect(s.currentScenario!.options.every((o) => o.pathway === null)).toBe(true);
  });
});

describe('mapErrorCode', () => {
  it.each([
    ['invalid_token', 'SESSION_NOT_FOUND'],
    ['session_expired', 'SESSION_EXPIRED'],
    ['duplicate_choice', 'STALE_STEP'],
    ['invalid_choice', 'STALE_STEP'],
    ['session_not_completed', 'SESSION_INCOMPLETE'],
    ['session_engine_mismatch', 'SESSION_ENGINE_MISMATCH'],
    ['occupation_not_found', 'NOT_FOUND'],
    ['something_new', 'SOMETHING_NEW'],
  ])('%s → %s', (server, ui) => expect(mapErrorCode(server)).toBe(ui));
});

describe('mapOccupation', () => {
  it('maps slug/name/category and simulation availability', () => {
    expect(
      mapOccupation({
        slug: 'customer-service-agent',
        name: 'Customer Service / Contact Centre Agent',
        category: 'Clerical support',
        summary: 'Answers customer questions',
        isco_08_code: '4222',
        exposure: {
          gradient: 'gradient_3',
          gradient_label: 'Exposed: Gradient 3',
          ilo_mean_score: 0.58,
        },
        task_count: 6,
        pathway_kinds: ['adapt', 'discover', 'transform'],
        simulation_available: false,
      }),
    ).toEqual({
      id: 'customer-service-agent',
      title: 'Customer Service / Contact Centre Agent',
      summary: 'Answers customer questions',
      sector: 'Clerical support',
      simulationAvailable: false,
    });
  });
});

describe('mapWorkforceEvent', () => {
  it('labels event type, confidence and region (so non-African evidence is visible)', () => {
    const e: ServerWorkforceEvent = {
      slug: 'klarna-2024',
      title: 'Klarna AI assistant',
      event_date: '2024-02-27',
      event_type: 'ai_deployment',
      company: {
        slug: 'klarna',
        name: 'Klarna',
        headquarters_country: 'SE',
        sector: 'Financial services',
      },
      summary: '...',
      region: 'outside_africa',
      is_african_evidence: false,
      primary_source: {
        key: 'klarna-press',
        organisation: 'Klarna',
        title: 'Press release',
        url: 'https://example.org/klarna',
        publication_date: '2024-02-27',
        region: 'outside_africa',
        is_african_evidence: false,
        evidence_category: 'company_statement',
        source_type: 'primary',
        confidence: 'low',
      },
    };
    expect(mapWorkforceEvent(e)).toMatchObject({
      industry: 'Financial services',
      organisation: 'Klarna',
      eventTypeLabel: 'AI deployment',
      evidenceLabel: 'Low confidence · Outside Africa',
      source: { publisher: 'Klarna', year: 2024, region: 'Outside Africa' },
    });
  });
});

describe('mapReport', () => {
  const base: ServerReportSnapshot = {
    schema_version: 1,
    generated_at: '2026-11-09T12:00:00+00:00',
    content_version: 'v',
    occupation: { slug: 'accountant', name: 'Accountant' },
    journey: [
      {
        step_index: 1,
        scenario_title: 'S1',
        choice_label: 'A',
        pathway_kind: 'transform',
        feedback: 'fb',
      },
    ],
    insights: {},
    pathways: [
      {
        kind: 'transform',
        slug: 't',
        title: 'Transform: lead change',
        summary: 'sum',
        steps: ['one'],
      },
    ],
    evidence: [
      {
        key: 'ilo',
        organisation: 'ILO',
        title: 'GenAI exposure',
        url: 'https://example.org/ilo',
        publication_date: '2025-05-01',
        region: 'global',
        is_african_evidence: false,
        evidence_category: 'ai_exposure_research',
        source_type: 'primary',
        confidence: 'high',
        relevance: 'Why this source matters',
      },
    ],
    disclaimer: 'Not a prediction.',
  };

  it('falls back to snapshot pathways and evidence for a reference-engine report', () => {
    const r = mapReport(
      { ...base, insights: { leading_pathway_kind: 'transform' } },
      { reportId: 'r1', shareToken: 'tok' },
    );
    expect(r.pathway).toMatchObject({
      id: 'transform',
      title: 'Transform: lead change',
      steps: ['one'],
    });
    expect(r.research.findings).toEqual([
      expect.objectContaining({
        statement: 'Why this source matters',
        source: expect.objectContaining({ publisher: 'ILO' }),
      }),
    ]);
    expect(r.suggestions).toEqual([]);
    expect(r.disclaimer).toBe('Not a prediction.');
    expect(r.choices[0]).toMatchObject({ optionLabel: 'A', pathway: 'transform', feedback: 'fb' });
  });

  it('uses the real engine sections, keeping every reason', () => {
    const r = mapReport(
      {
        ...base,
        insights: {
          pathway: {
            kind: 'transform',
            slug: 't',
            title: 'T',
            summary: 's',
            steps: [],
            reason: 'because X',
          },
          suggestions: [
            {
              id: 's1',
              rule_id: 'r',
              category: 'skill',
              title: 'Skill',
              description: 'd',
              reason: 'why s1',
            },
          ],
          other_pathways: [{ kind: 'adapt', slug: 'a', title: 'A', summary: 's', reason: 'why a' }],
          research: [
            {
              id: 'f1',
              statement: 'Finding',
              source: { title: 'T', publisher: 'P', year: 2025, url: 'https://x' },
              reason: 'supports',
            },
          ],
        },
      },
      { reportId: 'r1', shareToken: null },
    );
    expect(r.pathway.reason).toBe('because X');
    expect(r.suggestions[0]!.reason).toBe('why s1');
    expect(r.otherPathways[0]).toMatchObject({ id: 'adapt', reason: 'why a' });
    expect(r.research.findings[0]).toMatchObject({ statement: 'Finding', reason: 'supports' });
  });
});
