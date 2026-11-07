import { PathwayIcon } from '../../components/PathwayIcon';
import { PATHWAYS } from '../../lib/pathways';
import type { Choice, Session } from '../../types/api';

/**
 * "Your story so far": the decisions the server has recorded, the current chapter and what's
 * still ahead. Pure presentation of session data — nothing is inferred here.
 * Desktop: sticky rail. Mobile/tablet: intro line + collapsible summary.
 */
export function StoryRail({ session }: { session: Session }) {
  const upcoming = Array.from(
    { length: Math.max(session.totalSteps - session.currentStep, 0) },
    (_, i) => session.currentStep + 1 + i,
  );
  const count = session.choices.length;

  return (
    <aside
      aria-label="Your story so far"
      className="lg:sticky lg:top-6 lg:self-start lg:rounded-4xl lg:bg-ivory-50 lg:p-6 lg:shadow-card"
    >
      <p className="text-sm text-midnight/80">
        Exploring the future of{' '}
        <strong className="font-semibold text-midnight">{session.occupation.title}</strong>
      </p>

      <div className="hidden lg:block">
        {session.occupation.sector && (
          <p className="eyebrow mt-1 text-midnight/80">{session.occupation.sector}</p>
        )}
        <h2 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-midnight/80">
          Your story so far
        </h2>
        <ol className="relative mt-4 space-y-5 border-l-2 border-dashed border-midnight/15 pl-6">
          {session.choices.map((c) => (
            <ChoiceItem key={c.step} choice={c} withDot />
          ))}
          <li className="relative">
            <Dot className="bg-midnight ring-4 ring-midnight/15" />
            <p className="text-sm font-semibold">Chapter {session.currentStep} · in progress</p>
          </li>
          {upcoming.map((s) => (
            <li key={s} className="relative">
              <Dot className="border-2 border-midnight/25 bg-ivory-50" />
              <p className="text-sm text-midnight/80">Chapter {s} · still unwritten</p>
            </li>
          ))}
        </ol>
      </div>

      {count > 0 && (
        <details className="group mt-4 rounded-3xl bg-ivory-50 px-5 py-2 shadow-card lg:hidden">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between font-semibold">
            Your story so far ({count} {count === 1 ? 'choice' : 'choices'})
            <span aria-hidden="true" className="transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <ol className="mt-2 space-y-4 pb-3">
            {session.choices.map((c) => (
              <ChoiceItem key={c.step} choice={c} />
            ))}
          </ol>
        </details>
      )}
    </aside>
  );
}

function ChoiceItem({ choice, withDot = false }: { choice: Choice; withDot?: boolean }) {
  const p = PATHWAYS[choice.pathway];
  return (
    <li className="relative flex gap-3">
      {withDot && <Dot className={p.accent} />}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${p.soft} ${p.ink}`}
      >
        <PathwayIcon pathway={choice.pathway} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-midnight/80">
          Chapter {choice.step} · {choice.scenarioTitle}
        </span>
        <span className="block font-semibold leading-snug">{choice.optionLabel}</span>
        <span className={`text-xs font-semibold ${p.ink}`}>{p.name}</span>
      </span>
    </li>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full ${className}`}
    />
  );
}
