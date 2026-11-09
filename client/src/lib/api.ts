import type {
  ApiError,
  ApiErrorCode,
  CreateSessionRequest,
  CreateSessionResponse,
  ObservatoryResponse,
  OccupationListResponse,
  Report,
  Session,
  SubmitChoiceRequest,
  SubmitChoiceResponse,
  TaskBreakdown,
} from '../types/api';
import type {
  ServerCreateSessionResponse,
  ServerOccupationDetail,
  ServerOccupationList,
  ServerReportResponse,
  ServerSessionEnvelope,
  ServerSharedReport,
  ServerSubmitChoiceResponse,
  ServerWorkforceEventList,
} from '../types/server';
import { config } from './config';
import {
  mapErrorCode,
  mapOccupation,
  mapReport,
  mapSession,
  mapTaskBreakdown,
  mapWorkforceEvents,
} from './mapping';
import { sessionToken } from './sessionToken';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode | string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface TransportRequest {
  method: 'GET' | 'POST';
  path: string;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface TransportResponse {
  status: number;
  /** Parsed JSON body, or null when empty. */
  body: unknown;
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

const fetchTransport: Transport = async ({ method, path, headers, body, signal }) => {
  const res = await fetch(`${config.apiBaseUrl}${path}`, { method, headers, body, signal });
  const text = await res.text();
  if (!text) return { status: res.status, body: null };
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    if (res.ok) {
      throw new ApiRequestError(
        res.status,
        'INVALID_RESPONSE',
        'The server sent an unreadable response.',
      );
    }
    return { status: res.status, body: null };
  }
};

let transportPromise: Promise<Transport> | null = null;

/** Mocks are dynamically imported so they never ship in a real-API build. */
function getTransport(): Promise<Transport> {
  if (!transportPromise) {
    transportPromise = config.useMocks
      ? import('../mocks/mockTransport').then((m) => m.mockTransport)
      : Promise.resolve(fetchTransport);
  }
  return transportPromise;
}

/** Test seam: swap the transport (pass null to restore the default). */
export function setTransport(transport: Transport | null) {
  transportPromise = transport ? Promise.resolve(transport) : null;
}

function isErrorEnvelope(body: unknown): body is ApiError {
  if (!body || typeof body !== 'object' || !('error' in body)) return false;
  const err = (body as { error: unknown }).error;
  return (
    !!err &&
    typeof err === 'object' &&
    typeof (err as { code?: unknown }).code === 'string' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

function fallbackError(status: number): { code: ApiErrorCode; message: string } {
  if (status === 401) return { code: 'SESSION_EXPIRED', message: 'Your session has ended.' };
  if (status === 404) return { code: 'NOT_FOUND', message: 'We could not find that.' };
  if (status === 429)
    return { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment.' };
  if (status >= 500)
    return { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' };
  return { code: 'UNKNOWN', message: 'Something unexpected happened.' };
}

/** The journey can't continue: expired, unknown token, or started under a different engine. */
export function isSessionGone(err: unknown): err is ApiRequestError {
  return (
    err instanceof ApiRequestError &&
    (err.code === 'SESSION_EXPIRED' ||
      err.code === 'SESSION_NOT_FOUND' ||
      err.code === 'SESSION_ENGINE_MISMATCH' ||
      err.status === 401)
  );
}

export function isStaleStep(err: unknown): err is ApiRequestError {
  return err instanceof ApiRequestError && err.code === 'STALE_STEP';
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, signal } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = sessionToken.get();
    if (!token) throw new ApiRequestError(401, 'SESSION_NOT_FOUND', 'There is no active journey.');
    headers.Authorization = `Bearer ${token}`;
  }

  const transport = await getTransport();
  let res: TransportResponse;
  try {
    res = await transport({
      method,
      path,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      "We couldn't reach FUTUREPRINT. The service may be waking up — please try again.",
    );
  }

  if (res.status >= 200 && res.status < 300) return res.body as T;

  const parsed = isErrorEnvelope(res.body) ? res.body.error : fallbackError(res.status);
  const error = new ApiRequestError(
    res.status,
    isErrorEnvelope(res.body) ? mapErrorCode(parsed.code) : parsed.code,
    parsed.message,
    'details' in parsed ? parsed.details : undefined,
  );
  if (auth && isSessionGone(error)) {
    sessionToken.clear(error.code === 'SESSION_NOT_FOUND' ? null : 'expired');
  }
  throw error;
}

/**
 * Typed API surface. Each call speaks the Flask API's wire format (types/server.ts) and
 * returns UI types (types/api.ts) via lib/mapping.ts. Contract: server/README.md.
 */
export const api = {
  listOccupations: async (signal?: AbortSignal): Promise<OccupationListResponse> => {
    const res = await request<ServerOccupationList>('/api/v1/occupations', { signal });
    return { items: res.occupations.map(mapOccupation) };
  },

  createSession: async (body: CreateSessionRequest): Promise<CreateSessionResponse> => {
    const res = await request<ServerCreateSessionResponse>('/api/v1/sessions', {
      method: 'POST',
      body: { occupation_slug: body.occupationId },
    });
    return { token: res.session_token, session: mapSession(res.session) };
  },

  getCurrentSession: async (signal?: AbortSignal): Promise<Session> => {
    const res = await request<ServerSessionEnvelope>('/api/v1/sessions/current', {
      auth: true,
      signal,
    });
    return mapSession(res.session);
  },

  /** Sends only `choice_id`: the server decides which scenario and step it belongs to. */
  submitChoice: async (body: SubmitChoiceRequest): Promise<SubmitChoiceResponse> => {
    const res = await request<ServerSubmitChoiceResponse>('/api/v1/sessions/current/choices', {
      method: 'POST',
      body: { choice_id: body.optionId },
      auth: true,
    });
    return { session: mapSession(res.session), feedback: res.accepted_choice.feedback };
  },

  /** Idempotent on the server: repeat calls return the same report and share token. */
  createReport: async (): Promise<Report> => {
    const res = await request<ServerReportResponse>('/api/v1/sessions/current/report', {
      method: 'POST',
      auth: true,
    });
    return mapReport(res.report, {
      reportId: res.report_id,
      shareToken: res.share_token,
      createdAt: res.created_at,
    });
  },

  getSharedReport: async (shareToken: string, signal?: AbortSignal): Promise<Report> => {
    const res = await request<ServerSharedReport>(
      `/api/v1/reports/${encodeURIComponent(shareToken)}`,
      { signal },
    );
    return mapReport(res.report, {
      reportId: res.report_id,
      shareToken,
      createdAt: res.created_at,
    });
  },

  listWorkforceEvents: async (signal?: AbortSignal): Promise<ObservatoryResponse> => {
    const res = await request<ServerWorkforceEventList>('/api/v1/workforce-events', { signal });
    return mapWorkforceEvents(res.events);
  },

  /** Tasks come with the occupation detail (`GET /occupations/{slug}`). */
  getOccupationTasks: async (slug: string, signal?: AbortSignal): Promise<TaskBreakdown> => {
    const res = await request<ServerOccupationDetail>(
      `/api/v1/occupations/${encodeURIComponent(slug)}`,
      { signal },
    );
    return mapTaskBreakdown(res);
  },
};
