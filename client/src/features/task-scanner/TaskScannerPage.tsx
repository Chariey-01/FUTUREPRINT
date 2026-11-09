import { useQuery } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState, Spinner } from '../../components/LoadingState';
import { SourceLink } from '../../components/SourceLink';
import { Badge, SkillTag } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { useCreateSession } from '../../hooks/useSession';
import { ApiRequestError, api } from '../../lib/api';
import { config } from '../../lib/config';
import {
  LIKELY_CHANGE,
  LIKELY_CHANGE_ORDER,
  exposureLabel,
  likelyChange,
} from '../../lib/evidence';
import type { OccupationTask } from '../../types/api';

/** Task Scanner: GET /api/v1/occupations/{slug} — tasks, exposure and evidence. */
export default function TaskScannerPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const create = useCreateSession();
  const breakdown = useQuery({
    queryKey: ['tasks', slug],
    queryFn: ({ signal }) => api.getOccupationTasks(slug, signal),
    enabled: !!slug,
  });

  if (breakdown.isPending) {
    return (
      <Page>
        <LoadingState label="Scanning tasks" />
      </Page>
    );
  }
  if (breakdown.isError) {
    const notFound = breakdown.error instanceof ApiRequestError && breakdown.error.status === 404;
    return (
      <Page>
        {notFound ? (
          <EmptyState
            title="We couldn’t find that occupation"
            message="It may have been renamed. Choose from the full list instead."
            action={
              <Link to="/start" className="btn-primary">
                See all occupations
              </Link>
            }
          />
        ) : (
          <ErrorState
            title="We couldn’t scan this occupation"
            message={breakdown.error.message}
            onRetry={() => void breakdown.refetch()}
          />
        )}
      </Page>
    );
  }

  const { occupation, tasks, limitations } = breakdown.data;
  const canSimulate = occupation.simulationAvailable !== false;
  const simulate = () =>
    create.mutate({ occupationId: occupation.id }, { onSuccess: () => navigate('/simulate') });
  const rank = (t: OccupationTask) => {
    const i = LIKELY_CHANGE_ORDER.indexOf(t.likelyChange as never);
    return i === -1 ? LIKELY_CHANGE_ORDER.length : i;
  };

  return (
    <Page>
      <PageHeader
        eyebrow={`Task Scanner${occupation.sector ? ` · ${occupation.sector}` : ''}`}
        eyebrowClass="text-discover-ink"
        title={occupation.title}
        intro={occupation.summary}
        actions={
          canSimulate ? (
            <Button variant="accent" size="lg" onClick={simulate} disabled={create.isPending}>
              {create.isPending && <Spinner />}
              Simulate this occupation <span aria-hidden="true">→</span>
            </Button>
          ) : (
            <p className="rounded-full bg-midnight/5 px-4 py-2 text-sm font-semibold">
              A simulation for this occupation is coming soon
            </p>
          )
        }
      />
      {create.isError && (
        <p role="alert" className="mt-4 text-transform-ink">
          {create.error.message}
        </p>
      )}
      {config.useMocks && (
        <p className="mt-6">
          <Badge tone="sample">
            Sample tasks · placeholders until the research team’s data arrives
          </Badge>
        </p>
      )}

      {occupation.exposureLabel && (
        <section
          aria-labelledby="exposure-heading"
          className="mt-12 rounded-4xl bg-ivory-50 p-6 shadow-card sm:p-8"
        >
          <p className="eyebrow text-adapt-ink">AI exposure</p>
          <h2 id="exposure-heading" className="mt-2 text-2xl font-bold">
            {occupation.exposureLabel}
          </h2>
          {occupation.exposureSummary && (
            <p className="mt-3 max-w-3xl text-midnight/80">{occupation.exposureSummary}</p>
          )}
          {occupation.exposureMeasures && (
            <p className="mt-3 text-sm font-semibold">
              This measures {occupation.exposureMeasures}.
            </p>
          )}
          {occupation.kenyaContext && (
            <p className="mt-4 max-w-3xl border-l-2 border-discover pl-4 text-midnight/80">
              <span className="font-semibold text-midnight">In Kenya: </span>
              {occupation.kenyaContext}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="legend-heading" className="mt-12">
        <h2 id="legend-heading" className="text-2xl font-bold">
          How to read this scan
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {LIKELY_CHANGE_ORDER.map((c) => (
            <li key={c} className="rounded-3xl bg-ivory-50 p-4 shadow-card">
              <ChangeChip value={c} />
              <p className="mt-2 text-sm text-midnight/80">{LIKELY_CHANGE[c].description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tasks-heading" className="mt-12">
        <h2 id="tasks-heading" className="text-2xl font-bold">
          Tasks in this occupation
        </h2>
        <ul className="mt-4 grid gap-5 md:grid-cols-2">
          {[...tasks]
            .sort((a, b) => rank(a) - rank(b))
            .map((t, i) => (
              <TaskCard key={t.id} task={t} index={i} />
            ))}
        </ul>
      </section>

      {limitations.length > 0 && (
        <section
          aria-labelledby="limits-heading"
          className="mt-12 rounded-4xl border border-midnight/15 p-6 sm:p-8"
        >
          <h2 id="limits-heading" className="text-2xl font-bold">
            Limitations
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-midnight/80">
            {limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link to="/methodology" className="font-semibold underline underline-offset-4">
              Read our methodology
            </Link>
          </p>
        </section>
      )}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="container-page pb-24 pt-6 sm:pt-10">{children}</div>;
}

function ChangeChip({ value }: { value: string }) {
  const c = likelyChange(value);
  return (
    <span
      className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-sm font-semibold ${c.chip}`}
    >
      <span aria-hidden="true">{c.mark}</span>
      {c.label}
    </span>
  );
}

function TaskCard({ task, index }: { task: OccupationTask; index: number }) {
  return (
    <m.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.05 }}
      className="flex flex-col rounded-4xl bg-ivory-50 p-5 shadow-card sm:p-6"
    >
      <span className="flex flex-wrap items-center gap-2">
        <ChangeChip value={task.likelyChange} />
        <span className="text-sm text-midnight/80">{exposureLabel(task.exposureLevel)}</span>
      </span>
      <h3 className="mt-3 font-display text-xl font-bold leading-snug">{task.name}</h3>
      {task.explanation && <p className="mt-2 flex-1 text-midnight/80">{task.explanation}</p>}
      {task.skills.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Associated skills</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {task.skills.map((s) => (
              <li key={s}>
                <SkillTag>{s}</SkillTag>
              </li>
            ))}
          </ul>
        </div>
      )}
      {task.sources.length > 0 && (
        <ul className="mt-4 space-y-2">
          {task.sources.map((s) => (
            <li key={s.id ?? s.url}>
              <SourceLink source={s} />
            </li>
          ))}
        </ul>
      )}
    </m.li>
  );
}
