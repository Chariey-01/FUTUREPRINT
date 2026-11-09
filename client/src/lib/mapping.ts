/**
 * The one place that translates the Flask API (types/server.ts) into UI types (types/api.ts).
 * Mapping is defensive: missing optional sections become empty lists rather than crashes,
 * so a report from the reference stand-in engine (development only) still renders.
 */
import type {
  ApiErrorCode,
  Choice,
  ObservatoryResponse,
  Occupation,
  PathwayId,
  Report,
  Scenario,
  Session,
  Source,
  TaskBreakdown,
  WorkforceEvent,
} from '../types/api';
import type {
  ServerEvidenceReference,
  ServerHistoryItem,
  ServerOccupationDetail,
  ServerOccupationListItem,
  ServerReportSnapshot,
  ServerScenario,
  ServerSession,
  ServerSourceSummary,
  ServerWorkforceEvent,
} from '../types/server';

const PATHWAYS: PathwayId[] = ['adapt', 'transform', 'discover'];
const asPathway = (v: unknown): PathwayId | null =>
  typeof v === 'string' && (PATHWAYS as string[]).includes(v) ? (v as PathwayId) : null;

const REGION_LABELS: Record<string, string> = {
  kenya: 'Kenya',
  africa: 'Africa',
  global: 'Global',
  outside_africa: 'Outside Africa',
};
export const regionLabel = (r: string | undefined | null) =>
  r ? (REGION_LABELS[r] ?? humanise(r)) : undefined;

export function humanise(value: string): string {
  const s = value.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const asList = (v: string[] | string | null | undefined): string[] =>
  Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? [v] : [];

const yearOf = (date: string | null | undefined) => {
  const y = date ? Number.parseInt(date.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? y : null;
};

/* ---------- Errors ---------- */

const ERROR_CODES: Record<string, ApiErrorCode> = {
  validation_error: 'VALIDATION_ERROR',
  unexpected_fields: 'VALIDATION_ERROR',
  question_too_long: 'VALIDATION_ERROR',
  not_found: 'NOT_FOUND',
  occupation_not_found: 'NOT_FOUND',
  report_not_found: 'NOT_FOUND',
  evidence_not_found: 'NOT_FOUND',
  invalid_token: 'SESSION_NOT_FOUND',
  unauthorized: 'SESSION_NOT_FOUND',
  session_expired: 'SESSION_EXPIRED',
  session_completed: 'SESSION_COMPLETED',
  session_not_completed: 'SESSION_INCOMPLETE',
  session_engine_mismatch: 'SESSION_ENGINE_MISMATCH',
  // The server decides the current step. A choice that's already accepted or no longer belongs
  // to the current scenario means this tab is out of date: re-sync, as with a stale step.
  duplicate_choice: 'STALE_STEP',
  invalid_choice: 'STALE_STEP',
  choice_rejected: 'CHOICE_REJECTED',
  rate_limited: 'RATE_LIMITED',
  content_not_loaded: 'SERVICE_UNAVAILABLE',
  simulation_unavailable: 'SERVICE_UNAVAILABLE',
  service_unavailable: 'SERVICE_UNAVAILABLE',
  engine_error: 'INTERNAL_ERROR',
  internal_error: 'INTERNAL_ERROR',
};

export const mapErrorCode = (serverCode: string): ApiErrorCode | string =>
  ERROR_CODES[serverCode] ?? serverCode.toUpperCase();

/* ---------- Sources ---------- */

export function mapSource(src: ServerSourceSummary | ServerEvidenceReference): Source {
  return {
    id: src.key,
    title: src.title,
    publisher: src.organisation,
    year: yearOf(src.publication_date),
    url: src.url ?? '',
    region: regionLabel(src.region),
  };
}

/* ---------- Occupations ---------- */

export function mapOccupation(o: ServerOccupationListItem): Occupation {
  return {
    id: o.slug,
    title: o.name,
    summary: o.summary,
    sector: o.category,
    simulationAvailable: o.simulation_available,
  };
}

export function mapTaskBreakdown(d: ServerOccupationDetail): TaskBreakdown {
  const o = d.occupation;
  return {
    occupation: {
      id: o.slug,
      title: o.name,
      summary: o.summary,
      sector: o.category,
      simulationAvailable: d.simulation.available,
      exposureLabel: o.exposure.gradient_label,
      exposureSummary: o.exposure.summary ?? null,
      exposureMeasures: o.exposure.measures,
      kenyaContext: o.kenya_context ?? null,
    },
    tasks: d.tasks.map((t) => ({
      id: t.slug,
      name: t.title,
      exposureLevel: t.exposure.level,
      likelyChange: t.likely_change,
      explanation: t.transformation_note ?? '',
      skills: t.skills.map((s) => s.name),
      sources: t.evidence.filter((e) => e.url).map(mapSource),
    })),
    limitations: asList(o.limitations),
  };
}

/* ---------- Workforce events ---------- */

const EVENT_TYPES: Record<string, string> = {
  ai_deployment: 'AI deployment',
  workforce_reduction: 'Workforce reduction',
  skills_programme: 'Skills programme',
  technology_adoption: 'Technology adoption',
};

export function mapWorkforceEvent(e: ServerWorkforceEvent): WorkforceEvent {
  const confidence = e.primary_source.confidence
    ? `${humanise(e.primary_source.confidence)} confidence`
    : 'Evidence';
  return {
    id: e.slug,
    date: e.event_date,
    title: e.title,
    summary: e.summary,
    industry: e.company?.sector || 'Cross-sector',
    organisation: e.company?.name,
    eventTypeLabel: EVENT_TYPES[e.event_type] ?? humanise(e.event_type),
    evidenceLabel: [confidence, regionLabel(e.region)].filter(Boolean).join(' · '),
    interpretationNote: e.interpretation_note ?? null,
    source: mapSource(e.primary_source),
  };
}

export function mapWorkforceEvents(events: ServerWorkforceEvent[]): ObservatoryResponse {
  const items = events
    .map(mapWorkforceEvent)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return { items, industries: [...new Set(items.map((e) => e.industry))].sort() };
}

/* ---------- Sessions ---------- */

function mapScenario(s: ServerScenario, fallbackStep: number): Scenario {
  return {
    id: s.id,
    step: s.step_number ?? fallbackStep,
    title: s.title,
    prompt: s.narrative,
    context: s.task?.title ? `Task in focus: ${s.task.title}` : undefined,
    options: s.choices.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description ?? '',
      pathway: asPathway(c.pathway),
    })),
  };
}

