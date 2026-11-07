import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        // Retry only transient failures (network / 5xx) — e.g. a backend cold start.
        retry: (count, err) =>
          count < 2 && (!(err instanceof ApiRequestError) || err.status === 0 || err.status >= 500),
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      },
      mutations: { retry: false },
    },
  });
}
