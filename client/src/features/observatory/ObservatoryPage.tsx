import { useQuery } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { SourceLink } from '../../components/SourceLink';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { api } from '../../lib/api';
import { config } from '../../lib/config';
import { EVENT_TYPE_LABELS, EVIDENCE_LABELS } from '../../lib/evidence';
import type { WorkforceEvent } from '../../types/api';

const ALL = 'All industries';

function formatDate(date: string) {
  const d = new Date(date.length === 7 ? `${date}-01` : date);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function ObservatoryPage() {
  const events = useQuery({
    queryKey: ['observatory', 'events'],
    queryFn: ({ signal }) => api.listWorkforceEvents(signal),
    staleTime: 5 * 60 * 1000,
  });
  const [industry, setIndustry] = useState(ALL);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (events.data?.items ?? []).filter(
      (e) =>
        (industry === ALL || e.industry === industry) &&
        (!q || `${e.title} ${e.summary} ${e.organisation ?? ''}`.toLowerCase().includes(q)),
    );
  }, [events.data, industry, query]);

  const byYear = useMemo(() => {
    const groups = new Map<string, WorkforceEvent[]>();
    visible.forEach((e) => {
      const year = e.date.slice(0, 4);
      groups.set(year, [...(groups.get(year) ?? []), e]);
    });
    return [...groups.entries()];
  }, [visible]);

  return (
    <div className="container-page pb-24 pt-6 sm:pt-10">
      <PageHeader
        eyebrow="Workforce Observatory"
        eyebrowClass="text-adapt-ink"
        title="How work is changing, event by event"
        intro="A timeline of documented changes across industries — each event linked to its source and labelled with the strength of its evidence."
      />
      {config.useMocks && (
        <p className="mt-6">
          <Badge tone="sample">
            Sample events · placeholders until the research team’s data arrives
          </Badge>
        </p>
      )}

      <section aria-labelledby="timeline-heading" className="mt-10">
        <h2 id="timeline-heading" className="sr-only">
          Timeline
        </h2>
        {events.isPending ? (
          <LoadingState label="Opening the observatory" />
        ) : events.isError ? (
          <ErrorState
            title="We couldn’t load the observatory"
            message={events.error.message}
            onRetry={() => void events.refetch()}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:gap-12">
            {/* FilterPanel */}
            <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
              <SearchInput
                label="Search events"
                value={query}
                onChange={setQuery}
                placeholder="Search events"
              />
              <fieldset>
                <legend className="text-sm font-semibold">Industry</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[ALL, ...events.data.industries].map((ind) => (
                    <button
                      key={ind}
                      type="button"
                      aria-pressed={industry === ind}
                      onClick={() => setIndustry(ind)}
                      className={`min-h-[40px] rounded-full border px-4 text-sm font-medium transition-colors ${
                        industry === ind
                          ? 'border-midnight bg-midnight text-ivory-50'
                          : 'border-midnight/20 bg-ivory-50 hover:bg-midnight/5'
                      }`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="text-sm text-midnight/80" aria-live="polite">
                {visible.length} {visible.length === 1 ? 'event' : 'events'} shown
              </p>
            </div>

            <div>
              {visible.length === 0 ? (
                <EmptyState
                  title="No events match"
                  message="Try another industry or a broader search."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setIndustry(ALL);
                        setQuery('');
                      }}
                    >
                      Reset filters
                    </Button>
                  }
                />
              ) : (
                byYear.map(([year, items]) => (
                  <div key={year} className="mb-10 last:mb-0">
                    <h3 className="font-display text-4xl font-bold text-adapt-ink">{year}</h3>
                    <ol className="relative mt-4 space-y-5 border-l-2 border-dashed border-midnight/15 pl-6 sm:pl-8">
                      {items.map((e, i) => (
                        <EventCard key={e.id} event={e} index={i} />
                      ))}
                    </ol>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      <div className="mt-16 flex flex-wrap gap-3">
        <ButtonLink to="/methodology" variant="secondary">
          How we classify evidence
        </ButtonLink>
        <ButtonLink to="/start" variant="accent">
          Explore a future <span aria-hidden="true">→</span>
        </ButtonLink>
      </div>
    </div>
  );
}

function EventCard({ event, index }: { event: WorkforceEvent; index: number }) {
  const evidence = EVIDENCE_LABELS[event.evidenceLevel];
  return (
    <m.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.05 }}
      className="relative rounded-3xl bg-ivory-50 p-5 shadow-card sm:p-6"
    >
      <span
        aria-hidden="true"
        className="absolute -left-[33px] top-7 h-3 w-3 rounded-full bg-adapt ring-4 ring-ivory-100 sm:-left-[41px]"
      />
      <p className="text-sm font-semibold text-midnight/80">
        <time dateTime={event.date}>{formatDate(event.date)}</time>
        {event.organisation && <> · {event.organisation}</>}
      </p>
      <h4 className="mt-2 font-display text-xl font-bold leading-snug sm:text-2xl">
        {event.title}
      </h4>
      <p className="mt-2 text-midnight/80">{event.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>{event.industry}</Badge>
        <Badge tone="adapt">{EVENT_TYPE_LABELS[event.eventType]}</Badge>
        <Badge tone="discover">
          <span>Evidence: {evidence.label}</span>
        </Badge>
      </div>
      <p className="mt-4">
        <SourceLink source={event.source} />
      </p>
    </m.li>
  );
}
