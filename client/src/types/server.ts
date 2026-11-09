/**
 * Wire types for the FUTUREPRINT Flask API (`/api/v1`), mirroring server/README.md and
 * server/app/services/{serializers,session_service,occupation_service,evidence_service,
 * report_service}.py plus the scenario engine / report generator merged in PR #6.
 *
 * These are the ONLY types that know the server's snake_case shapes. UI code uses the
 * types in ./api.ts; lib/mapping.ts converts between them.
 */

export type ServerPathwayKind = 'adapt' | 'transform' | 'discover';

export interface ServerErrorEnvelope {
  error: { code: string; message: string; details?: unknown; request_id?: string };
}

export interface ServerSourceSummary {
  key: string;
  organisation: string;
  title: string;
  url: string | null;
  publication_date: string | null;
  region: 'kenya' | 'africa' | 'global' | 'outside_africa' | string;
  is_african_evidence: boolean;
  evidence_category: string;
  source_type: string;
  confidence: 'high' | 'medium' | 'low' | string;
}

export interface ServerEvidenceReference extends ServerSourceSummary {
  relevance: string | null;
}

export interface ServerExposure {
  gradient: string;
  gradient_label: string;
  label?: string | null;
  ilo_mean_score: number | null;
  ilo_score_sd?: number | null;
  summary?: string | null;
  measures?: string;
}

/* ---------- Occupations ---------- */

export interface ServerOccupationListItem {
  slug: string;
  name: string;
  category: string;
  summary: string;
  isco_08_code: string;
  exposure: ServerExposure;
  task_count: number;
  pathway_kinds: ServerPathwayKind[];
  simulation_available: boolean;
}

export interface ServerOccupationList {
  content_version: string;
  occupations: ServerOccupationListItem[];
}

export interface ServerSkillSummary {
  slug: string;
  name: string;
  category: string;
}

export interface ServerTask {
  slug: string;
  title: string;
  isco_task_statement?: string | null;
  exposure: {
    level: 'very_low' | 'low' | 'medium' | 'high' | string;
    ilo_task_score: number | null;
    basis?: string | null;
  };
  likely_change: 'mostly_human' | 'augmentation' | 'partial_automation' | string;
  transformation_note: string | null;
  skills: ServerSkillSummary[];
  evidence: ServerEvidenceReference[];
}

export interface ServerOccupationDetail {
  content_version: string;
  occupation: {
    slug: string;
    name: string;
    category: string;
    summary: string;
    description?: string | null;
    responsibilities?: string[] | string | null;
    kenya_context?: string | null;
    limitations?: string[] | string | null;
    exposure: ServerExposure;
  };
  tasks: ServerTask[];
  skills: (ServerSkillSummary & { importance: string; description?: string | null })[];
  pathways: unknown[];
  evidence: ServerEvidenceReference[];
  workforce_events: ServerWorkforceEvent[];
  sources: ServerSourceSummary[];
  simulation: { available: boolean; scenario_count: number };
}

/* ---------- Workforce events ---------- */

export interface ServerWorkforceEvent {
  slug: string;
  title: string;
  event_date: string | null;
  event_type:
    'ai_deployment' | 'workforce_reduction' | 'skills_programme' | 'technology_adoption' | string;
  company: {
    slug: string;
    name: string;
    headquarters_country: string | null;
    sector: string | null;
  } | null;
  summary: string;
  reported_figures?: unknown;
  interpretation_note?: string | null;
  geographic_scope?: string | null;
  region: string;
  is_african_evidence: boolean;
  primary_source: ServerSourceSummary;
  occupations?: { slug: string; name: string }[];
}

export interface ServerWorkforceEventList {
  events: ServerWorkforceEvent[];
  count: number;
}

/* ---------- Sessions ---------- */

export interface ServerScenarioChoice {
  id: string;
  label: string;
  description?: string;
  /** Present with the real engine; the reference stand-in omits it. */
  pathway?: ServerPathwayKind | null;
}

