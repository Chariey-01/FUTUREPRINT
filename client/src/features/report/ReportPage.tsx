import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PathwayIcon } from '../../components/PathwayIcon';
import { ReportSection } from '../../components/ReportSection';
import { SourceLink } from '../../components/SourceLink';
import { Button } from '../../components/ui/Button';
import { useResetJourney } from '../../hooks/useSession';
import { ApiRequestError, isSessionGone } from '../../lib/api';
import { PATHWAYS } from '../../lib/pathways';
import { useSessionToken } from '../../lib/sessionToken';
import type { Choice, Report, Suggestion, SuggestionCategory } from '../../types/api';
import { useReport } from './useReport';

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  skill: 'Skills worth exploring',
  transferable_capability: 'Transferable capabilities',
  career_direction: 'Possible career directions',
  learning_activity: 'Practical learning activities',
  next_step: 'Recommended next steps',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as SuggestionCategory[];

export default function ReportPage() {
  const { token, endReason } = useSessionToken();
  const report = useReport();

  let body: React.ReactNode;
  if (!token) {
    body = (
      <EmptyState
        title={endReason === 'expired' ? 'Your journey has expired' : 'No Futureprint yet'}
        message="Make three decisions in the simulator to generate your personal report."
        action={
          <Link to="/start" className="btn-primary">
            Start a journey
          </Link>
        }
      />
    );
  } else if (report.isPending) {
    body = <LoadingState label="Composing your Futureprint" />;
  } else if (report.isError) {
    const err = report.error;
    body =
      err instanceof ApiRequestError && err.code === 'SESSION_INCOMPLETE' ? (
        <EmptyState
          title="Almost there"
          message="Finish your decisions in the simulator to unlock your Futureprint."
          action={
            <Link to="/simulate" className="btn-primary">
              Continue my journey
            </Link>
          }
        />
      ) : isSessionGone(err) ? (
        <EmptyState
          title="Your journey has expired"
          message="Start a fresh journey whenever you like."
          action={
            <Link to="/start" className="btn-primary">
              Start a new journey
            </Link>
          }
        />
      ) : (
        <ErrorState
          title="We couldn’t compose your Futureprint"
          message={err.message}
          onRetry={() => void report.refetch()}
        />
      );
  } else {
    body = <ReportContent report={report.data} />;
  }

  return <div className="container-page pb-24 pt-4 sm:pt-8 print:p-0">{body}</div>;
}

