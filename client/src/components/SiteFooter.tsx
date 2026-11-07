import { Link } from 'react-router-dom';
import { LogoMark } from './BrandHeader';

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      { to: '/start', label: 'Choose an occupation' },
      { to: '/simulate', label: 'My journey' },
      { to: '/report', label: 'My Futureprint' },
    ],
  },
  {
    title: 'Research',
    links: [
      { to: '/observatory', label: 'Workforce Observatory' },
      { to: '/methodology', label: 'Methodology' },
    ],
  },
  {
    title: 'FUTUREPRINT',
    links: [
      { to: '/#about', label: 'About' },
      { to: '/#how-it-works', label: 'How It Works' },
      { to: '/signin', label: 'Sign in (preview)' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="on-dark bg-midnight text-ivory-50 print:hidden">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.2fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="text-lg font-semibold tracking-[0.2em]">FUTUREPRINT</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-ivory-200">
            The future is not something we predict with certainty. It is something we explore and
            prepare for.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ivory-200">
              {col.title}
            </h2>
            <ul className="mt-4 space-y-1">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="inline-block py-1.5 text-sm hover:underline hover:underline-offset-4"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
