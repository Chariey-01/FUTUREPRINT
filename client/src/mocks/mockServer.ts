/**
 * In-browser mock of the FUTUREPRINT Flask API (server/README.md), in its exact wire format:
 * snake_case bodies, envelopes, `{ error: { code, message } }` with lower_snake codes, and the
 * same request validation (e.g. choices accept only `choice_id`).
 * State is persisted in sessionStorage so a page refresh behaves like the real server.
 */
import type {
  ServerEngineReport,
  ServerErrorEnvelope,
  ServerHistoryItem,
  ServerPathwayKind,
  ServerReportSnapshot,
  ServerSession,
} from '../types/server';
import {
  FEEDBACK,
  MOCK_DISCLAIMER,
  OCCUPATIONS,
  PATHWAY_CONTENT,
  PATHWAY_ORDER,
  TOTAL_STEPS,
  findOccupation,
  listItem,
  mockSource,
  scenarioFor,
} from './data';
import { occupationDetail, workforceEvents } from './researchData';

interface StoredChoice {
  step_index: number;
  scenario_id: string;
  scenario_title: string;
  choice_id: string;
  choice_label: string;
  pathway_kind: ServerPathwayKind;
  chosen_at: string;
}

interface SessionRecord {
  token: string;
  slug: string;
  choices: StoredChoice[];
  createdAt: string;
  expiresAt: number;
  report?: { id: string; shareToken: string; snapshot: ServerReportSnapshot; createdAt: string };
}

const DB_KEY = 'futureprint.mockDb';
const SESSION_TTL_MS = 72 * 60 * 60 * 1000;

let latencyMs = import.meta.env.MODE === 'test' ? 0 : 450;

