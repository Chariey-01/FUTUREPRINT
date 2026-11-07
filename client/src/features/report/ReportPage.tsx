import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PathwayChip } from '../../components/PathwayCard';
import { ReportSection } from '../../components/ReportSection';
import { SourceLink } from '../../components/SourceLink';
import { useResetJourney } from '../../hooks/useSession';
import { ApiRequestError, isSessionGone } from '../../lib/api';
import { PATHWAYS } from '../../lib/pathways';
import { useSessionToken } from '../../lib/sessionToken';
import type { Report, Suggestion, SuggestionCategory } from '../../types/api';
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

  return <div className="container-page pb-24 pt-4 sm:pt-8">{body}</div>;
}

function ReportContent({ report }: { report: Report }) {
  const navigate = useNavigate();
  const reset = useResetJourney();
  const pathway = PATHWAYS[report.pathway.id];
  const grouped = CATEGORY_ORDER.map((c) => ({
    category: c,
    items: report.suggestions.filter((s) => s.category === c),
  })).filter((g) => g.items.length > 0);

  const replay = () => {
    reset();
    navigate('/start');
  };

  return (
    <article className="space-y-8">
      <header
        className={`relative overflow-hidden rounded-4xl px-6 py-10 sm:px-10 sm:py-14 ${pathway.soft}`}
      >
        <span
          aria-hidden="true"
          className={`absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-60 ${pathway.accent}`}
        />
        <p className={`eyebrow relative ${pathway.ink}`}>My Futureprint</p>
        <h1 className="relative mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
          {report.occupation.title}: the {pathway.name} pathway
        </h1>
        <p className="relative mt-4 max-w-2xl text-lg">{report.pathway.summary}</p>
      </header>

      <ReportSection
        id="your-choices"
        tone="choices"
        eyebrow="Your choices"
        title="The future you explored"
        intro="What you decided along the way."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-midnight/80">Occupation selected</dt>
            <dd className="mt-1 text-xl font-semibold">{report.occupation.title}</dd>
          </div>
          <div>
            <dt className="text-sm text-midnight/80">Pathway explored</dt>
            <dd className="mt-2">
              <PathwayChip pathway={report.pathway.id} />
            </dd>
          </div>
        </dl>
        <h3 className="mt-8 text-lg font-semibold">Decisions made</h3>
        <ol className="mt-3 divide-y divide-midnight/10">
          {report.choices.map((c) => (
            <li
              key={c.step}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-6"
            >
              <span className="eyebrow w-16 shrink-0 text-midnight/80">Step {c.step}</span>
              <span className="flex-1">
                <span className="block text-sm text-midnight/80">{c.scenarioTitle}</span>
                <span className="block font-semibold">{c.optionLabel}</span>
              </span>
              <PathwayChip pathway={c.pathway} />
            </li>
          ))}
        </ol>
      </ReportSection>

      <ReportSection
        id="research"
        tone="research"
        eyebrow="What the research says"
        title="Evidence behind your future"
        intro="Findings from published research, each linked to its source."
      >
        <ul className="space-y-6">
          {report.research.findings.map((f) => (
            <li key={f.id} className="border-l-2 border-adapt pl-5">
              <p className="text-lg leading-relaxed">{f.statement}</p>
              <p className="mt-2">
                <SourceLink source={f.source} tone="dark" />
              </p>
            </li>
          ))}
        </ul>
        {report.research.limitations.length > 0 && (
          <div className="mt-10 rounded-3xl bg-ivory-50/10 p-5">
            <h3 className="text-lg font-semibold">Important limitations</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ivory-200">
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
        intro="Suggestions based on your choices — with the reason for each."
      >
        <div className="space-y-10">
          {grouped.map((g) => (
            <div key={g.category}>
              <h3 className="text-xl font-semibold">{CATEGORY_LABELS[g.category]}</h3>
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {g.items.map((s) => (
                  <SuggestionCard key={s.id} suggestion={s} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ReportSection>

      <div className="flex flex-col items-start gap-4 rounded-4xl border border-midnight/10 bg-ivory-50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="font-display text-2xl font-semibold">Curious about another future?</p>
          <p className="mt-1 text-midnight/80">
            Replay with a different occupation or different decisions.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={replay}>
          Replay the journey
        </button>
      </div>
    </article>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  return (
    <li className="rounded-3xl bg-ivory-50 p-5 shadow-card">
      <p className="font-display text-xl font-semibold">{suggestion.title}</p>
      <p className="mt-1 text-midnight/80">{suggestion.description}</p>
      <p className="mt-4 rounded-2xl bg-discover-soft px-4 py-3 text-sm text-midnight">
        <span className="font-semibold text-discover-ink">Why: </span>
        {suggestion.reason}
      </p>
    </li>
  );
}
