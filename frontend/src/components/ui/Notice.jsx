// Inline success / error / info message. Errors are announced immediately
// (role=alert); success and info use role=status so they don't interrupt.
export default function Notice({ type = 'info', children, onDismiss }) {
  if (!children) return null;
  const cls = type === 'success' ? 'success-banner' : type === 'error' ? 'error-banner' : 'info-banner';
  return (
    <div className={cls} role={type === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onDismiss && (
        <button type="button" className="banner-dismiss" onClick={onDismiss} aria-label="Dismiss message">×</button>
      )}
    </div>
  );
}
