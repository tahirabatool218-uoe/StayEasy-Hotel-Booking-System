import Spinner from '../ui/Spinner';
import ErrorState from '../ui/ErrorState';

// Loading / error wrapper used by every data-driven account page.
export default function StateBlock({ status, error, onRetry, label = 'Loading', children }) {
  if (status === 'loading') {
    return (
      <div className="account-state">
        <Spinner size="lg" label={label} />
      </div>
    );
  }
  if (status === 'error') {
    return <ErrorState description={error} onRetry={onRetry} />;
  }
  return children;
}
