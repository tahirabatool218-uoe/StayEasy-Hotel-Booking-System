import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container state-block" style={{ minHeight: '60vh' }}>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/" className="ui-btn ui-btn-primary">
        <span className="ui-btn-label">Back home</span>
      </Link>
    </div>
  );
}
