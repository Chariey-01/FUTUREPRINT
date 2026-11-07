import type {
  ApiError,
  ApiErrorCode,
  CreateSessionRequest,
  CreateSessionResponse,
  ObservatoryResponse,
  OccupationListResponse,
  TaskBreakdown,
  Report,
  Session,
  SubmitChoiceRequest,
} from '../types/api';
import { config } from './config';
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

export function isSessionGone(err: unknown): err is ApiRequestError {
  return (
    err instanceof ApiRequestError &&
    (err.code === 'SESSION_EXPIRED' || err.code === 'SESSION_NOT_FOUND' || err.status === 401)
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
    parsed.code,
    parsed.message,
    'details' in parsed ? parsed.details : undefined,
  );
  if (auth && isSessionGone(error)) {
    sessionToken.clear(error.code === 'SESSION_EXPIRED' ? 'expired' : null);
  }
  throw error;
}

export const api = {
  listOccupations: (signal?: AbortSignal) =>
    request<OccupationListResponse>('/api/v1/occupations', { signal }),
  createSession: (body: CreateSessionRequest) =>
    request<CreateSessionResponse>('/api/v1/sessions', { method: 'POST', body }),
  getCurrentSession: (signal?: AbortSignal) =>
    request<Session>('/api/v1/sessions/current', { auth: true, signal }),
  submitChoice: (body: SubmitChoiceRequest) =>
    request<Session>('/api/v1/sessions/current/choices', { method: 'POST', body, auth: true }),
  createReport: () =>
    request<Report>('/api/v1/sessions/current/report', { method: 'POST', auth: true }),
  // Provisional research endpoints (see docs/api-contract-provisional.md).
  listWorkforceEvents: (signal?: AbortSignal) =>
    request<ObservatoryResponse>('/api/v1/observatory/events', { signal }),
  getOccupationTasks: (occupationId: string, signal?: AbortSignal) =>
    request<TaskBreakdown>(`/api/v1/occupations/${encodeURIComponent(occupationId)}/tasks`, {
      signal,
    }),
};
