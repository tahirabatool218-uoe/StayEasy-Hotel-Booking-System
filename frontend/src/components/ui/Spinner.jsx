export default function Spinner({ size = 'md', label = 'Loading' }) {
  return (
    <span className={`ui-spinner ui-spinner-${size}`} role="status" aria-label={label}>
      <span className="ui-spinner-ring" aria-hidden="true" />
    </span>
  );
}
