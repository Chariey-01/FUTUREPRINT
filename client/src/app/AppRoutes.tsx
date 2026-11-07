import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { LoadingState } from '../components/LoadingState';
import PortalPage from '../features/portal/PortalPage';

// The portal is eager (it is the LCP page); everything else is split per route.
const LAZY_ROUTES: [string, LazyExoticComponent<ComponentType>][] = [
  ['start', lazy(() => import('../features/occupations/OccupationsPage'))],
  ['simulate', lazy(() => import('../features/simulator/SimulatorPage'))],
  ['report', lazy(() => import('../features/report/ReportPage'))],
  ['observatory', lazy(() => import('../features/observatory/ObservatoryPage'))],
  ['occupations/:slug', lazy(() => import('../features/task-scanner/TaskScannerPage'))],
  ['methodology', lazy(() => import('../features/methodology/MethodologyPage'))],
  ['signin', lazy(() => import('../features/auth/SignInPage'))],
  ['*', lazy(() => import('./NotFoundPage'))],
];

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<PortalPage />} />
        {LAZY_ROUTES.map(([path, Page]) => (
          <Route
            key={path}
            path={path}
            element={
              <Suspense fallback={<LoadingState label="Loading" />}>
                <Page />
              </Suspense>
            }
          />
        ))}
      </Route>
    </Routes>
  );
}
