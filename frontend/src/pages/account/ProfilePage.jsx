import { Link } from 'react-router-dom';
import PageHeading from '../../components/account/PageHeading';
import StateBlock from '../../components/account/StateBlock';
import ProfileImageManager from '../../components/account/ProfileImageManager';
import useApiData from '../../hooks/useApiData';
import userService from '../../services/userService';
import { formatShortDate } from '../../utils/booking';

const ERR = 'We could not load your profile. Please try again.';

export default function ProfilePage() {
  const { status, data, error, reload } = useApiData(userService.getProfile, ERR);

  return (
    <>
      <PageHeading title="Profile" description="The details attached to your StayEasy account.">
        <Link to="/account/profile/edit" className="ui-btn ui-btn-primary"><span className="ui-btn-label">Edit profile</span></Link>
      </PageHeading>
      <section className="card acct-section" aria-labelledby="profile-photo-heading">
        <div className="acct-section-head">
          <h2 id="profile-photo-heading">Profile photo</h2>
        </div>
        <ProfileImageManager />
      </section>
      <StateBlock status={status} error={error} onRetry={reload} label="Loading your profile">
        {data && (
          <section className="card acct-section">
            <dl className="detail-list">
              <div className="detail-row"><dt>Full name</dt><dd>{data.name}</dd></div>
              <div className="detail-row"><dt>Email</dt><dd>{data.email}</dd></div>
              <div className="detail-row"><dt>Account type</dt><dd className="capitalize">{data.role === 'admin' ? 'Administrator' : 'Guest'}</dd></div>
              <div className="detail-row"><dt>Member since</dt><dd>{formatShortDate(data.createdAt)}</dd></div>
            </dl>
            <div className="form-actions">
              <Link to="/account/password" className="ui-btn ui-btn-outline"><span className="ui-btn-label">Change password</span></Link>
              <Link to="/account/close" className="ui-btn ui-btn-ghost"><span className="ui-btn-label">Close account</span></Link>
            </div>
          </section>
        )}
      </StateBlock>
    </>
  );
}
