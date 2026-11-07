import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useSessionToken } from '../../lib/sessionToken';
import { queryKeys } from '../../hooks/useSession';

/**
 * The report endpoint is a POST (the server generates it), but it is safe to treat as a
 * cached read for the current session: generated once, then reused.
 */
export function useReport() {
  const { token } = useSessionToken();
  return useQuery({
    queryKey: queryKeys.report,
    queryFn: () => api.createReport(),
    enabled: !!token,
    staleTime: Infinity,
  });
}
