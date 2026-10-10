import PageHeading from '../../components/account/PageHeading';
import ProfileDetailsForm from '../../components/account/ProfileDetailsForm';
import ProfileImageManager from '../../components/account/ProfileImageManager';

export default function EditProfilePage() {
  return (
    <>
      <PageHeading title="Edit profile" description="Update your photo, name and email address." />
      <section className="card acct-section acct-narrow" aria-labelledby="edit-photo-heading">
        <div className="acct-section-head">
          <h2 id="edit-photo-heading">Profile photo</h2>
        </div>
        <ProfileImageManager />
      </section>
      <section className="card acct-section acct-narrow">
        <ProfileDetailsForm cancelTo="/account/profile" />
      </section>
    </>
  );
}
