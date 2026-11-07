import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { MockModeBadge } from '../components/MockModeBadge';

const TITLES: Record<string, string> = {
  '/': 'FUTUREPRINT — Explore the work that’s changing',
  '/start': 'Choose an occupation — FUTUREPRINT',
  '/simulate': 'Future scenario simulator — FUTUREPRINT',
  '/report': 'My Futureprint — FUTUREPRINT',
};

export function AppLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    document.title = TITLES[pathname] ?? 'FUTUREPRINT';
    window.scrollTo?.(0, 0);
    // Move focus to the new page on client-side navigation (not on first load).
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);

  const dark = pathname === '/';

  return (
    <div className={dark ? 'on-dark min-h-screen bg-midnight' : 'min-h-screen'}>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-ivory-50 px-4 py-2 font-semibold text-midnight focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <MockModeBadge />
      <BrandHeader variant={dark ? 'dark' : 'light'} />
      <main id="main" ref={mainRef} tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
    </div>
  );
}
