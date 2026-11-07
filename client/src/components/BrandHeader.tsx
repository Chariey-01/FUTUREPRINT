import { AnimatePresence, m } from 'framer-motion';
import { useEffect, useId, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSessionToken } from '../lib/sessionToken';

const SECTIONS = [
  { href: '/#about', label: 'About' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#research', label: 'The Research' },
];

/** PublicNavbar: inline links from md up, a disclosure menu below. */
export function BrandHeader({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { token } = useSessionToken();
  const { pathname, hash } = useLocation();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const dark = variant === 'dark';

  useEffect(() => setOpen(false), [pathname, hash]);

  const hover = dark ? 'hover:bg-ivory-50/10' : 'hover:bg-midnight/5';
  const linkCls = `block rounded-full px-3 py-2 text-base font-medium transition-colors ${hover}`;

  const links = (
    <>
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
      <li>
        <NavLink
          to="/signin"
          className={({ isActive }) =>
            `block rounded-full border px-4 py-2 text-base font-semibold transition-colors ${
              dark
                ? 'border-ivory-50/40 hover:bg-ivory-50/10'
                : 'border-midnight/25 hover:bg-midnight/5'
            } ${isActive ? (dark ? 'bg-ivory-50/10' : 'bg-midnight/5') : ''}`
          }
        >
          Sign in
        </NavLink>
      </li>
    </>
  );

  return (
    <header
      className={`relative z-30 print:hidden ${dark ? 'bg-midnight text-ivory-50' : 'text-midnight'}`}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4 sm:h-24">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 sm:gap-3"
          aria-label="FUTUREPRINT home"
        >
          <LogoMark />
          <span className="truncate text-base font-semibold tracking-[0.14em] min-[400px]:text-lg min-[400px]:tracking-[0.2em] sm:text-2xl sm:tracking-[0.22em]">
            FUTUREPRINT
          </span>
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-x-2 lg:gap-x-6">{links}</ul>
        </nav>

        <button
          type="button"
          className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-3 font-semibold md:hidden ${hover}`}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((o) => !o)}
        >
          <span>Menu</span>
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <m.nav
            id={menuId}
            aria-label="Main menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className={`absolute inset-x-0 top-full border-t px-4 pb-6 pt-3 shadow-lift md:hidden ${
              dark ? 'border-ivory-50/10 bg-midnight' : 'border-midnight/10 bg-ivory-100'
            }`}
          >
            <ul className="flex flex-col gap-1">{links}</ul>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

/** Three slanted strokes, one per pathway (Adapt, Transform, Discover). */
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
