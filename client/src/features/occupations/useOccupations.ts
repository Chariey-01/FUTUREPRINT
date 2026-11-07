import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../hooks/useSession';

export function useOccupations() {
  return useQuery({
    queryKey: queryKeys.occupations,
    queryFn: ({ signal }) => api.listOccupations(signal),
    select: (res) => res.items,
    staleTime: 5 * 60 * 1000,
  });
}
