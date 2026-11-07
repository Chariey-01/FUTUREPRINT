import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { LoadingState } from '../components/LoadingState';
import PortalPage from '../features/portal/PortalPage';

// The portal is eager (it is the LCP page); everything else is split per route.
const OccupationsPage = lazy(() => import('../features/occupations/OccupationsPage'));
const SimulatorPage = lazy(() => import('../features/simulator/SimulatorPage'));
const ReportPage = lazy(() => import('../features/report/ReportPage'));
const SignInPage = lazy(() => import('../features/auth/SignInPage'));
const NotFoundPage = lazy(() => import('./NotFoundPage'));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<PortalPage />} />
        <Route
          path="start"
          element={
            <Lazy>
              <OccupationsPage />
            </Lazy>
          }
        />
        <Route
          path="simulate"
          element={
            <Lazy>
              <SimulatorPage />
            </Lazy>
          }
        />
        <Route
          path="report"
          element={
            <Lazy>
              <ReportPage />
            </Lazy>
          }
        />
        <Route
          path="signin"
          element={
            <Lazy>
              <SignInPage />
            </Lazy>
          }
        />
        <Route
          path="*"
          element={
            <Lazy>
              <NotFoundPage />
            </Lazy>
          }
        />
      </Route>
    </Routes>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState label="Loading" />}>{children}</Suspense>;
}
