import { AnimatePresence, m } from 'framer-motion';
import { useId, useState, type FormEvent } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { PathwayIcon } from '../../components/PathwayIcon';
import { PATHWAYS } from '../../lib/pathways';
import type { PathwayId } from '../../types/api';
import { HorizonScene } from '../portal/HeroIllustration';

/**
 * ACCOUNT PREVIEW — design prototype only.
 * The hackathon MVP is anonymous (PRD). There is no auth backend, so this page never sends,
 * stores or logs anything typed into it. It demonstrates the planned sign-in UX.
 */
type Mode = 'signin' | 'signup';

const PLANNED: { pathway: PathwayId; title: string; body: string }[] = [
  { pathway: 'adapt', title: 'Keep your reports', body: 'Return to every Futureprint you create.' },
  {
    pathway: 'transform',
    title: 'Compare futures',
    body: 'See how different choices change the picture.',
  },
  {
    pathway: 'discover',
    title: 'Plan next steps',
    body: 'Turn suggestions into a development plan.',
  },
];

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>('signin');

  return (
    <div className="container-page grid gap-8 pb-20 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:pt-6">
      <aside className="on-dark relative isolate flex min-h-[260px] flex-col justify-between overflow-hidden rounded-4xl bg-midnight p-8 text-ivory-50 sm:p-10 lg:min-h-[640px]">
        <div className="relative z-10">
          <p className="eyebrow text-adapt">Your Futureprint, kept</p>
          <p className="mt-4 max-w-md font-display text-3xl font-bold leading-tight sm:text-4xl">
            Come back to the futures you’ve explored.
          </p>
          <p className="mt-4 max-w-md text-ivory-200">
            Planned for accounts — until then, every journey works without one.
          </p>
          <ul className="mt-8 hidden space-y-5 sm:block">
            {PLANNED.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-midnight ${PATHWAYS[f.pathway].accent}`}
                >
                  <PathwayIcon pathway={f.pathway} className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{f.title}</span>
                  <span className="block text-sm text-ivory-200">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        {/* In normal flow (not absolute) so it can never sit on top of the text. */}
        <div className="-mx-8 -mb-8 mt-8 sm:-mx-10 sm:-mb-10">
          <HorizonScene className="block h-40 w-full sm:h-56 lg:h-80" />
        </div>
      </aside>

      <section aria-labelledby="signin-heading" className="flex flex-col justify-center">
        <span className="self-start">
          <Badge tone="sample">Design preview · accounts aren’t live yet</Badge>
        </span>
        <h1 id="signin-heading" className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-3 max-w-md text-midnight/80">
          Nothing you type here is sent or stored. Explore freely as a guest — no account needed.
        </p>

        <div className="mt-8">
          <Tabs<Mode>
            label="Account"
            value={mode}
            onChange={setMode}
            items={[
              { id: 'signin', label: 'Sign in', panel: <AuthForm mode="signin" /> },
              { id: 'signup', label: 'Create account', panel: <AuthForm mode="signup" /> },
            ]}
          />
        </div>
      </section>
    </div>
  );
}

interface Errors {
  name?: string;
  email?: string;
  password?: string;
}

function AuthForm({ mode }: { mode: Mode }) {
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [forgot, setForgot] = useState(false);
  const signup = mode === 'signup';

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Errors = {};
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (signup && !String(data.get('name') ?? '').trim()) next.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = 'Enter a valid email address, like name@example.com.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    setSubmitted(Object.keys(next).length === 0);
    // Deliberately no network call and no storage: see file header.
    if (Object.keys(next).length === 0) e.currentTarget.reset();
  };

  return (
    <div className="max-w-md">
      <form
        noValidate
        onSubmit={onSubmit}
        className="space-y-5"
        aria-label={signup ? 'Create account' : 'Sign in'}
      >
        {signup && <Field name="name" label="Name" autoComplete="name" error={errors.name} />}
        <Field name="email" label="Email" type="email" autoComplete="email" error={errors.email} />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          hint={signup ? 'At least 8 characters.' : undefined}
          error={errors.password}
        />
        {!signup && (
          <button
            type="button"
            className="text-sm font-semibold underline underline-offset-4"
            onClick={() => setForgot(true)}
            aria-expanded={forgot}
          >
            Forgot password?
          </button>
        )}
        {forgot && !signup && (
          <p className="rounded-2xl bg-adapt-soft px-4 py-3 text-sm">
            Password reset will be available when accounts launch.
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full">
          {signup ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <div role="status" aria-live="polite">
        <AnimatePresence>
          {submitted && (
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 rounded-3xl border border-discover-ink/25 bg-discover-soft p-5"
            >
              <p className="font-semibold">Accounts aren’t available in this preview.</p>
              <p className="mt-1 text-midnight/80">
                Your details weren’t sent or saved. You can explore every future without an account.
              </p>
              <ButtonLink to="/start" variant="accent" className="mt-4">
                Continue as guest <span aria-hidden="true">→</span>
              </ButtonLink>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center gap-4 text-sm text-midnight/80">
        <span className="h-px flex-1 bg-midnight/15" aria-hidden="true" />
        or
        <span className="h-px flex-1 bg-midnight/15" aria-hidden="true" />
      </div>
      <ul className="mt-6 grid gap-3">
        {['Google', 'LinkedIn'].map((p) => (
          <li key={p}>
            <button
              type="button"
              disabled
              className="btn w-full border border-midnight/20 bg-ivory-50 text-midnight"
            >
              Continue with {p}
              <span className="text-xs font-medium">(coming soon)</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center">
        <ButtonLink to="/start" variant="secondary">
          Explore without an account
        </ButtonLink>
      </p>
    </div>
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  error?: string;
}

function Field({ name, label, type = 'text', autoComplete, hint, error }: FieldProps) {
  const id = useId();
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`mt-2 min-h-[52px] w-full rounded-2xl border bg-ivory-50 px-4 text-base text-midnight focus:border-midnight ${
          error ? 'border-transform-ink' : 'border-midnight/20'
        }`}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-midnight/80">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-transform-ink">
          {error}
        </p>
      )}
    </div>
  );
}
