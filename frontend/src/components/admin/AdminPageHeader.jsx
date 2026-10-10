// Title block shared by all six admin pages, with an optional action slot on
// the right so "Add hotel" / "Add room" buttons stay in a consistent place.
export default function AdminPageHeader({ title, description, children }) {
  return (
    <div className="admin-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="admin-page-actions">{children}</div>}
    </div>
  );
}
