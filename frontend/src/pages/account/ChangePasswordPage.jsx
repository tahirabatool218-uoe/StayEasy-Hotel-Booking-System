import PageHeading from '../../components/account/PageHeading';
import ChangePasswordForm from '../../components/account/ChangePasswordForm';

export default function ChangePasswordPage() {
  return (
    <>
      <PageHeading title="Change password" description="Choose a strong password you don't use anywhere else." />
      <section className="card acct-section acct-narrow">
        <ChangePasswordForm />
      </section>
    </>
  );
}
