import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { useResetJourney } from '../../hooks/useSession';
import { ApiRequestError, isSessionGone } from '../../lib/api';
import { useSessionToken } from '../../lib/sessionToken';
import { ReportView } from './ReportView';
import { useReport } from './useReport';

export default function ReportPage() {
  const { token, endReason } = useSessionToken();
  const report = useReport();
  const navigate = useNavigate();
  const reset = useResetJourney();

  let body: React.ReactNode;
  if (!token) {
    body = (
      <EmptyState
        title={endReason === 'expired' ? 'Your journey has expired' : 'No Futureprint yet'}
        message="Make your decisions in the simulator to generate your personal report."
        action={
          <Link to="/start" className="btn-primary">
            Start a journey
          </Link>
        }
      />
    );
  } else if (report.isPending) {
    body = <LoadingState label="Composing your Futureprint" />;
  } else if (report.isError) {
    const err = report.error;
    body =
      err instanceof ApiRequestError && err.code === 'SESSION_INCOMPLETE' ? (
        <EmptyState
          title="Almost there"
          message="Finish your decisions in the simulator to unlock your Futureprint."
          action={
            <Link to="/simulate" className="btn-primary">
              Continue my journey
            </Link>
          }
        />
      ) : isSessionGone(err) ? (
        <EmptyState
          title="Your journey has expired"
          message="Start a fresh journey whenever you like."
          action={
            <Link to="/start" className="btn-primary">
              Start a new journey
            </Link>
          }
        />
      ) : (
        <ErrorState
          title="We couldn’t compose your Futureprint"
          message={err.message}
          onRetry={() => void report.refetch()}
        />
      );
  } else {
    body = (
      <ReportView
        report={report.data}
        mode="owner"
        onReplay={() => {
          reset();
          navigate('/start');
        }}
      />
    );
  }

  return <div className="container-page pb-24 pt-4 sm:pt-8 print:p-0">{body}</div>;
}
