import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { MockModeBadge } from '../components/MockModeBadge';
import { SiteFooter } from '../components/SiteFooter';

const TITLES: Record<string, string> = {
  '/': 'FUTUREPRINT — Explore the work that’s changing',
  '/start': 'Choose an occupation — FUTUREPRINT',
  '/simulate': 'Future scenario simulator — FUTUREPRINT',
  '/report': 'My Futureprint — FUTUREPRINT',
  '/signin': 'Sign in (preview) — FUTUREPRINT',
  '/observatory': 'Workforce Observatory — FUTUREPRINT',
  '/methodology': 'Methodology — FUTUREPRINT',
};

export function AppLayout() {
  const { pathname, hash } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  // Compare against the previous path (not a "first run" flag): StrictMode runs effects twice
  // in development, which made a flag-based check move focus — and scroll — on first load.
  const previousPath = useRef(pathname);

  useEffect(() => {
    document.title =
      TITLES[pathname] ??
      (pathname.startsWith('/occupations/') ? 'Task Scanner — FUTUREPRINT' : 'FUTUREPRINT');
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (hash) return; // the hash effect below handles in-page targets
    // Client-side navigation: start at the top and move focus to the new page for screen readers.
    window.scrollTo?.(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, hash]);

  // In-page anchors such as /#about: scroll to the section and move focus to it.
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView?.({ block: 'start' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);

  const dark = pathname === '/';

  return (
    <div className={`flex min-h-screen flex-col ${dark ? 'on-dark bg-midnight' : ''}`}>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-ivory-50 px-4 py-2 font-semibold text-midnight focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <MockModeBadge />
      <BrandHeader variant={dark ? 'dark' : 'light'} />
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 bg-ivory-100 outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
