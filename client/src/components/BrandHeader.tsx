import { AnimatePresence, m } from 'framer-motion';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';

const SECTIONS = [
  { hash: '#about', label: 'About' },
  { hash: '#how-it-works', label: 'How It Works' },
  { hash: '#research', label: 'The Research' },
];

/**
 * PublicNavbar. Three zones on a full-width grid (1fr | auto | 1fr) so the logo is anchored
 * left, primary links are truly centred, and actions are anchored right, regardless of text
 * length. Full row from 1024px; below that, an accessible disclosure menu.
 */
export function BrandHeader({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { pathname, hash } = useLocation();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const dark = variant === 'dark';

  // Close after any navigation.
  useEffect(() => setOpen(false), [pathname, hash]);

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('a, button')?.focus();
  }, [open]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close(true);
    }
  };

  const sectionActive = (h: string) => pathname === '/' && hash === h;
  const journeyActive = pathname === '/simulate' || pathname === '/report';
  const signinActive = pathname === '/signin';

  const text = dark ? 'text-ivory-50' : 'text-midnight';
  const hoverText = dark ? 'hover:text-ivory-200' : 'hover:text-midnight/70';

  return (
    <header
      onKeyDown={onKeyDown}
      className={`relative z-30 w-full print:hidden ${dark ? 'bg-midnight' : 'bg-ivory'} ${text}`}
    >
      <div className="mx-auto grid h-[72px] w-full max-w-[1600px] grid-cols-[1fr_auto] items-center gap-4 px-5 sm:px-8 lg:h-20 lg:grid-cols-[1fr_auto_1fr] lg:gap-6 lg:px-8 xl:px-12">
        {/* LEFT: brand */}
        <Link
          to="/"
          className="flex min-w-0 items-center gap-3 justify-self-start"
          aria-label="FUTUREPRINT home"
        >
          <LogoMark />
          <span className="truncate text-base font-bold tracking-[0.16em] min-[400px]:text-lg min-[400px]:tracking-[0.22em] sm:text-[1.35rem] sm:tracking-[0.24em] lg:text-xl lg:tracking-[0.2em] xl:text-[1.35rem] xl:tracking-[0.24em]">
            FUTUREPRINT
          </span>
        </Link>

        {/* CENTER: primary navigation (desktop) */}
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-7 xl:gap-12">
            {SECTIONS.map((s) => (
              <li key={s.hash}>
                <NavItem
                  to={`/${s.hash}`}
                  active={sectionActive(s.hash)}
                  current="location"
                  className={hoverText}
                >
                  {s.label}
                </NavItem>
              </li>
            ))}
          </ul>
        </nav>

        {/* RIGHT: user navigation + action (desktop) */}
        <div className="hidden items-center justify-self-end lg:flex">
          <span
            aria-hidden="true"
            className={`mr-6 h-9 w-px xl:mr-10 ${dark ? 'bg-ivory-50/25' : 'bg-midnight/15'}`}
          />
          <NavItem
            to="/simulate"
            active={journeyActive}
            current="page"
            className={`mr-6 inline-flex items-center gap-2.5 xl:mr-10 ${hoverText}`}
          >
            <UserIcon />
            My Journey
          </NavItem>
          <SignInButton dark={dark} active={signinActive} />
        </div>

        {/* Compact: menu toggle */}
        <button
          ref={toggleRef}
          type="button"
          className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 justify-self-end rounded-full px-3 font-semibold lg:hidden ${
            dark ? 'hover:bg-ivory-50/10' : 'hover:bg-midnight/5'
          }`}
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
            ref={menuRef}
            id={menuId}
            aria-label="Main menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className={`absolute inset-x-0 top-full border-t px-5 pb-6 pt-3 shadow-lift sm:px-8 lg:hidden ${
              dark ? 'border-ivory-50/10 bg-midnight' : 'border-midnight/10 bg-ivory'
            }`}
          >
            <ul className="flex flex-col gap-1">
              {SECTIONS.map((s) => (
                <li key={s.hash}>
                  <MenuLink
                    to={`/${s.hash}`}
                    active={sectionActive(s.hash)}
                    current="location"
                    dark={dark}
                  >
                    {s.label}
                  </MenuLink>
                </li>
              ))}
              <li>
                <MenuLink to="/simulate" active={journeyActive} current="page" dark={dark}>
                  <UserIcon />
                  My Journey
                </MenuLink>
              </li>
              <li className="pt-3">
                <SignInButton dark={dark} active={signinActive} block />
              </li>
            </ul>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

interface ItemProps {
  to: string;
  active: boolean;
  current: 'page' | 'location';
  className?: string;
  children: React.ReactNode;
}

/** Desktop link with a coral underline below the text when it reflects the current route. */
function NavItem({ to, active, current, className = '', children }: ItemProps) {
  return (
    <Link
      to={to}
      aria-current={active ? current : undefined}
      className={`group relative inline-flex whitespace-nowrap py-2 text-[17px] font-medium transition-colors duration-200 ${className}`}
    >
      {children}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 -bottom-1 h-[3px] origin-left rounded-full bg-transform transition-transform duration-300 ease-out motion-reduce:transition-none ${
          active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100 group-hover:opacity-50'
        }`}
      />
    </Link>
  );
}

function MenuLink({
  to,
  active,
  current,
  dark,
  children,
}: Omit<ItemProps, 'className'> & { dark: boolean }) {
  return (
    <Link
      to={to}
      aria-current={active ? current : undefined}
      className={`flex min-h-[48px] items-center gap-3 rounded-2xl border-l-[3px] px-4 text-base font-medium transition-colors ${
        active
          ? `border-transform ${dark ? 'bg-ivory-50/10' : 'bg-midnight/5'}`
          : `border-transparent ${dark ? 'hover:bg-ivory-50/10' : 'hover:bg-midnight/5'}`
      }`}
    >
      {children}
    </Link>
  );
}

/** Filled pill. Midnight on ivory; inverted (ivory) on the dark portal header so it stays visible. */
function SignInButton({
  dark,
  active,
  block = false,
}: {
  dark: boolean;
  active: boolean;
  block?: boolean;
}) {
  return (
    <Link
      to="/signin"
      aria-current={active ? 'page' : undefined}
      className={`group inline-flex min-h-[48px] shrink-0 items-center justify-center gap-3 whitespace-nowrap rounded-full px-6 text-base font-semibold transition-colors duration-200 ${
        block ? 'w-full' : ''
      } ${
        dark
          ? 'bg-ivory-50 text-midnight hover:bg-ivory-200'
          : 'bg-midnight text-ivory-50 hover:bg-midnight-700'
      } ${active ? 'ring-2 ring-transform ring-offset-2 ring-offset-transparent' : ''}`}
    >
      Sign in
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12h15M13 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c1.4-3.6 4.4-5.5 8-5.5s6.6 1.9 8 5.5" />
    </svg>
  );
}

/** Three slanted strokes, one per pathway (Adapt, Transform, Discover). Unchanged. */
export function LogoMark() {
  return (
    <svg
      viewBox="0 0 64 36"
      className="h-8 w-14 shrink-0 sm:h-10 sm:w-16"
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
