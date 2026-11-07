import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { useCurrentSession, useResetJourney } from '../../hooks/useSession';
import { isSessionGone } from '../../lib/api';
import { useSessionToken } from '../../lib/sessionToken';
import { ScenarioView } from './ScenarioView';

export default function SimulatorPage() {
  const { token, endReason } = useSessionToken();
  const session = useCurrentSession();
  const reset = useResetJourney();
  const [notice, setNotice] = useState<string | null>(null);

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
      <ScenarioView
        key={data.currentScenario.id}
        session={data}
        scenario={data.currentScenario}
        notice={notice}
        setNotice={setNotice}
      />
    </Page>
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
