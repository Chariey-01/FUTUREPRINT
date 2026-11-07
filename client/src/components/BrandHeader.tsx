import { Link, NavLink } from 'react-router-dom';
import { useSessionToken } from '../lib/sessionToken';

const SECTIONS = [
  { href: '/#about', label: 'About' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#research', label: 'The Research' },
];

export function BrandHeader({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { token } = useSessionToken();
  const dark = variant === 'dark';
  const linkCls = `rounded-full px-2 py-2 text-sm font-medium transition-colors sm:px-3 sm:text-base ${
    dark ? 'hover:bg-ivory-50/10' : 'hover:bg-midnight/5'
  }`;

  return (
    <header className={`relative z-20 ${dark ? 'bg-midnight text-ivory-50' : 'text-midnight'}`}>
      <div className="container-page flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 sm:min-h-24">
        <Link to="/" className="flex items-center gap-3" aria-label="FUTUREPRINT home">
          <LogoMark />
          <span className="text-lg font-semibold tracking-[0.22em] sm:text-2xl">FUTUREPRINT</span>
        </Link>
        <nav aria-label="Main" className="-mx-2 sm:mx-0">
          <ul className="flex flex-wrap items-center gap-x-1 sm:gap-x-4 lg:gap-x-8">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a href={s.href} className={linkCls}>
                  {s.label}
                </a>
              </li>
            ))}
            {token && (
              <li>
                <NavLink
                  to="/simulate"
                  className={({ isActive }) =>
                    `${linkCls} ${isActive ? 'underline decoration-2 underline-offset-8' : ''}`
                  }
                >
                  My journey
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}

/** Three slanted strokes — one per pathway (Adapt, Transform, Discover). */
export function LogoMark() {
  return (
    <svg
      viewBox="0 0 64 36"
      className="h-8 w-14 sm:h-10 sm:w-16"
      aria-hidden="true"
      focusable="false"
    >
      <g strokeWidth="11" strokeLinecap="round">
        <path d="M8 28 L22 8" stroke="#A99BCB" />
        <path d="M24 28 L38 8" stroke="#E7A18F" />
        <path d="M40 28 L54 8" stroke="#8DB89B" />
      </g>
    </svg>
  );
}
