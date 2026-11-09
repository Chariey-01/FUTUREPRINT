import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PathwayIcon } from '../../components/PathwayIcon';
import { ReportSection } from '../../components/ReportSection';
import { SourceLink } from '../../components/SourceLink';
import { Button, ButtonLink } from '../../components/ui/Button';
import { humanise } from '../../lib/mapping';
import { PATHWAYS } from '../../lib/pathways';
import type { Choice, ReasonedItem, Report, Suggestion } from '../../types/api';

const CATEGORY_LABELS: Record<string, string> = {
  skill: 'Skill worth exploring',
  transferable_capability: 'Transferable capability',
  career_direction: 'Possible career direction',
  learning_activity: 'Practical learning activity',
  next_step: 'Recommended next step',
};
const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? humanise(c);

interface Props {
  report: Report;
  /** "owner" = your own report (/report); "shared" = read-only via a share link (/r/:token). */
  mode: 'owner' | 'shared';
  onReplay?: () => void;
}

/** The FUTUREPRINT report. Renders only what the server returned; every suggestion shows its reason. */
export function ReportView({ report, mode, onReplay }: Props) {
  const pathway = PATHWAYS[report.pathway.id];
  const generated = new Date(report.generatedAt);

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
          <p className={`eyebrow ${pathway.ink}`}>
            {mode === 'shared' ? 'A shared Futureprint' : 'My Futureprint'} · {pathway.name} pathway
          </p>
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.05] sm:text-7xl">
          {report.occupation.title}: the {pathway.name} pathway
        </h1>
        {report.pathway.title && (
          <p className="mt-4 max-w-2xl font-display text-xl font-bold sm:text-2xl">
            {report.pathway.title}
          </p>
        )}
        {report.pathway.summary && (
          <p className="mt-3 max-w-2xl text-lg sm:text-xl">{report.pathway.summary}</p>
        )}
        {report.pathway.reason && (
          <p className="mt-4 max-w-2xl rounded-2xl bg-ivory-50/70 px-4 py-3 text-midnight">
            <span className="font-semibold">Why this pathway: </span>
            {report.pathway.reason}
          </p>
        )}
        {report.generatedAt && (
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
        )}
        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <Button variant="primary" onClick={() => window.print()}>
            Print or save as PDF
          </Button>
          {mode === 'owner' && report.shareToken && <ShareButton token={report.shareToken} />}
          {mode === 'owner' && onReplay && (
            <Button variant="secondary" onClick={onReplay}>
              Replay the journey
            </Button>
          )}
        </div>
      </header>

      {/* Mandatory server disclaimer: always visible, on screen and in print. */}
      <aside
        aria-label="About this report"
        className="rounded-3xl border-2 border-dashed border-midnight/25 bg-ivory-50 px-5 py-4 text-midnight/90"
      >
        <p className="text-sm">
          <span className="font-semibold">Please note: </span>
          {report.disclaimer}
        </p>
      </aside>

      <ReportSection
        id="your-choices"
        tone="choices"
        eyebrow="Your choices"
        title="The future you explored"
        intro={`Starting as a ${report.occupation.title}, here is the path you chose.`}
      >
        <ol className="grid gap-6 md:grid-cols-3 md:gap-0">
          {report.choices.map((c, i) => (
            <TimelineStep key={c.step} choice={c} last={i === report.choices.length - 1} />
          ))}
        </ol>
        {(report.capabilities.length > 0 || report.tradeOffs.length > 0) && (
          <div className="mt-10 space-y-8 border-t border-midnight/10 pt-8">
            {report.capabilities.length > 0 && (
              <ReasonList title="Capabilities your choices showed" items={report.capabilities} />
            )}
            {report.tradeOffs.length > 0 && (
              <ReasonList title="Trade-offs you accepted" items={report.tradeOffs} />
            )}
          </div>
        )}
        <p className="mt-8 print:hidden">
          <Link
            to={`/occupations/${encodeURIComponent(report.occupation.id)}`}
            className="text-sm font-semibold underline underline-offset-4"
          >
            See how {report.occupation.title} tasks are changing
          </Link>
        </p>
      </ReportSection>

      <ReportSection
        id="research"
        tone="research"
        eyebrow="What the research says"
        title="Evidence behind your future"
        intro="Findings from published research, each linked to its source."
      >
        {report.research.findings.length === 0 ? (
          <p className="text-ivory-200">No research findings were attached to this report.</p>
        ) : (
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
                  {f.reason && (
                    <p className="mt-2 text-sm text-ivory-200 print:text-midnight">{f.reason}</p>
                  )}
                  <p className="mt-3">
                    <SourceLink source={f.source} tone="dark" />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
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
        <div className="space-y-10">
          {report.pathway.steps.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold">Next steps on the {pathway.name} pathway</h3>
              <ol className="mt-4 grid gap-3 md:grid-cols-2">
                {report.pathway.steps.map((step, i) => (
                  <li
                    key={step}
                    className="flex gap-3 break-inside-avoid rounded-3xl bg-ivory-50 p-4 shadow-card print:border print:border-midnight/20 print:shadow-none"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-discover text-sm font-bold text-midnight"
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {report.suggestions.length > 0 && (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {report.suggestions.map((s) => (
                <SuggestionCard key={s.id} suggestion={s} />
              ))}
            </ul>
          )}

          {report.transferableSkills.length > 0 && (
            <ReasonList title="Skills you can carry with you" items={report.transferableSkills} />
          )}

          {report.otherPathways.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold">Other futures to explore</h3>
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {report.otherPathways.map((p) => (
                  <li
                    key={p.id}
                    data-testid="reasoned-item"
                    className={`relative break-inside-avoid overflow-hidden rounded-3xl bg-ivory-50 p-5 pt-6 shadow-card print:border print:border-midnight/20 print:shadow-none`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 top-0 h-1.5 ${PATHWAYS[p.id].accent}`}
                    />
                    <p className={`eyebrow inline-flex items-center gap-2 ${PATHWAYS[p.id].ink}`}>
                      <PathwayIcon pathway={p.id} className="h-4 w-4" />
                      {PATHWAYS[p.id].name}
                    </p>
                    <p className="mt-2 font-display text-xl font-bold">{p.title}</p>
                    {p.description && <p className="mt-1 text-midnight/80">{p.description}</p>}
                    <Why>{p.reason}</Why>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ReportSection>

      <div className="flex flex-col items-start gap-4 rounded-4xl border border-midnight/10 bg-ivory-50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 print:hidden">
        <div>
          <p className="font-display text-2xl font-bold">
            {mode === 'shared' ? 'Explore your own future' : 'Curious about another future?'}
          </p>
          <p className="mt-1 text-midnight/80">
            {mode === 'shared'
              ? 'Choose an occupation and make your own decisions.'
              : 'Replay with a different occupation or different decisions.'}
          </p>
        </div>
        {mode === 'owner' && onReplay ? (
          <Button variant="accent" size="lg" onClick={onReplay}>
            Explore another future <span aria-hidden="true">→</span>
          </Button>
        ) : (
          <ButtonLink to="/start" variant="accent" size="lg">
            Begin <span aria-hidden="true">→</span>
          </ButtonLink>
        )}
      </div>
    </article>
  );
}

function ShareButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const url = `${window.location.origin}/r/${token}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={() => void copy()}>
        Copy share link
      </Button>
      <span role="status" aria-live="polite" className="text-sm">
        {state === 'copied' && 'Link copied. Anyone with it can read this report.'}
        {state === 'failed' && (
          <>
            Copy this link: <span className="break-all font-mono text-xs">{url}</span>
          </>
        )}
      </span>
    </span>
  );
}

function TimelineStep({ choice, last }: { choice: Choice; last: boolean }) {
  const p = choice.pathway ? PATHWAYS[choice.pathway] : null;
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
        className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl text-midnight ${
          p ? p.accent : 'bg-midnight/10 font-bold'
        }`}
      >
        {choice.pathway ? <PathwayIcon pathway={choice.pathway} /> : choice.step}
      </span>
      <p className="eyebrow mt-4 text-midnight/80">
        Chapter {choice.step} · {choice.scenarioTitle}
      </p>
      <p className="mt-1 font-display text-2xl font-bold leading-tight">{choice.optionLabel}</p>
      {p && <p className={`mt-1 text-sm font-semibold ${p.ink}`}>{p.name}</p>}
      {choice.feedback && <p className="mt-2 text-sm text-midnight/80">{choice.feedback}</p>}
    </li>
  );
}

function ReasonList({ title, items }: { title: string; items: ReasonedItem[] }) {
  return (
    <div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li
            key={item.title}
            data-testid="reasoned-item"
            className="break-inside-avoid rounded-3xl bg-ivory-50 p-4 shadow-card print:border print:border-midnight/20 print:shadow-none"
          >
            <p className="font-semibold">{item.title}</p>
            {item.description && <p className="mt-1 text-midnight/80">{item.description}</p>}
            <Why>{item.reason}</Why>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  return (
    <li
      data-testid="reasoned-item"
      className="flex break-inside-avoid flex-col rounded-3xl bg-ivory-50 p-5 shadow-card print:border print:border-midnight/20 print:shadow-none"
    >
      <p className="eyebrow text-discover-ink">{categoryLabel(suggestion.category)}</p>
      <h3 className="mt-2 font-display text-xl font-bold">{suggestion.title}</h3>
      <p className="mt-1 flex-1 text-midnight/80">{suggestion.description}</p>
      <Why>{suggestion.reason}</Why>
    </li>
  );
}

function Why({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-2xl bg-discover-soft px-4 py-3 text-sm text-midnight">
      <span className="font-semibold text-discover-ink">Why: </span>
      {children}
    </p>
  );
}
