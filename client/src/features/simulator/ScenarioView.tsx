import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DecisionCard } from '../../components/DecisionCard';
import { Spinner } from '../../components/LoadingState';
import { ProgressSteps } from '../../components/ProgressSteps';
import { useSubmitChoice } from '../../hooks/useSession';
import { isSessionGone, isStaleStep } from '../../lib/api';
import type { Scenario, Session } from '../../types/api';

export type SimulatorMessage =
  | { kind: 'saved'; text: string; feedback?: string | null }
  | { kind: 'problem'; text: string }
  | null;

interface Props {
  session: Session;
  scenario: Scenario;
  /** Owned by the parent so it survives the remount when the server sends a new step. */
  setMessage: (message: SimulatorMessage) => void;
}

export function ScenarioView({ session, scenario, setMessage }: Props) {
  const navigate = useNavigate();
  const submit = useSubmitChoice();
  const [selected, setSelected] = useState<string | null>(null);
  const inFlight = useRef(false);
  const headingId = useId();
  const busy = submit.isPending;
  const finalStep = scenario.step >= session.totalSteps;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selected || inFlight.current) return; // guard against double submits
    inFlight.current = true;
    setMessage(null);
    const label = scenario.options.find((o) => o.id === selected)?.label ?? '';
    submit.mutate(
      { optionId: selected },
      {
        onSuccess: ({ session: next, feedback }) => {
          if (next.status === 'completed') {
            navigate('/report');
            return;
          }
          setMessage({
            kind: 'saved',
            text: `Choice saved — “${label}”. On to chapter ${next.currentStep}.`,
            feedback,
          });
        },
        onError: (err) => {
          if (isStaleStep(err)) {
            setMessage({
              kind: 'problem',
              text: 'This step was already answered — perhaps in another tab. We’ve loaded your latest step.',
            });
          } else if (!isSessionGone(err)) {
            setMessage({
              kind: 'problem',
              text: err.message || 'We couldn’t save your choice. Please try again.',
            });
          }
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} aria-labelledby={headingId} aria-busy={busy}>
      <ProgressSteps current={scenario.step} total={session.totalSteps} />

      <div className="mt-5 max-w-3xl">
        <h1 id={headingId} className="text-4xl font-bold leading-[1.05] sm:text-6xl">
          {scenario.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed sm:text-xl">{scenario.prompt}</p>
        {scenario.context && (
          <p className="mt-3 border-l-2 border-adapt pl-4 text-base italic text-midnight/80">
            {scenario.context}
          </p>
        )}
      </div>

      <fieldset className="mt-8 sm:mt-10" disabled={busy}>
        <legend className="sr-only">Choose how you would respond</legend>
        <div className="grid gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-1 xl:grid-cols-3">
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

      <div className="mt-8 flex flex-col-reverse items-stretch gap-3 rounded-4xl bg-ivory-50 p-4 shadow-card sm:flex-row sm:items-center sm:justify-end sm:pl-6">
        <p className="text-sm text-midnight/80 sm:mr-auto" aria-live="polite">
          {busy
            ? 'Saving your choice…'
            : selected
              ? 'Ready when you are. You can change your mind until you lock it in.'
              : 'Select one option to continue.'}
        </p>
        <button
          type="submit"
          className="btn-primary shrink-0 whitespace-nowrap"
          disabled={!selected || busy}
        >
          {busy && <Spinner />}
          {finalStep ? 'Lock in & see my Futureprint' : 'Lock in this choice'}
        </button>
      </div>
    </form>
  );
}
