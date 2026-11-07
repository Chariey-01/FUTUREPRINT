import { m } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PathwayCard } from '../../components/PathwayCard';
import { ButtonLink } from '../../components/ui/Button';
import { PATHWAY_ORDER } from '../../lib/pathways';
import { HeroSection } from './HeroSection';

const STEPS = [
  { title: 'Choose', body: 'Pick an occupation — yours, or one you’re curious about.' },
  { title: 'Decide', body: 'Make three decisions as its future unfolds.' },
  {
    title: 'Reflect',
    body: 'Receive your Futureprint: your choices, the research, and next steps.',
  },
];

const reveal = (i = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.5, delay: i * 0.1 },
});

/** Static content only — renders instantly without waiting for the backend. */
export default function PortalPage() {
  return (
    <>
      <HeroSection />
      <div className="bg-ivory-100 text-midnight">
        <section
          id="about"
          aria-labelledby="about-heading"
          className="container-page scroll-mt-6 py-16 sm:py-24"
        >
          <m.div {...reveal()} className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div>
              <p className="eyebrow text-transform-ink">About</p>
              <h2 id="about-heading" className="mt-3 text-3xl font-bold sm:text-5xl">
                A future you explore, not a future you’re told.
              </h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed text-midnight/80">
              <p>
                FUTUREPRINT is an interactive exhibition for students, graduates and early-career
                professionals. It doesn’t predict which jobs will disappear.
              </p>
              <p>
                Instead, it shows how work is changing and invites you to try out real career
                choices, so you can see the paths that open up and what each could mean for you.
              </p>
            </div>
          </m.div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {PATHWAY_ORDER.map((p, i) => (
              <m.div key={p} {...reveal(i)}>
                <PathwayCard pathway={p} index={i} />
              </m.div>
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="scroll-mt-6 rounded-t-[2.5rem] bg-ivory-50 py-16 sm:py-24"
        >
          <div className="container-page">
            <p className="eyebrow text-adapt-ink">How it works</p>
            <h2 id="how-heading" className="mt-3 max-w-2xl text-3xl font-bold sm:text-5xl">
              Three rooms, one journey
            </h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <m.li key={s.title} {...reveal(i)} className="border-t-2 border-midnight/15 pt-5">
                  <span
                    className="font-display text-5xl font-bold text-adapt-ink"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-2 text-2xl font-bold">{s.title}</h3>
                  <p className="mt-1 text-midnight/80">{s.body}</p>
                </m.li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="research"
          aria-labelledby="research-heading"
          className="scroll-mt-6 bg-ivory-50 pb-20 sm:pb-28"
        >
          <div className="container-page">
            <m.div
              {...reveal()}
              className="on-dark rounded-4xl bg-midnight p-8 text-ivory-50 sm:p-12"
            >
              <p className="eyebrow text-discover">The research</p>
              <h2 id="research-heading" className="mt-3 max-w-3xl text-3xl font-bold sm:text-5xl">
                Grounded in evidence, honest about its limits.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ivory-200">
                Every finding in your Futureprint links to the published source behind it, alongside
                the limitations of that evidence. Suggestions are clearly marked as FUTUREPRINT’s,
                and each one explains why it was made.
              </p>
              <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <ButtonLink to="/start" variant="accent" size="lg">
                  Begin <span aria-hidden="true">→</span>
                </ButtonLink>
                <ButtonLink to="/observatory" variant="light" size="lg">
                  Workforce Observatory
                </ButtonLink>
                <Link
                  to="/methodology"
                  className="text-sm font-semibold underline underline-offset-4"
                >
                  Our methodology
                </Link>
              </div>
            </m.div>
          </div>
        </section>
      </div>
    </>
  );
}
