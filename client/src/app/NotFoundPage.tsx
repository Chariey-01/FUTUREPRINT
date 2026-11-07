import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';

export default function NotFoundPage() {
  return (
    <div className="container-page py-16">
      <EmptyState
        title="This future hasn’t been written yet"
        message="The page you were looking for doesn’t exist."
        action={
          <Link to="/" className="btn-primary">
            Back to the portal
          </Link>
        }
      />
    </div>
  );
}