function ReportContent({ report }: { report: Report }) {
  const navigate = useNavigate();
  const reset = useResetJourney();
  const pathway = PATHWAYS[report.pathway.id];
  // Stable sort by category; unknown categories (if the contract grows) go last.
  const rank = (c: SuggestionCategory) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  const ordered = [...report.suggestions].sort((a, b) => rank(a.category) - rank(b.category));
  const generated = new Date(report.generatedAt);

  const replay = () => {
    reset();
    navigate('/start');
  };

  return (
    <article className="space-y-8 print:space-y-6">
      {/* Keepsake header */}
      <header
        className={`relative isolate overflow-hidden rounded-4xl px-6 py-10 sm:px-12 sm:py-14 print:rounded-none print:border-2 print:border-midnight ${pathway.soft}`}
      >
        <span
          aria-hidden="true"
          className={`absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full opacity-60 ${pathway.accent}`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-2xl text-midnight ${pathway.accent}`}
          >
            <PathwayIcon pathway={report.pathway.id} />
          </span>
          <p className={`eyebrow ${pathway.ink}`}>My Futureprint · {pathway.name} pathway</p>
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.05] sm:text-7xl">
          {report.occupation.title}: the {pathway.name} pathway
        </h1>
        <p className="mt-5 max-w-2xl text-lg sm:text-xl">{report.pathway.summary}</p>
        <p className="mt-6 text-sm text-midnight/80">
          Generated{' '}
          <time dateTime={report.generatedAt}>
            {Number.isNaN(generated.getTime())
              ? report.generatedAt
              : generated.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
          </time>
        </p>
        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <Button variant="primary" onClick={() => window.print()}>
            Print or save as PDF
          </Button>
          <Button variant="secondary" onClick={replay}>
            Replay the journey
          </Button>
        </div>
      </header>

      <ReportSection
        id="your-choices"
        tone="choices"
        eyebrow="Your choices"
        title="The future you explored"
        intro={`Starting as a ${report.occupation.title}, here is the path you chose.`}
      >
        <ol className="grid gap-4 md:grid-cols-3 md:gap-0">
          {report.choices.map((c, i) => (
            <TimelineStep key={c.step} choice={c} last={i === report.choices.length - 1} />
          ))}
        </ol>
        <dl className="mt-8 grid gap-4 border-t border-midnight/10 pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-midnight/80">Starting occupation</dt>
            <dd className="mt-1 text-xl font-semibold">{report.occupation.title}</dd>
          </div>
          <div>
            <dt className="text-sm text-midnight/80">Pathway explored</dt>
            <dd
              className={`mt-1 inline-flex items-center gap-2 text-xl font-semibold ${pathway.ink}`}
            >
              <PathwayIcon pathway={report.pathway.id} className="h-5 w-5" />
              {pathway.name}
            </dd>
          </div>
        </dl>
      </ReportSection>

      <ReportSection
        id="research"
        tone="research"
        eyebrow="What the research says"
        title="Evidence behind your future"
        intro="Findings from published research, each linked to its source."
      >
        <ol className="grid gap-6 lg:grid-cols-2">
          {report.research.findings.map((f, i) => (
            <li
              key={f.id}
              className="flex gap-4 break-inside-avoid rounded-3xl bg-ivory-50/5 p-5 print:border print:border-midnight/30 print:text-midnight"
            >
              <span
                aria-hidden="true"
                className="font-display text-3xl font-bold text-adapt print:text-adapt-ink"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-lg leading-relaxed">{f.statement}</p>
                <p className="mt-3">
                  <SourceLink source={f.source} tone="dark" />
                </p>
              </div>
            </li>
          ))}
        </ol>
        {report.research.limitations.length > 0 && (
          <div className="mt-8 break-inside-avoid rounded-3xl border border-ivory-50/20 p-5 sm:p-6 print:border-midnight/30">
            <h3 className="text-lg font-semibold">Important limitations</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ivory-200 print:text-midnight">
              {report.research.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </ReportSection>

      <ReportSection
        id="suggested"
        tone="suggested"
        eyebrow="Suggested by FUTUREPRINT"
        title="Where you could go next"
        intro="Suggestions based on your choices — each one explains why it was made."
      >
        {/* One grid for any number of suggestions; ordered by category, each card labelled. */}
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {ordered.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </ul>
      </ReportSection>

      <div className="flex flex-col items-start gap-4 rounded-4xl border border-midnight/10 bg-ivory-50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 print:hidden">
        <div>
          <p className="font-display text-2xl font-bold">Curious about another future?</p>
          <p className="mt-1 text-midnight/80">
            Replay with a different occupation or different decisions.
          </p>
        </div>
        <Button variant="accent" size="lg" onClick={replay}>
          Explore another future <span aria-hidden="true">→</span>
        </Button>
      </div>
    </article>
  );
}

function TimelineStep({ choice, last }: { choice: Choice; last: boolean }) {
  const p = PATHWAYS[choice.pathway];
  return (
    <li className="relative break-inside-avoid md:pr-6">
      {/* connector line between chapters (desktop) */}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute left-6 top-12 hidden h-0.5 w-full border-t-2 border-dashed border-midnight/20 md:block"
        />
      )}
      <span
        className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl text-midnight ${p.accent}`}
      >
        <PathwayIcon pathway={choice.pathway} />
      </span>
      <p className="eyebrow mt-4 text-midnight/80">
        Chapter {choice.step} · {choice.scenarioTitle}
      </p>
      <p className="mt-1 font-display text-2xl font-bold leading-tight">{choice.optionLabel}</p>
      <p className={`mt-1 text-sm font-semibold ${p.ink}`}>{p.name}</p>
    </li>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  return (
    <li className="flex break-inside-avoid flex-col rounded-3xl bg-ivory-50 p-5 shadow-card print:border print:border-midnight/20 print:shadow-none">
      <p className="eyebrow text-discover-ink">
        {CATEGORY_LABELS[suggestion.category] ?? 'Suggestion'}
      </p>
      <h3 className="mt-2 font-display text-xl font-bold">{suggestion.title}</h3>
      <p className="mt-1 flex-1 text-midnight/80">{suggestion.description}</p>
      <p className="mt-4 rounded-2xl bg-discover-soft px-4 py-3 text-sm text-midnight">
        <span className="font-semibold text-discover-ink">Why: </span>
        {suggestion.reason}
      </p>
    </li>
  );
}
