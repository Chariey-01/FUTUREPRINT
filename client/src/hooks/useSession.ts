import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isSessionGone, isStaleStep } from '../lib/api';
import { sessionToken, useSessionToken } from '../lib/sessionToken';
import type { CreateSessionRequest, Session, SubmitChoiceRequest } from '../types/api';

export const queryKeys = {
  occupations: ['occupations'] as const,
  session: ['session', 'current'] as const,
  report: ['report', 'current'] as const,
};

export function useCurrentSession() {
  const { token } = useSessionToken();
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: ({ signal }) => api.getCurrentSession(signal),
    enabled: !!token,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSessionRequest) => api.createSession(body),
    onSuccess: ({ token, session }) => {
      qc.removeQueries({ queryKey: queryKeys.report });
      qc.setQueryData<Session>(queryKeys.session, session);
      sessionToken.set(token);
    },
  });
}

export function useSubmitChoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitChoiceRequest) => api.submitChoice(body),
    onSuccess: (session) => {
      qc.setQueryData<Session>(queryKeys.session, session);
    },
    onError: (err) => {
      // Server is authoritative: on a stale step, re-sync with whatever it says is current.
      if (isStaleStep(err)) void qc.invalidateQueries({ queryKey: queryKeys.session });
      if (isSessionGone(err)) qc.removeQueries({ queryKey: queryKeys.session });
    },
  });
}

/** Ends the current journey locally so the visitor can start over. */
export function useResetJourney() {
  const qc = useQueryClient();
  return () => {
    sessionToken.clear();
    qc.removeQueries({ queryKey: queryKeys.session });
    qc.removeQueries({ queryKey: queryKeys.report });
  };
}
