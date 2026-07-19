import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { LoadingIndicator } from './components/common/LoadingIndicator';
import { SessionLayout } from './context/SessionLayout';
import { SessionDashboardPage } from './pages/SessionDashboardPage';
import { SessionListPage } from './pages/SessionListPage';
import { VarianceReportPage } from './pages/VarianceReportPage';

// Lazy-loaded: @ericblade/quagga2 is the bulk of the app's JS weight and is only needed
// once someone opens the Scan tab, not for the dashboard/report views most sessions live in.
const ScanPage = lazy(() => import('./pages/ScanPage').then((m) => ({ default: m.ScanPage })));

export const router = createBrowserRouter([
  { path: '/', element: <SessionListPage /> },
  {
    path: '/sessions/:id',
    element: <SessionLayout />,
    children: [
      { index: true, element: <SessionDashboardPage /> },
      {
        path: 'scan',
        element: (
          <Suspense fallback={<LoadingIndicator label="Loading scanner…" />}>
            <ScanPage />
          </Suspense>
        ),
      },
      { path: 'report', element: <VarianceReportPage /> },
    ],
  },
]);
