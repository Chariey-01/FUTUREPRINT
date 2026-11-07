import { PathwayIcon } from '../../components/PathwayIcon';
import { Badge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { EVIDENCE_LABELS, TASK_CLASSES } from '../../lib/evidence';
import { PATHWAYS, PATHWAY_ORDER } from '../../lib/pathways';
import type { EvidenceLevel, TaskClassification } from '../../types/api';

const PRINCIPLES = [
  {
    title: 'Explore, don’t predict',
    body: 'FUTUREPRINT shows plausible futures to prepare for. It never claims to know which jobs will disappear.',
  },
  {
    title: 'Every claim has a source',
    body: 'Research findings link to the published evidence behind them, so you can read it yourself.',
  },
  {
    title: 'Every suggestion has a reason',
    body: 'Recommendations are labelled as FUTUREPRINT’s and explain which of your choices led to them.',
  },
  {
    title: 'Limits are stated',
    body: 'Each report says where the evidence is thin — by region, timeframe or occupation.',
  },
];

const TBC = 'To be completed by the research team';

/** Methodology framework. Specific data sources and rules are owned by Persons 3 and 5. */
export default function MethodologyPage() {
  return (
    <div className="container-page pb-24 pt-6 sm:pt-10">
      <PageHeader
        eyebrow="Methodology"
        eyebrowClass="text-adapt-ink"
        title="How FUTUREPRINT turns research into futures"
        intro="The principles behind every finding, classification and suggestion you see."
      />
      <p className="mt-6">
        <Badge tone="sample">
          Draft framework · details awaiting research and recommendation team review
        </Badge>
      </p>

      <section aria-labelledby="principles" className="mt-14">
        <h2 id="principles" className="text-3xl font-bold sm:text-4xl">
          Our principles
        </h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <li key={p.title} className="rounded-4xl bg-ivory-50 p-6 shadow-card">
              <span aria-hidden="true" className="font-display text-4xl font-bold text-adapt-ink">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-xl font-semibold">{p.title}</h3>
              <p className="mt-1 text-midnight/80">{p.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="evidence" className="mt-16">
        <h2 id="evidence" className="text-3xl font-bold sm:text-4xl">
          How evidence is classified
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-midnight/80">
          Every source carries a label so you can judge how much weight to give it.
        </p>
        <dl className="mt-6 divide-y divide-midnight/10 rounded-4xl bg-ivory-50 px-6 shadow-card">
          {(Object.keys(EVIDENCE_LABELS) as EvidenceLevel[]).map((k) => (
            <div key={k} className="grid gap-1 py-5 sm:grid-cols-[220px_1fr] sm:gap-6">
              <dt className="font-semibold">{EVIDENCE_LABELS[k].label}</dt>
              <dd className="text-midnight/80">{EVIDENCE_LABELS[k].description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="tasks" className="mt-16">
        <h2 id="tasks" className="text-3xl font-bold sm:text-4xl">
          How tasks are classified
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(TASK_CLASSES) as TaskClassification[]).map((k) => (
            <li key={k} className="rounded-3xl bg-ivory-50 p-5 shadow-card">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${TASK_CLASSES[k].chip}`}
              >
                <span aria-hidden="true">{TASK_CLASSES[k].mark}</span>
                {TASK_CLASSES[k].label}
              </span>
              <p className="mt-2 text-sm text-midnight/80">{TASK_CLASSES[k].description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pathways" className="mt-16">
        <h2 id="pathways" className="text-3xl font-bold sm:text-4xl">
          How pathways and suggestions work
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-midnight/80">
          Each decision in the simulator belongs to one of three pathways. Your report reflects the
          pathways your choices lean toward — none is better than another.
        </p>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {PATHWAY_ORDER.map((id) => (
            <li key={id} className={`flex gap-4 rounded-3xl p-5 ${PATHWAYS[id].soft}`}>
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-midnight ${PATHWAYS[id].accent}`}
              >
                <PathwayIcon pathway={id} />
              </span>
              <span>
                <span className="block font-semibold">{PATHWAYS[id].name}</span>
                <span className="block text-sm text-midnight/80">{PATHWAYS[id].tagline}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-4xl border border-dashed border-midnight/25 p-6">
          <h3 className="text-lg font-semibold">Recommendation rules</h3>
          <p className="mt-1 text-midnight/80">
            {TBC} (recommendation engine, Person 5). FUTUREPRINT does not calculate job-loss
            probabilities, salaries or career “match scores”.
          </p>
        </div>
      </section>

      <section aria-labelledby="limits" className="mt-16">
        <h2 id="limits" className="text-3xl font-bold sm:text-4xl">
          Data sources and limitations
        </h2>
        <div className="mt-6 rounded-4xl border border-dashed border-midnight/25 p-6">
          <p className="text-midnight/80">
            {TBC} (Person 3): the datasets used, their coverage by region and timeframe, and how
            often they are updated.
          </p>
        </div>
      </section>

      <div className="mt-16 flex flex-wrap gap-3">
        <ButtonLink to="/observatory" variant="secondary">
          Browse the Workforce Observatory
        </ButtonLink>
        <ButtonLink to="/start" variant="accent">
          Begin <span aria-hidden="true">→</span>
        </ButtonLink>
      </div>
    </div>
  );
}