function mapHistory(h: ServerHistoryItem): Choice {
  return {
    step: h.step_index,
    scenarioId: h.scenario.id,
    scenarioTitle: h.scenario.title,
    optionId: h.choice.id,
    optionLabel: h.choice.label,
    pathway: asPathway(h.pathway_kind),
    feedback: h.feedback,
  };
}

export function mapSession(s: ServerSession): Session {
  const completed = s.status === 'completed';
  const scenario = s.current_scenario;
  const currentStep = scenario?.step_number ?? s.step_count + 1;
  return {
    status: completed ? 'completed' : 'in_progress',
    occupation: { id: s.occupation.slug, title: s.occupation.name, summary: '' },
    currentStep,
    // Once complete the server sends no scenario, so the total is the number of choices made.
    totalSteps: completed ? s.step_count : (scenario?.total_steps ?? Math.max(currentStep, 1)),
    currentScenario: !completed && scenario ? mapScenario(scenario, currentStep) : null,
    choices: s.history.map(mapHistory),
    expiresAt: s.expires_at,
    reportGenerated: s.report_generated,
  };
}

/* ---------- Reports ---------- */

export function mapReport(
  snapshot: ServerReportSnapshot,
  meta: { reportId: string; shareToken: string | null; createdAt?: string | null },
): Report {
  const insights = snapshot.insights ?? {};
  const kind =
    asPathway(insights.pathway?.kind) ??
    asPathway(insights.leading_pathway_kind) ??
    asPathway(snapshot.journey.find((j) => j.pathway_kind)?.pathway_kind) ??
    'adapt';
  const contentPathway = snapshot.pathways?.find((p) => p.kind === kind);

  return {
    reportId: meta.reportId,
    generatedAt: snapshot.generated_at ?? meta.createdAt ?? '',
    shareToken: meta.shareToken,
    occupation: {
      id: snapshot.occupation.slug,
      title: snapshot.occupation.name,
      summary: snapshot.occupation.summary ?? '',
      sector: snapshot.occupation.category,
      exposureLabel: snapshot.occupation.exposure?.gradient_label,
    },
    choices: snapshot.journey.map((j) => ({
      step: j.step_index,
      scenarioId: '',
      scenarioTitle: j.scenario_title,
      optionId: '',
      optionLabel: j.choice_label,
      pathway: asPathway(j.pathway_kind),
      feedback: j.feedback,
    })),
    pathway: {
      id: kind,
      title: insights.pathway?.title ?? contentPathway?.title ?? humanise(kind),
      summary: insights.pathway?.summary ?? contentPathway?.summary ?? '',
      reason: insights.pathway?.reason ?? '',
      steps: insights.pathway?.steps ?? contentPathway?.steps ?? [],
    },
    capabilities: (insights.capabilities ?? []).map((c) => ({
      title: c.label,
      description: c.description,
      reason: c.reason,
    })),
    tradeOffs: (insights.trade_offs ?? []).map((c) => ({
      title: c.label,
      description: c.description,
      reason: c.reason,
    })),
    transferableSkills: (insights.transferable_skills ?? []).map((t) => ({
      title: t.name,
      reason: t.reason,
    })),
    otherPathways: (insights.other_pathways ?? []).flatMap((p) => {
      const id = asPathway(p.kind);
      return id ? [{ id, title: p.title, description: p.summary, reason: p.reason }] : [];
    }),
    research: {
      // Engine-attached findings when present; otherwise the occupation's linked evidence.
      findings: insights.research?.length
        ? insights.research.map((r) => ({
            id: r.id,
            statement: r.statement,
            reason: r.reason,
            source: {
              id: r.id,
              title: r.source.title,
              publisher: r.source.publisher,
              year: r.source.year,
              url: r.source.url,
            },
          }))
        : snapshotEvidence(snapshot),
      limitations: [],
    },
    suggestions: (insights.suggestions ?? []).map((s) => ({
      id: s.id,
      category: s.category,
      title: s.title,
      description: s.description,
      reason: s.reason,
    })),
    disclaimer: snapshot.disclaimer,
  };
}

/** Occupation-level evidence from the snapshot, used when the engine attached no findings. */
function snapshotEvidence(snapshot: ServerReportSnapshot) {
  return (snapshot.evidence ?? [])
    .filter((e) => e.url)
    .map((e) => ({ id: e.key, statement: e.relevance ?? e.title, source: mapSource(e) }));
}
