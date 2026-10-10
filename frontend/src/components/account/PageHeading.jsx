// Consistent title block for every My Account page. `leading` (optional) sits
// to the left of the title, e.g. the person's avatar on the dashboard.
export default function PageHeading({ title, description, children, leading }) {
  const text = (
    <div>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );

  return (
    <header className="account-heading">
      {leading ? (
        <div className="account-heading-main">
          {leading}
          {text}
        </div>
      ) : (
        text
      )}
      {children && <div className="account-heading-actions">{children}</div>}
    </header>
  );
}
