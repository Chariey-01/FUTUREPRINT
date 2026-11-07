import { m } from 'framer-motion';
import type { ReactNode } from 'react';

type Tone = 'choices' | 'research' | 'suggested';

const TONES: Record<Tone, { wrap: string; eyebrow: string }> = {
  choices: { wrap: 'bg-ivory-50 border border-midnight/10', eyebrow: 'text-midnight/80' },
  research: { wrap: 'bg-midnight text-ivory-50 on-dark', eyebrow: 'text-adapt' },
  suggested: {
    wrap: 'bg-discover-soft border border-discover-ink/20',
    eyebrow: 'text-discover-ink',
  },
};

interface Props {
  id: string;
  tone: Tone;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}

export function ReportSection({ id, tone, eyebrow, title, intro, children }: Props) {
  const t = TONES[tone];
  return (
    <m.section
      aria-labelledby={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`rounded-4xl p-6 sm:p-10 ${t.wrap}`}
      data-section={tone}
    >
      <p className={`eyebrow ${t.eyebrow}`}>{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl font-semibold sm:text-4xl">
        {title}
      </h2>
      {intro && (
        <p
          className={`mt-3 max-w-2xl ${tone === 'research' ? 'text-ivory-200' : 'text-midnight/80'}`}
        >
          {intro}
        </p>
      )}
      <div className="mt-8">{children}</div>
    </m.section>
  );
}
