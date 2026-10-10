import { useAuth } from '../../context/AuthContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ProfileDetailsForm from '../../components/account/ProfileDetailsForm';
import ChangePasswordForm from '../../components/account/ChangePasswordForm';
import ProfileImageManager from '../../components/account/ProfileImageManager';
import Badge from '../../components/ui/Badge';

export default function AdminProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-page">
      <AdminPageHeader title="Admin profile" description="Your administrator account details and password.">
        <Badge tone="accent">Administrator</Badge>
      </AdminPageHeader>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Profile photo</h2>
            <p>Shown in the admin header and menu. Only you can change your own photo.</p>
          </div>
        </div>
        <div className="admin-panel-body admin-narrow">
          <ProfileImageManager />
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Account details</h2>
            <p>Signed in as {user?.email}</p>
          </div>
        </div>
        <div className="admin-panel-body admin-narrow">
          <ProfileDetailsForm />
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Change password</h2>
            <p>You stay signed in on this device; other sessions are signed out.</p>
          </div>
        </div>
        <div className="admin-panel-body admin-narrow">
          <ChangePasswordForm />
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Session</h2>
            <p>Sign out of the Admin Panel on this device.</p>
          </div>
          <button type="button" className="ui-btn ui-btn-outline" onClick={logout}>
            <span className="ui-btn-label">Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
