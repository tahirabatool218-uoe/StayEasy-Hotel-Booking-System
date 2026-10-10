export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="ui-state ui-empty-state">
      {icon && <div className="ui-state-icon">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}
