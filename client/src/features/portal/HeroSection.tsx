import { m } from 'framer-motion';
import type { ReactNode } from 'react';
import { ButtonLink } from '../../components/ui/Button';
import { PATHWAYS } from '../../lib/pathways';
import type { PathwayId } from '../../types/api';
import { HorizonScene, LaptopIcon, RocketIcon, SproutIcon } from './HeroIllustration';

const BUBBLES: { id: PathwayId; icon: ReactNode; bg: string; shape: string; offset: string }[] = [
  {
    id: 'adapt',
    icon: <LaptopIcon />,
    bg: 'bg-[#C9BEE3]',
    shape: '[border-radius:58%_42%_47%_53%/52%_44%_56%_48%]',
    offset: 'translate-y-10 sm:translate-y-16 -rotate-2',
  },
  {
    id: 'transform',
    icon: <RocketIcon />,
    bg: 'bg-[#EFB3A2]',
    shape: '[border-radius:46%_54%_42%_58%/55%_48%_52%_45%]',
    offset: '-translate-y-2 rotate-1',
  },
  {
    id: 'discover',
    icon: <SproutIcon />,
    bg: 'bg-[#BFD8C3]',
    shape: '[border-radius:53%_47%_58%_42%/44%_56%_44%_56%]',
    offset: 'translate-y-14 sm:translate-y-24 rotate-2',
  },
];

export function HeroSection() {
  return (
    <section
      className="relative isolate overflow-hidden bg-midnight text-ivory-50"
      aria-labelledby="hero-heading"
    >
      <div className="container-page relative z-10 grid gap-12 pt-6 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:pt-16">
        <div className="relative">
          {/* No entrance animation on the headline: it's the LCP element. */}
          <h1
            id="hero-heading"
            className="text-[2.5rem] font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-[4.25rem]"
          >
            Explore the work that’s changing. Discover the future you{' '}
            <span className="relative inline-block whitespace-nowrap">
              could create.
              <Underline />
            </span>
          </h1>
          <m.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-8 max-w-xl text-lg leading-relaxed text-ivory-200 sm:text-xl"
          >
            An interactive journey into evolving careers, emerging skills and the possibilities
            ahead.
          </m.p>
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative mt-10 inline-flex"
          >
            <ButtonLink to="/start" variant="accent" size="xl">
              Begin <span aria-hidden="true">→</span>
            </ButtonLink>
            <Sparks className="absolute -right-10 -top-6 h-10 w-10 text-transform" />
          </m.div>
        </div>

        <ul className="relative mx-auto grid w-full max-w-xl grid-cols-3 gap-1 pb-16 sm:gap-2 lg:mt-16">
          <Sparks className="absolute -top-12 left-[18%] h-12 w-12 text-[#F2C27A]" />
          {BUBBLES.map((b, i) => {
            const p = PATHWAYS[b.id];
            return (
              <m.li
                key={b.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.12, ease: 'easeOut' }}
                className={b.offset}
              >
                <div
                  className={`flex aspect-[5/6] flex-col items-center justify-center px-2 text-center text-midnight shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] ${b.bg} ${b.shape}`}
                >
                  {b.icon}
                  <span className="mt-1 text-lg font-bold sm:mt-2 sm:text-2xl">{p.name}</span>
                  <span className="mt-1 hidden max-w-[12ch] text-sm leading-snug sm:block">
                    {p.tagline}
                  </span>
                </div>
              </m.li>
            );
          })}
        </ul>
      </div>

      <HorizonScene className="relative -mt-10 block h-[220px] w-full sm:-mt-24 sm:h-[300px] lg:-mt-40 lg:h-[380px]" />
    </section>
  );
}

function Underline() {
  return (
    <svg
      viewBox="0 0 300 24"
      className="absolute -bottom-3 left-0 h-4 w-full text-adapt sm:-bottom-4"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 16 C80 6 180 4 296 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Sparks({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={`pointer-events-none ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M10 6 L13 16" />
        <path d="M24 8 L19 17" />
        <path d="M32 20 L22 22" />
      </g>
    </svg>
  );
}
