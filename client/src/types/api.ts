/**
 * UI domain types. Components use only these.
 *
 * The contract is the Flask API documented in server/README.md. Its wire shapes live in
 * ./server.ts and are converted to these types in lib/mapping.ts, the single place that
 * knows about snake_case, envelopes and server error codes.
 */

export type PathwayId = 'adapt' | 'transform' | 'discover';

export interface Occupation {
  /** The server's slug. */
  id: string;
  title: string;
  summary: string;
  sector?: string;
  /** False when the server has no scenarios for this occupation yet. */
  simulationAvailable?: boolean;
}

export interface OccupationListResponse {
  items: Occupation[];
}

export interface ChoiceOption {
  id: string;
  label: string;
  description: string;
  /** Leading pathway for this option, or null when the engine doesn't expose one. */
  pathway: PathwayId | null;
}

export interface Scenario {
  id: string;
  /** 1-based step this scenario belongs to. */
  step: number;
  title: string;
  prompt: string;
  /** The real work task this scenario is about, when the server provides it. */
  context?: string;
  options: ChoiceOption[];
}

/** A decision the visitor already made, as recorded by the server. */
export interface Choice {
  step: number;
  scenarioId: string;
  scenarioTitle: string;
  optionId: string;
  optionLabel: string;
  pathway: PathwayId | null;
  feedback?: string | null;
}

export type SessionStatus = 'in_progress' | 'completed';

export interface Session {
  status: SessionStatus;
  occupation: Occupation;
  /** 1-based step the visitor is currently on. */
  currentStep: number;
  /** Server's longest-route estimate; can change as the scenario graph branches. */
  totalSteps: number;
  /** null once the session is completed. */
  currentScenario: Scenario | null;
  choices: Choice[];
  expiresAt: string | null;
  reportGenerated: boolean;
}

export interface CreateSessionRequest {
  occupationId: string;
}

export interface CreateSessionResponse {
  /** Opaque bearer credential. Never log it or put it in a URL. */
  token: string;
  session: Session;
}

export interface SubmitChoiceRequest {
  optionId: string;
}

export interface SubmitChoiceResponse {
  session: Session;
  /** Server feedback on the accepted choice. */
  feedback: string | null;
}

export interface Source {
  id?: string;
  title: string;
  publisher: string;
  year?: number | null;
  url: string;
  /** e.g. "Kenya", "Africa", "Outside Africa". Used to label evidence from outside Africa. */
  region?: string;
}

export interface ResearchFinding {
  id: string;
  statement: string;
  source: Source;
  reason?: string;
}

export interface Suggestion {
  id: string;
  category: string;
  title: string;
  description: string;
  /** Why FUTUREPRINT suggests this. Always shown to the visitor. */
  reason: string;
}

export interface ReasonedItem {
  title: string;
  description?: string;
  reason: string;
}

export interface Report {
  reportId: string;
  generatedAt: string;
  shareToken: string | null;
  occupation: Occupation & { exposureLabel?: string };
  choices: Choice[];
  pathway: {
    id: PathwayId;
    title: string;
    summary: string;
    reason: string;
    steps: string[];
  };
  capabilities: ReasonedItem[];
  tradeOffs: ReasonedItem[];
  transferableSkills: ReasonedItem[];
  otherPathways: (ReasonedItem & { id: PathwayId })[];
  research: {
    findings: ResearchFinding[];
    limitations: string[];
  };
  suggestions: Suggestion[];
  /** Mandatory server disclaimer. Always displayed. */
  disclaimer: string;
}

/* ---------- Research interfaces ---------- */

export interface WorkforceEvent {
  id: string;
  date: string | null;
  title: string;
  summary: string;
  industry: string;
  organisation?: string;
  eventTypeLabel: string;
  /** e.g. "High confidence · Kenya". */
  evidenceLabel: string;
  interpretationNote?: string | null;
  source: Source;
}

export interface ObservatoryResponse {
  items: WorkforceEvent[];
  industries: string[];
}

export type TaskExposureLevel = 'very_low' | 'low' | 'medium' | 'high';
export type LikelyChange = 'mostly_human' | 'augmentation' | 'partial_automation';

export interface OccupationTask {
  id: string;
  name: string;
  exposureLevel: TaskExposureLevel | string;
  likelyChange: LikelyChange | string;
  explanation: string;
  skills: string[];
  sources: Source[];
}

export interface TaskBreakdown {
  occupation: Occupation & {
    exposureLabel?: string;
    exposureSummary?: string | null;
    exposureMeasures?: string;
    kenyaContext?: string | null;
  };
  tasks: OccupationTask[];
  limitations: string[];
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'SESSION_COMPLETED'
  | 'SESSION_INCOMPLETE'
  | 'SESSION_ENGINE_MISMATCH'
  | 'STALE_STEP'
  | 'CHOICE_REJECTED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  // Client-side only codes:
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

/** Error envelope shape (server codes are lower_snake; see lib/mapping.ts). */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id?: string;
  };
}
