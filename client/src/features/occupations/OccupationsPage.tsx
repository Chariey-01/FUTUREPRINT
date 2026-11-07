import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { OccupationCard } from '../../components/OccupationCard';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { useCreateSession } from '../../hooks/useSession';
import { useSessionToken } from '../../lib/sessionToken';
import type { Occupation } from '../../types/api';
import { useOccupations } from './useOccupations';

const normalise = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

export default function OccupationsPage() {
  const navigate = useNavigate();
  const occupations = useOccupations();
  const create = useCreateSession();
  const { token } = useSessionToken();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Presentation-only filtering of the list the server returned.
  const visible = useMemo(() => {
    const q = normalise(query.trim());
    if (!occupations.data || !q) return occupations.data ?? [];
    return occupations.data.filter((o) =>
      normalise(`${o.title} ${o.summary} ${o.sector ?? ''}`).includes(q),
    );
  }, [occupations.data, query]);

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
      <PageHeader
        eyebrow="Step one · Choose your path"
        title="Which future would you like to explore?"
        intro="Pick an occupation — yours, one you’re curious about, or one you’re heading toward. Then make three decisions about how its future could unfold."
      />
      <p className="mt-4 text-sm text-midnight/80">
        Not sure where to start?{' '}
        <Link
          to="/observatory"
          className="font-semibold text-midnight underline underline-offset-4"
        >
          Browse the Workforce Observatory
        </Link>
      </p>

      {token && (
        <div className="mt-8 flex flex-col gap-3 rounded-3xl border border-adapt-ink/25 bg-adapt-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p>You have a journey in progress in this tab.</p>
          <ButtonLink to="/simulate">Resume my journey</ButtonLink>
        </div>
      )}

      {create.isError && (
        <div className="mt-8">
          <ErrorState title="We couldn’t start your journey" message={create.error.message} />
        </div>
      )}

      <section aria-labelledby="occupations-heading" className="mt-10 sm:mt-14">
        <h2 id="occupations-heading" className="sr-only">
          Occupations
        </h2>
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
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput
                label="Search occupations"
                value={query}
                onChange={setQuery}
                placeholder="Search by title, field or keyword"
              />
              <p className="text-sm text-midnight/80" role="status" aria-live="polite">
                {visible.length === occupations.data.length
                  ? `${visible.length} occupations to explore`
                  : `${visible.length} of ${occupations.data.length} occupations match “${query.trim()}”`}
              </p>
            </div>

            {visible.length === 0 ? (
              <div className="mt-8">
                <EmptyState
                  title="No doors match that search"
                  message="Try a broader word, like a field (“health”) or a type of work (“design”)."
                  action={
                    <Button variant="secondary" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="mt-8 grid gap-5 md:grid-cols-2">
                {visible.map((occ, i) => (
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
          </>
        )}
      </section>
    </div>
  );
}
