import { useSyncExternalStore } from 'react';

/**
 * Session token store.
 *
 * Per the PRD's MVP approach the token lives in sessionStorage (scoped to this tab,
 * survives refresh, gone when the tab closes). Treat it as a credential: it is only
 * ever read here and by the API client — never logged, never put in a URL.
 */

const KEY = 'futureprint.sessionToken';

export type SessionEndReason = 'expired' | null;

interface Snapshot {
  token: string | null;
  endReason: SessionEndReason;
}

const listeners = new Set<() => void>();

function readToken(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let snapshot: Snapshot = { token: readToken(), endReason: null };

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

export const sessionToken = {
  get(): string | null {
    return snapshot.token;
  },
  set(token: string) {
    try {
      window.sessionStorage.setItem(KEY, token);
    } catch {
      // Storage unavailable (private mode etc.): keep the token in memory only.
    }
    emit({ token, endReason: null });
  },
  clear(reason: SessionEndReason = null) {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    emit({ token: null, endReason: reason });
  },
  /** Re-read storage. Used by tests to simulate a page refresh. */
  reload() {
    emit({ token: readToken(), endReason: null });
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot(): Snapshot {
    return snapshot;
  },
};

export function useSessionToken(): Snapshot {
  return useSyncExternalStore(sessionToken.subscribe, sessionToken.snapshot, sessionToken.snapshot);
}