function load(): Record<string, SessionRecord> {
  try {
    return JSON.parse(window.sessionStorage.getItem(DB_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function save(db: Record<string, SessionRecord>) {
  try {
    window.sessionStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // ignore
  }
}

function randomToken(length = 43) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export interface MockResult {
  status: number;
  body: unknown;
}

export const fail = (status: number, code: string, message: string): MockResult => ({
  status,
  body: { error: { code, message, details: [], request_id: 'mock' } } satisfies ServerErrorEnvelope,
});

const ok = (body: unknown, status = 200): MockResult => ({ status, body });

function sessionView(rec: SessionRecord): ServerSession {
  const occ = findOccupation(rec.slug)!;
  const completed = rec.choices.length >= TOTAL_STEPS;
  const history: ServerHistoryItem[] = rec.choices.map((c) => ({
    step_index: c.step_index,
    scenario: { id: c.scenario_id, title: c.scenario_title },
    choice: { id: c.choice_id, label: c.choice_label },
    feedback: FEEDBACK[c.pathway_kind],
    pathway_kind: c.pathway_kind,
    chosen_at: c.chosen_at,
  }));
  return {
    status: completed ? 'completed' : 'active',
    occupation: { slug: occ.slug, name: occ.name },
    content_version: 'mock',
    engine: { name: 'mock', version: null, is_reference: true },
    step_count: rec.choices.length,
    current_scenario: completed
      ? null
      : scenarioFor(
          occ,
          rec.choices.length + 1,
          rec.choices.map((c) => c.pathway_kind),
        ),
    history,
    report_available: completed,
    report_generated: !!rec.report,
    created_at: rec.createdAt,
    expires_at: new Date(rec.expiresAt).toISOString(),
    completed_at: completed ? rec.choices[rec.choices.length - 1]!.chosen_at : null,
  };
}

function authenticate(headers: Record<string, string>): SessionRecord | MockResult {
  const header = headers.Authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const rec = token ? load()[token] : undefined;
  if (!rec) return fail(401, 'invalid_token', 'A valid session token is required.');
  if (rec.expiresAt < Date.now()) {
    return fail(401, 'session_expired', 'This session has expired. Start a new session.');
  }
  return rec;
}

const isResult = (x: SessionRecord | MockResult): x is MockResult => 'status' in x;

function unknownFields(body: unknown, allowed: string[]): string[] {
  if (!body || typeof body !== 'object') return [];
  return Object.keys(body).filter((k) => !allowed.includes(k));
}

function buildReport(rec: SessionRecord): ServerReportSnapshot {
  const occ = findOccupation(rec.slug)!;
  const counts: Record<ServerPathwayKind, number> = { adapt: 0, transform: 0, discover: 0 };
  rec.choices.forEach((c) => (counts[c.pathway_kind] += 1));
  const max = Math.max(...Object.values(counts));
  const leading = PATHWAY_ORDER.find((k) => counts[k] === max)!;
  const labelsFor = (k: ServerPathwayKind) =>
    rec.choices.filter((c) => c.pathway_kind === k).map((c) => `"${c.choice_label}"`);
  const leadingLabels = labelsFor(leading);
  const content = PATHWAY_CONTENT[leading];
  const s1 = mockSource(1, 'Example Research Institute', 2025);
  const s2 = mockSource(2, 'Example Labour Observatory', 2024, 'kenya');

  const insights: ServerEngineReport = {
    schema_version: 1,
    engine_version: 'mock',
    pathway: {
      kind: leading,
      slug: leading,
      title: content.title,
      summary: content.summary,
      steps: content.steps,
      reason: `[Mock reason] ${content.title.split(':')[0]} is your leading pathway because you chose ${leadingLabels.join(' and ')}.`,
    },
    capabilities: [
      {
        tag: 'adaptability',
        label: 'Adaptability',
        description: 'Adjusting how you work as tools change.',
        reason: `[Mock reason] From your choice "${rec.choices[0]!.choice_label}".`,
      },
    ],
    trade_offs: [],
    suggestions: [
      {
        id: 'mock-sg-1',
        rule_id: 'mock-skill',
        category: 'skill',
        title: 'Critical evaluation of AI output',
        description: 'Practise reviewing and correcting tool-generated work.',
        reason: `[Mock reason] You chose "${rec.choices[0]!.choice_label}" in step 1.`,
      },
      {
        id: 'mock-sg-2',
        rule_id: 'mock-learning',
        category: 'learning_activity',
        title: 'Shadow someone for a day',
        description: 'Spend time with a person already doing the work you are curious about.',
        reason: `[Mock reason] You chose "${rec.choices[1]!.choice_label}" in step 2.`,
      },
      {
        id: 'mock-sg-3',
        rule_id: 'mock-next-step',
        category: 'next_step',
        title: 'Write down one experiment',
        description: 'Pick one small action from this report to try in the next month.',
        reason: `[Mock reason] You chose "${rec.choices[2]!.choice_label}" in step 3.`,
      },
    ],
    transferable_skills: [
      {
        slug: 'communication',
        name: 'Communicating complex ideas',
        reason:
          '[Mock reason] You already use it in your current work, and this pathway builds on it.',
      },
    ],
    research: [
      {
        id: 'mock-f1',
        statement:
          '[Mock finding] Placeholder for an evidence-backed statement about how tasks in this occupation are changing.',
        source: { title: s1.title, publisher: s1.organisation, year: 2025, url: s1.url! },
        reason: '[Mock reason] Supports the leading pathway.',
      },
      {
        id: 'mock-f2',
        statement:
          '[Mock finding] Placeholder for a finding on which skills are growing in demand alongside new tools.',
        source: { title: s2.title, publisher: s2.organisation, year: 2024, url: s2.url! },
        reason: '[Mock reason] Supports a suggestion in this report.',
      },
    ],
    other_pathways: PATHWAY_ORDER.filter((k) => k !== leading).map((k) => ({
      kind: k,
      slug: k,
      title: PATHWAY_CONTENT[k].title,
      summary: PATHWAY_CONTENT[k].summary,
      reason: labelsFor(k).length
        ? `[Mock reason] You touched on it when you chose ${labelsFor(k).join(' and ')}.`
        : '[Mock reason] None of your choices followed it, so it is the least explored option.',
    })),
  };

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    content_version: 'mock',
    occupation: {
      slug: occ.slug,
      name: occ.name,
      category: occ.category,
      summary: occ.summary,
      exposure: listItem(occ).exposure,
    },
    journey: rec.choices.map((c) => ({
      step_index: c.step_index,
      scenario_title: c.scenario_title,
      task: null,
      choice_label: c.choice_label,
      pathway_kind: c.pathway_kind,
      feedback: FEEDBACK[c.pathway_kind],
    })),
    insights,
    pathways: PATHWAY_ORDER.map((k) => ({ kind: k, slug: k, ...PATHWAY_CONTENT[k] })),
    evidence: [{ ...s1, relevance: '[Mock] Placeholder relevance note.' }],
    disclaimer: MOCK_DISCLAIMER,
  };
}

function reportPayload(rec: SessionRecord, created: boolean) {
  const r = rec.report!;
  return {
    created,
    report_id: r.id,
    created_at: r.createdAt,
    share_token: r.shareToken,
    share_path: `/api/v1/reports/${r.shareToken}`,
    report: r.snapshot,
  };
}

export const mockServer = {
  listOccupations: () => ok({ content_version: 'mock', occupations: OCCUPATIONS.map(listItem) }),

  getOccupation(slug: string) {
    const detail = occupationDetail(slug);
    return detail ? ok(detail) : fail(404, 'occupation_not_found', 'Occupation not found.');
  },

  listWorkforceEvents: () => {
    const events = workforceEvents();
    return ok({ events, count: events.length });
  },

  createSession(body: unknown): MockResult {
    const extra = unknownFields(body, ['occupation_slug']);
    const slug = (body as { occupation_slug?: unknown } | null)?.occupation_slug;
    if (extra.length || typeof slug !== 'string') {
      return fail(422, 'validation_error', 'The request body is invalid.');
    }
    const occ = findOccupation(slug);
    if (!occ) return fail(404, 'occupation_not_found', 'Occupation not found.');
    const rec: SessionRecord = {
      token: `fps_${randomToken()}`,
      slug,
      choices: [],
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    const db = load();
    db[rec.token] = rec;
    save(db);
    const session = sessionView(rec);
    return ok(
      { session_token: rec.token, token_type: 'Bearer', expires_at: session.expires_at, session },
      201,
    );
  },

  getCurrentSession(headers: Record<string, string>): MockResult {
    const rec = authenticate(headers);
    return isResult(rec) ? rec : ok({ session: sessionView(rec) });
  },

  submitChoice(headers: Record<string, string>, body: unknown): MockResult {
    const rec = authenticate(headers);
    if (isResult(rec)) return rec;
    if (unknownFields(body, ['choice_id']).length) {
      return fail(422, 'validation_error', 'Unknown fields are not allowed.');
    }
    const choiceId = (body as { choice_id?: unknown } | null)?.choice_id;
    if (typeof choiceId !== 'string')
      return fail(422, 'validation_error', 'choice_id is required.');
    if (rec.choices.some((c) => c.choice_id === choiceId)) {
      return fail(409, 'duplicate_choice', 'This choice was already accepted.');
    }
    const view = sessionView(rec);
    if (view.status === 'completed' || !view.current_scenario) {
      return fail(409, 'session_completed', 'The simulation is finished.');
    }
    const scenario = view.current_scenario;
    const choice = scenario.choices.find((c) => c.id === choiceId);
    if (!choice) {
      return fail(422, 'invalid_choice', 'The choice does not belong to the current scenario.');
    }
    const stepIndex = rec.choices.length + 1;
    rec.choices.push({
      step_index: stepIndex,
      scenario_id: scenario.id,
      scenario_title: scenario.title,
      choice_id: choice.id,
      choice_label: choice.label,
      pathway_kind: choice.pathway!,
      chosen_at: new Date().toISOString(),
    });
    rec.expiresAt = Date.now() + SESSION_TTL_MS; // the server extends the TTL on each choice
    const db = load();
    db[rec.token] = rec;
    save(db);
    const next = sessionView(rec);
    return ok({
      accepted_choice: {
        id: choice.id,
        label: choice.label,
        step_index: stepIndex,
        feedback: FEEDBACK[choice.pathway!],
      },
      completed: next.status === 'completed',
      session: next,
    });
  },

  createReport(headers: Record<string, string>, body: unknown): MockResult {
    const rec = authenticate(headers);
    if (isResult(rec)) return rec;
    if (body && typeof body === 'object' && Object.keys(body).length) {
      return fail(422, 'unexpected_fields', 'The request body must be empty.');
    }
    if (rec.choices.length < TOTAL_STEPS) {
      return fail(
        409,
        'session_not_completed',
        'Finish the simulation before generating a report.',
      );
    }
    if (rec.report) return ok(reportPayload(rec, false));
    rec.report = {
      id: crypto.randomUUID?.() ?? randomToken(32),
      shareToken: randomToken(),
      snapshot: buildReport(rec),
      createdAt: new Date().toISOString(),
    };
    const db = load();
    db[rec.token] = rec;
    save(db);
    return ok(reportPayload(rec, true), 201);
  },

  getSharedReport(shareToken: string): MockResult {
    const rec = Object.values(load()).find((r) => r.report?.shareToken === shareToken);
    if (!rec?.report) return fail(404, 'report_not_found', 'Report not found.');
    return ok({
      report_id: rec.report.id,
      created_at: rec.report.createdAt,
      content_version: 'mock',
      integrity_sha256: 'mock',
      report: rec.report.snapshot,
    });
  },
};

/** Test/dev helpers to exercise edge cases. Not part of the contract. */
export const mockControl = {
  setLatency(ms: number) {
    latencyMs = ms;
  },
  latency() {
    return latencyMs;
  },
  reset() {
    try {
      window.sessionStorage.removeItem(DB_KEY);
    } catch {
      // ignore
    }
  },
  expireAll() {
    const db = load();
    Object.values(db).forEach((r) => (r.expiresAt = Date.now() - 1));
    save(db);
  },
};
