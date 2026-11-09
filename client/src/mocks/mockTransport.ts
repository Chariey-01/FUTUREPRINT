import type { Transport } from '../lib/api';
import { fail, mockControl, mockServer, type MockResult } from './mockServer';

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

const OCCUPATION = /^\/api\/v1\/occupations\/([^/]+)$/;
const SHARED_REPORT = /^\/api\/v1\/reports\/([^/]+)$/;

/** Routes requests to the in-browser mock of the Flask API, mimicking real HTTP semantics. */
export const mockTransport: Transport = async ({ method, path, headers, body, signal }) => {
  await delay(mockControl.latency(), signal);
  let parsed: unknown = null;
  if (body) {
    try {
      parsed = JSON.parse(body);
    } catch {
      return { status: 400, body: { error: { code: 'bad_request', message: 'Invalid JSON.' } } };
    }
  }
  const pathname = new URL(path, 'http://mock.local').pathname;
  const route = `${method} ${pathname}`;
  const param = (re: RegExp) => decodeURIComponent(pathname.match(re)?.[1] ?? '');

  let result: MockResult;
  if (route === 'GET /api/v1/occupations') result = mockServer.listOccupations();
  else if (method === 'GET' && OCCUPATION.test(pathname))
    result = mockServer.getOccupation(param(OCCUPATION));
  else if (route === 'GET /api/v1/workforce-events') result = mockServer.listWorkforceEvents();
  else if (route === 'POST /api/v1/sessions') result = mockServer.createSession(parsed);
  else if (route === 'GET /api/v1/sessions/current') result = mockServer.getCurrentSession(headers);
  else if (route === 'POST /api/v1/sessions/current/choices')
    result = mockServer.submitChoice(headers, parsed);
  else if (route === 'POST /api/v1/sessions/current/report')
    result = mockServer.createReport(headers, parsed);
  else if (method === 'GET' && SHARED_REPORT.test(pathname))
    result = mockServer.getSharedReport(param(SHARED_REPORT));
  else result = fail(404, 'not_found', `No mock route for ${method} ${pathname}`);

  // Deep-copy so callers can't mutate mock state, like a real network boundary.
  return { status: result.status, body: JSON.parse(JSON.stringify(result.body)) };
};
