import { AnimatePresence, m } from 'framer-motion';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DecisionCard } from '../../components/DecisionCard';
import { Spinner } from '../../components/LoadingState';
import { ProgressSteps } from '../../components/ProgressSteps';
import { useSubmitChoice } from '../../hooks/useSession';
import { isSessionGone, isStaleStep } from '../../lib/api';
import type { Scenario, Session } from '../../types/api';

interface Props {
  session: Session;
  scenario: Scenario;
  /** Lives in the parent so it survives the remount when the server sends a new step. */
  notice: string | null;
  setNotice: (notice: string | null) => void;
}

export function ScenarioView({ session, scenario, notice, setNotice }: Props) {
  const navigate = useNavigate();
  const submit = useSubmitChoice();
  const [selected, setSelected] = useState<string | null>(null);
  const inFlight = useRef(false);
  const headingId = useId();
  const busy = submit.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selected || inFlight.current) return; // guard against double submits
    inFlight.current = true;
    setNotice(null);
    submit.mutate(
      { scenarioId: scenario.id, optionId: selected, step: scenario.step },
      {
        onSuccess: (next) => {
          if (next.status === 'completed') navigate('/report');
        },
        onError: (err) => {
          if (isStaleStep(err)) {
            setNotice(
              'This step was already answered — perhaps in another tab. We’ve loaded your latest step.',
            );
          } else if (!isSessionGone(err)) {
            setNotice(err.message || 'We couldn’t save your choice. Please try again.');
          }
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  return (
    <m.form
      onSubmit={onSubmit}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      aria-labelledby={headingId}
      aria-busy={busy}
    >
      <div className="flex flex-col gap-4 border-b border-midnight/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-midnight/80">
            Exploring the future of{' '}
            <strong className="font-semibold text-midnight">{session.occupation.title}</strong>
          </p>
        </div>
        <ProgressSteps current={scenario.step} total={session.totalSteps} />
      </div>

      <div className="mt-8 max-w-3xl sm:mt-12">
        <h1 id={headingId} className="text-3xl font-semibold leading-tight sm:text-5xl">
          {scenario.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed sm:text-xl">{scenario.prompt}</p>
        {scenario.context && <p className="mt-3 text-base text-midnight/80">{scenario.context}</p>}
      </div>

      <AnimatePresence>
        {notice && (
          <m.p
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-2xl border border-transform-ink/30 bg-transform-soft px-4 py-3 text-midnight"
          >
            {notice}
          </m.p>
        )}
      </AnimatePresence>

      <fieldset className="mt-8 sm:mt-10" disabled={busy}>
        <legend className="sr-only">Choose how you would respond</legend>
        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {scenario.options.map((option, i) => (
            <DecisionCard
              key={option.id}
              option={option}
              name={`scenario-${scenario.id}`}
              index={i}
              checked={selected === option.id}
              disabled={busy}
              submitting={busy}
              onSelect={setSelected}
            />
          ))}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-sm text-midnight/80 sm:mr-auto" aria-live="polite">
          {busy
            ? 'Saving your choice…'
            : selected
              ? 'Ready when you are.'
              : 'Select one option to continue.'}
        </p>
        <button type="submit" className="btn-primary" disabled={!selected || busy}>
          {busy && <Spinner />}
          {scenario.step >= session.totalSteps
            ? 'Lock in & see my Futureprint'
            : 'Lock in this choice'}
        </button>
      </div>
    </m.form>
  );
}