export interface ServerScenario {
  id: string;
  key?: string | null;
  title: string;
  narrative: string;
  task?: { slug: string; title: string; exposure_level?: string } | null;
  step_number?: number;
  total_steps?: number;
  choices: ServerScenarioChoice[];
}

export interface ServerHistoryItem {
  step_index: number;
  scenario: { id: string; title: string };
  choice: { id: string; label: string };
  feedback: string | null;
  pathway_kind: ServerPathwayKind | null;
  chosen_at: string | null;
}

export interface ServerSession {
  status: 'active' | 'completed';
  occupation: { slug: string; name: string };
  content_version: string;
  engine?: unknown;
  step_count: number;
  current_scenario: ServerScenario | null;
  state?: unknown;
  history: ServerHistoryItem[];
  report_available: boolean;
  report_generated: boolean;
  created_at: string | null;
  expires_at: string | null;
  completed_at: string | null;
}

export interface ServerCreateSessionResponse {
  session_token: string;
  token_type: 'Bearer';
  expires_at: string;
  session: ServerSession;
}

export interface ServerSessionEnvelope {
  session: ServerSession;
}

export interface ServerSubmitChoiceResponse {
  accepted_choice: { id: string; label: string; step_index: number; feedback: string | null };
  completed: boolean;
  session: ServerSession;
}

/* ---------- Reports ---------- */

interface Because {
  rule: string;
  choices: string[];
}

/** Output of server/app/services/report_generator (the real engine), stored as `report.insights`. */
export interface ServerEngineReport {
  schema_version?: number;
  engine_version?: string;
  occupation?: { slug: string; name: string };
  choices?: {
    step_index: number;
    scenario_title: string;
    choice_label: string;
    feedback?: string | null;
  }[];
  pathway?: {
    kind: ServerPathwayKind;
    slug: string;
    title: string;
    summary: string;
    steps: string[];
    reason: string;
    because?: Because;
  };
  capabilities?: { tag: string; label: string; description: string; reason: string }[];
  trade_offs?: { tag: string; label: string; description: string; reason: string }[];
  suggestions?: {
    id: string;
    rule_id: string;
    category: string;
    title: string;
    description: string;
    reason: string;
    evidence_ids?: string[];
  }[];
  transferable_skills?: { slug: string; name: string; reason: string }[];
  research?: {
    id: string;
    statement: string;
    source: { title: string; publisher: string; year: number | null; url: string };
    reason: string;
  }[];
  other_pathways?: {
    kind: ServerPathwayKind;
    slug: string;
    title: string;
    summary: string;
    reason: string;
  }[];
  /* Reference stand-in engine fields (development only). */
  leading_pathway_kind?: ServerPathwayKind;
  recommended_pathways?: unknown[];
  strengths_developed?: string[];
}

export interface ServerReportSnapshot {
  schema_version: number;
  generated_at: string;
  content_version: string;
  engine?: unknown;
  occupation: {
    slug: string;
    name: string;
    category?: string;
    summary?: string;
    exposure?: ServerExposure;
  };
  journey: {
    step_index: number;
    scenario_title: string;
    task?: { slug: string; title: string } | null;
    choice_label: string;
    pathway_kind: ServerPathwayKind | null;
    feedback: string | null;
  }[];
  final_state?: unknown;
  insights: ServerEngineReport;
  pathways: {
    kind: ServerPathwayKind;
    slug: string;
    title: string;
    summary?: string;
    steps?: string[];
  }[];
  evidence: ServerEvidenceReference[];
  disclaimer: string;
}

export interface ServerReportResponse {
  created: boolean;
  report_id: string;
  created_at: string | null;
  share_token: string;
  share_path: string;
  report: ServerReportSnapshot;
}

export interface ServerSharedReport {
  report_id: string;
  created_at: string | null;
  content_version: string;
  integrity_sha256: string;
  report: ServerReportSnapshot;
}
