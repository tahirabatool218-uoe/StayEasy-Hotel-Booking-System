export default function ErrorState({ title = 'Something went wrong', description, onRetry }) {
  return (
    <div className="ui-state ui-error-state">
      <div className="ui-state-icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {onRetry && (
        <button type="button" className="ui-btn ui-btn-outline" onClick={onRetry}>
          <span className="ui-btn-label">Try again</span>
        </button>
      )}
    </div>
  );
}
