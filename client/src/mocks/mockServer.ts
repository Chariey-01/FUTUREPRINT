/**
 * In-browser mock of the FUTUREPRINT backend (provisional contract).
 * State is persisted in sessionStorage so a page refresh behaves like a real server.
 */
import type { ApiError, ApiErrorCode, Choice, PathwayId, Report, Session } from '../types/api';
import {
  MOCK_FINDINGS,
  MOCK_LIMITATIONS,
  OCCUPATIONS,
  PATHWAY_SUMMARIES,
  TOTAL_STEPS,
  publicOccupation,
  scenarioFor,
  suggestionsFor,
} from './data';

interface SessionRecord {
  id: string;
  token: string;
  occupationId: string;
  choices: Choice[];
  expiresAt: number;
}

const DB_KEY = 'futureprint.mockDb';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

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

function randomId(prefix: string) {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${rand}`;
}

export interface MockResult {
  status: number;
  body: unknown;
}

export const fail = (status: number, code: ApiErrorCode, message: string): MockResult => ({
  status,
  body: { error: { code, message } } satisfies ApiError,
});

const occupationById = (id: string) => OCCUPATIONS.find((o) => o.id === id);

function toSession(rec: SessionRecord): Session {
  const occ = occupationById(rec.occupationId)!;
  const step = rec.choices.length + 1;
  const completed = rec.choices.length >= TOTAL_STEPS;
  return {
    id: rec.id,
    status: completed ? 'completed' : 'in_progress',
    occupation: publicOccupation(occ),
    currentStep: step,
    totalSteps: TOTAL_STEPS,
    currentScenario: completed
      ? null
      : scenarioFor(
          occ,
          step,
          rec.choices.map((c) => c.pathway),
        ),
    choices: rec.choices,
    expiresAt: new Date(rec.expiresAt).toISOString(),
  };
}

function authenticate(headers: Record<string, string>): SessionRecord | MockResult {
  const header = headers.Authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const rec = token ? load()[token] : undefined;
  if (!rec) return fail(401, 'SESSION_NOT_FOUND', 'We could not find your journey.');
  if (rec.expiresAt < Date.now()) return fail(401, 'SESSION_EXPIRED', 'Your journey has expired.');
  return rec;
}

const isResult = (x: SessionRecord | MockResult): x is MockResult => 'status' in x;

export const mockServer = {
  listOccupations(): MockResult {
    return { status: 200, body: { items: OCCUPATIONS.map(publicOccupation) } };
  },

  createSession(body: unknown): MockResult {
    const occupationId = (body as { occupationId?: unknown } | null)?.occupationId;
    if (typeof occupationId !== 'string' || !occupationById(occupationId)) {
      return fail(422, 'VALIDATION_ERROR', 'Please choose an occupation from the list.');
    }
    const rec: SessionRecord = {
      id: randomId('ses'),
      token: randomId('mocktok'),
      occupationId,
      choices: [],
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    const db = load();
    db[rec.token] = rec;
    save(db);
    return { status: 201, body: { token: rec.token, session: toSession(rec) } };
  },

  getCurrentSession(headers: Record<string, string>): MockResult {
    const rec = authenticate(headers);
    return isResult(rec) ? rec : { status: 200, body: toSession(rec) };
  },

  submitChoice(headers: Record<string, string>, body: unknown): MockResult {
    const rec = authenticate(headers);
    if (isResult(rec)) return rec;
    const session = toSession(rec);
    const scenario = session.currentScenario;
    if (session.status === 'completed' || !scenario) {
      return fail(409, 'SESSION_COMPLETED', 'You have already made all your decisions.');
    }
    const b = (body ?? {}) as { scenarioId?: unknown; optionId?: unknown; step?: unknown };
    if (b.step !== session.currentStep || b.scenarioId !== scenario.id) {
      return fail(409, 'STALE_STEP', 'This step has already been answered.');
    }
    const option = scenario.options.find((o) => o.id === b.optionId);
    if (!option) return fail(422, 'VALIDATION_ERROR', 'That choice is not available.');

    rec.choices.push({
      step: session.currentStep,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      optionId: option.id,
      optionLabel: option.label,
      pathway: option.pathway,
    });
    const db = load();
    db[rec.token] = rec;
    save(db);
    return { status: 200, body: toSession(rec) };
  },

  createReport(headers: Record<string, string>): MockResult {
    const rec = authenticate(headers);
    if (isResult(rec)) return rec;
    if (rec.choices.length < TOTAL_STEPS) {
      return fail(409, 'SESSION_INCOMPLETE', 'Make all your decisions before viewing your report.');
    }
    const occ = occupationById(rec.occupationId)!;
    const counts: Record<PathwayId, number> = { adapt: 0, transform: 0, discover: 0 };
    rec.choices.forEach((c) => (counts[c.pathway] += 1));
    const last = rec.choices[rec.choices.length - 1]!.pathway;
    const max = Math.max(...Object.values(counts));
    const primary =
      counts[last] === max
        ? last
        : (Object.keys(counts) as PathwayId[]).find((p) => counts[p] === max)!;

    const report: Report = {
      sessionId: rec.id,
      generatedAt: new Date().toISOString(),
      occupation: publicOccupation(occ),
      choices: rec.choices,
      pathway: { id: primary, summary: PATHWAY_SUMMARIES[primary] },
      research: { findings: MOCK_FINDINGS, limitations: MOCK_LIMITATIONS },
      suggestions: suggestionsFor(
        primary,
        occ.title,
        rec.choices.map((c) => c.optionLabel),
      ),
    };
    return { status: 200, body: report };
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
