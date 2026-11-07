import { m } from 'framer-motion';
import type { ReactNode } from 'react';

type Tone = 'choices' | 'research' | 'suggested';

/** Each content group has its own visual identity so they're never confused. */
const TONES: Record<Tone, { wrap: string; eyebrow: string; intro: string }> = {
  choices: {
    wrap: 'bg-ivory-50 border border-midnight/10',
    eyebrow: 'text-midnight/80',
    intro: 'text-midnight/80',
  },
  research: {
    // Ink-friendly when printed: dark panel becomes a bordered white panel.
    wrap: 'bg-midnight text-ivory-50 on-dark print:border-2 print:border-midnight print:bg-white print:text-midnight',
    eyebrow: 'text-adapt print:text-adapt-ink',
    intro: 'text-ivory-200 print:text-midnight',
  },
  suggested: {
    wrap: 'bg-discover-soft border border-discover-ink/20 print:bg-white',
    eyebrow: 'text-discover-ink',
    intro: 'text-midnight/80',
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
      // Plain `animate` (not whileInView): off-screen sections must be visible when printed.
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`rounded-4xl p-6 sm:p-10 print:rounded-none print:p-6 ${t.wrap}`}
      data-section={tone}
    >
      <p className={`eyebrow ${t.eyebrow}`}>{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl font-bold sm:text-5xl">
        {title}
      </h2>
      {intro && <p className={`mt-3 max-w-2xl text-lg ${t.intro}`}>{intro}</p>}
      <div className="mt-8">{children}</div>
    </m.section>
  );
}
