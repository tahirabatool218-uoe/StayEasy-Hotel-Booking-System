// Shows a guest's name and email from the user object the backend already
// populated on the booking/review. It deliberately makes no requests of its
// own: a cell per table row used to download the whole user list each time.
// A deleted user (populate gives null) or a bare id falls back to the same
// "Guest" / "—" placeholders as before.
export default function UserCell({ user: userRef, classStrong = 'admin-cell-strong', classSub = 'admin-cell-sub' }) {
  const user = userRef && typeof userRef === 'object' ? userRef : null;

  const name = user?.name || 'Guest';
  // Closed accounts keep a placeholder address ending in ".invalid"; never show it.
  const email = !user?.email ? '—' : /\.invalid$/i.test(user.email) ? 'Closed account' : user.email;

  return (
    <>
      <span className={classStrong}>{name}</span>
      <span className={classSub}>{email}</span>
    </>
  );
}
