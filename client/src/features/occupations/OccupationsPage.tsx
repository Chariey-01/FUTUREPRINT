import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { OccupationCard } from '../../components/OccupationCard';
import { useCreateSession } from '../../hooks/useSession';
import { useSessionToken } from '../../lib/sessionToken';
import type { Occupation } from '../../types/api';
import { useOccupations } from './useOccupations';

export default function OccupationsPage() {
  const navigate = useNavigate();
  const occupations = useOccupations();
  const create = useCreateSession();
  const { token } = useSessionToken();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const select = (occ: Occupation) => {
    if (create.isPending) return;
    setPendingId(occ.id);
    create.mutate(
      { occupationId: occ.id },
      {
        onSuccess: () => navigate('/simulate'),
        onSettled: () => setPendingId(null),
      },
    );
  };

  return (
    <div className="container-page pb-24 pt-6 sm:pt-10">
      <div className="max-w-2xl">
        <p className="eyebrow text-transform-ink">Step one · Choose a starting point</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
          Which work would you like to explore?
        </h1>
        <p className="mt-4 text-lg text-midnight/80">
          Pick an occupation — yours, one you’re curious about, or one you’re heading toward. You’ll
          then make three decisions about how its future could unfold.
        </p>
      </div>

      {token && (
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-adapt-ink/25 bg-adapt-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p>You have a journey in progress in this tab.</p>
          <Link to="/simulate" className="btn-primary">
            Resume my journey
          </Link>
        </div>
      )}

      {create.isError && (
        <div className="mt-8">
          <ErrorState title="We couldn’t start your journey" message={create.error.message} />
        </div>
      )}

      <section aria-label="Occupations" className="mt-10">
        {occupations.isPending ? (
          <LoadingState label="Gathering occupations" />
        ) : occupations.isError ? (
          <ErrorState
            title="We couldn’t load occupations"
            message={occupations.error.message}
            onRetry={() => void occupations.refetch()}
          />
        ) : occupations.data.length === 0 ? (
          <EmptyState
            title="No occupations yet"
            message="The exhibition is still being curated. Please check back soon."
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {occupations.data.map((occ, i) => (
              <OccupationCard
                key={occ.id}
                occupation={occ}
                index={i}
                pending={pendingId === occ.id}
                disabled={create.isPending}
                onSelect={select}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
