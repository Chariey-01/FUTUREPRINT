import type { Transport } from '../lib/api';
import { fail, mockControl, mockServer, type MockResult } from './mockServer';
import { SAMPLE_EVENTS, sampleTaskBreakdown } from './researchData';

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** Routes requests to the in-browser mock server, mimicking real HTTP semantics. */
export const mockTransport: Transport = async ({ method, path, headers, body, signal }) => {
  await delay(mockControl.latency(), signal);
  const parsed = body ? JSON.parse(body) : null;
  const pathname = new URL(path, 'http://mock.local').pathname;

  let result: MockResult;
  switch (`${method} ${pathname}`) {
    case 'GET /api/v1/occupations':
      result = mockServer.listOccupations();
      break;
    case 'POST /api/v1/sessions':
      result = mockServer.createSession(parsed);
      break;
    case 'GET /api/v1/sessions/current':
      result = mockServer.getCurrentSession(headers);
      break;
    case 'POST /api/v1/sessions/current/choices':
      result = mockServer.submitChoice(headers, parsed);
      break;
    case 'POST /api/v1/sessions/current/report':
      result = mockServer.createReport(headers);
      break;
    case 'GET /api/v1/observatory/events':
      result = {
        status: 200,
        body: {
          items: [...SAMPLE_EVENTS].sort((a, b) => b.date.localeCompare(a.date)),
          industries: [...new Set(SAMPLE_EVENTS.map((e) => e.industry))].sort(),
        },
      };
      break;
    default: {
      const tasks = method === 'GET' && pathname.match(/^\/api\/v1\/occupations\/([^/]+)\/tasks$/);
      const breakdown = tasks ? sampleTaskBreakdown(decodeURIComponent(tasks[1]!)) : null;
      result = breakdown
        ? { status: 200, body: breakdown }
        : fail(
            404,
            'NOT_FOUND',
            tasks ? 'We couldn’t find that occupation.' : `No mock route for ${method} ${pathname}`,
          );
    }
  }
  // Deep-copy so callers can't mutate mock state, like a real network boundary.
  return { status: result.status, body: JSON.parse(JSON.stringify(result.body)) };
};
