import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { ApiRequestError, api } from '../../lib/api';
import { ReportView } from './ReportView';

/**
 * Read-only report opened from a share link (/r/:token → GET /api/v1/reports/{token}).
 * The share token is separate from the session token and reveals nothing about the session.
 */
export default function SharedReportPage() {
  const { token = '' } = useParams();
  const report = useQuery({
    queryKey: ['report', 'shared', token],
    queryFn: ({ signal }) => api.getSharedReport(token, signal),
    enabled: !!token,
    staleTime: Infinity,
  });

  let body: React.ReactNode;
  if (report.isPending) {
    body = <LoadingState label="Opening this Futureprint" />;
  } else if (report.isError) {
    body =
      report.error instanceof ApiRequestError && report.error.status === 404 ? (
        <EmptyState
          title="We couldn’t find that report"
          message="The link may be incomplete or no longer valid. Check it, or start your own journey."
          action={
            <Link to="/start" className="btn-primary">
              Explore your own future
            </Link>
          }
        />
      ) : (
        <ErrorState
          title="We couldn’t open this report"
          message={report.error.message}
          onRetry={() => void report.refetch()}
        />
      );
  } else {
    body = <ReportView report={report.data} mode="shared" />;
  }

  return <div className="container-page pb-24 pt-4 sm:pt-8 print:p-0">{body}</div>;
}
