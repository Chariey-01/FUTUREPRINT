/**
 * FUTUREPRINT API types.
 *
 * ⚠️ PROVISIONAL CONTRACT — not yet agreed with Persons 2 (backend), 3 (research) and
 * 5 (recommendations). See docs/api-contract-provisional.md. When the frozen contract
 * lands, update this file first; the UI consumes only these types.
 */

export type PathwayId = 'adapt' | 'transform' | 'discover';

export interface Occupation {
  id: string;
  title: string;
  summary: string;
  sector?: string;
}

export interface OccupationListResponse {
  items: Occupation[];
}

export interface ChoiceOption {
  id: string;
  label: string;
  description: string;
  pathway: PathwayId;
}

export interface Scenario {
  id: string;
  /** 1-based step this scenario belongs to. */
  step: number;
  title: string;
  prompt: string;
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
  pathway: PathwayId;
}

export type SessionStatus = 'in_progress' | 'completed';

export interface Session {
  id: string;
  status: SessionStatus;
  occupation: Occupation;
  /** 1-based step the visitor is currently on. Equals totalSteps + 1 once completed. */
  currentStep: number;
  totalSteps: number;
  /** null once the session is completed. */
  currentScenario: Scenario | null;
  choices: Choice[];
  expiresAt: string;
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
  scenarioId: string;
  optionId: string;
  /** The step the client believes it is answering; the server rejects mismatches (STALE_STEP). */
  step: number;
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  year?: number;
  url: string;
}

export interface ResearchFinding {
  id: string;
  statement: string;
  source: Source;
}

export type SuggestionCategory =
  'skill' | 'transferable_capability' | 'career_direction' | 'learning_activity' | 'next_step';

export interface Suggestion {
  id: string;
  category: SuggestionCategory;
  title: string;
  description: string;
  /** Why FUTUREPRINT suggests this. Always shown to the visitor. */
  reason: string;
}

export interface Report {
  sessionId: string;
  generatedAt: string;
  occupation: Occupation;
  choices: Choice[];
  pathway: {
    id: PathwayId;
    summary: string;
  };
  research: {
    findings: ResearchFinding[];
    limitations: string[];
  };
  suggestions: Suggestion[];
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'SESSION_COMPLETED'
  | 'SESSION_INCOMPLETE'
  | 'STALE_STEP'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  // Client-side only codes:
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

/** Error envelope returned by every non-2xx response. */
export interface ApiError {
  error: {
    code: ApiErrorCode | string;
    message: string;
    details?: unknown;
  };
}
