import { AnimatePresence, m } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { useCurrentSession, useResetJourney } from '../../hooks/useSession';
import { isSessionGone } from '../../lib/api';
import { useSessionToken } from '../../lib/sessionToken';
import { ScenarioView, type SimulatorMessage } from './ScenarioView';
import { StoryRail } from './StoryRail';

export default function SimulatorPage() {
  const { token, endReason } = useSessionToken();
  const session = useCurrentSession();
  const reset = useResetJourney();
  const [message, setMessage] = useState<SimulatorMessage>(null);

  if (!token) {
    return (
      <Page>
        {endReason === 'expired' ? (
          <ExpiredState />
        ) : (
          <EmptyState
            title="Your journey hasn’t started yet"
            message="Choose an occupation to begin exploring its possible futures."
            action={
              <Link to="/start" className="btn-primary">
                Choose an occupation
              </Link>
            }
          />
        )}
      </Page>
    );
  }

  if (session.isPending) {
    return (
      <Page>
        <LoadingState label="Restoring your journey" />
      </Page>
    );
  }

  if (session.isError) {
    return (
      <Page>
        {isSessionGone(session.error) ? (
          <ExpiredState />
        ) : (
          <ErrorState
            title="We couldn’t load your journey"
            message={session.error.message}
            onRetry={() => void session.refetch()}
          />
        )}
      </Page>
    );
  }

  const data = session.data;
  if (data.status === 'completed' || !data.currentScenario) {
    return (
      <Page>
        <EmptyState
          title="Your Futureprint is ready"
          message={`You’ve made all ${data.totalSteps} decisions for ${data.occupation.title}.`}
          action={
            <>
              <Link to="/report" className="btn-primary">
                View my Futureprint
              </Link>
              <Link to="/start" onClick={reset} className="btn-ghost">
                Start a new journey
              </Link>
            </>
          }
        />
      </Page>
    );
  }

  return (
    <Page>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-12">
        <StoryRail session={data} />
        <div className="min-w-0">
          <MessageBanner message={message} />
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={data.currentScenario.id}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <ScenarioView
                session={data}
                scenario={data.currentScenario}
                setMessage={setMessage}
              />
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </Page>
  );
}

/** Feedback after each decision (polite) and problems such as stale steps (assertive). */
function MessageBanner({ message }: { message: SimulatorMessage }) {
  return (
    <>
      <div role="status" aria-live="polite">
        {message?.kind === 'saved' && (
          <m.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-discover-soft px-4 py-2 text-sm font-semibold text-discover-ink"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
              <path
                d="M3.5 8.5l3 3 6-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {message.text}
          </m.p>
        )}
      </div>
      {message?.kind === 'problem' && (
        <p
          role="alert"
          className="mb-6 rounded-2xl border border-transform-ink/30 bg-transform-soft px-4 py-3 text-midnight"
        >
          {message.text}
        </p>
      )}
    </>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="container-page pb-24 pt-4 sm:pt-8">{children}</div>;
}

function ExpiredState() {
  return (
    <EmptyState
      title="Your journey has expired"
      message="Journeys are kept for a limited time and nothing personal is stored. Start a fresh one whenever you like."
      action={
        <Link to="/start" className="btn-primary">
          Start a new journey
        </Link>
      }
    />
  );
}
