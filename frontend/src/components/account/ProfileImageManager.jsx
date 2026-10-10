import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_AVATAR_BYTES,
  getAvatarUploadErrorMessage,
  uploadAvatar,
  validateAvatarFile,
} from '../../services/uploadService';
import { getApiError } from '../../utils/errors';
import Avatar from '../ui/Avatar';
import Notice from '../ui/Notice';

// Upload / preview / replace / remove the signed-in person's profile picture.
// Used by the customer Profile pages and the Admin profile page. The picture is
// stored through PUT /users/profile and then written into the auth session, so
// the navbar, sidebar and dashboards update at once with no sign-out needed.
//
// Choosing a file shows it immediately as a local preview (dimmed, with a
// progress bar) while it uploads; the saved picture only changes once the
// server has accepted it.
export default function ProfileImageManager() {
  const { user, updateSession } = useAuth();
  const [preview, setPreview] = useState('');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | uploading | saving | removing
  const [message, setMessage] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const inputRef = useRef(null);
  const controller = useRef(null);
  const previewUrl = useRef('');
  const unmounted = useRef(false);

  const busy = phase !== 'idle';
  const hasImage = Boolean(user?.profileImage);

  const clearPreview = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = '';
    setPreview('');
  };

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      controller.current?.abort();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  const applyProfile = (updated) => {
    updateSession({ _id: updated._id, name: updated.name, email: updated.email, role: updated.role, profileImage: updated.profileImage || '' });
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file || busy) return;

    setMessage(null);
    setConfirmRemove(false);
    const problem = validateAvatarFile(file);
    if (problem) {
      setMessage({ type: 'error', text: problem });
      return;
    }

    clearPreview();
    previewUrl.current = URL.createObjectURL(file);
    setPreview(previewUrl.current);
    setProgress(0);
    setPhase('uploading');
    controller.current = new AbortController();
    let stage = 'upload';

    try {
      const url = await uploadAvatar(file, { signal: controller.current.signal, onProgress: setProgress });
      if (unmounted.current) return;
      stage = 'save';
      setPhase('saving');
      const updated = await userService.updateProfileImage(url);
      if (unmounted.current) return;
      applyProfile(updated);
      setMessage({ type: 'success', text: hasImage ? 'Your profile photo has been updated.' : 'Your profile photo has been added.' });
    } catch (err) {
      if (unmounted.current) return;
      // Whichever step failed, the saved picture is unchanged.
      setMessage({
        type: 'error',
        text:
          stage === 'save'
            ? getApiError(err, 'We could not save your photo. Please try again.')
            : getAvatarUploadErrorMessage(err),
      });
    } finally {
      if (!unmounted.current) {
        clearPreview();
        setPhase('idle');
        controller.current = null;
      }
    }
  };

  const cancelUpload = () => controller.current?.abort();

  const handleRemove = async () => {
    setMessage(null);
    setPhase('removing');
    try {
      const updated = await userService.updateProfileImage(null);
      if (unmounted.current) return;
      applyProfile(updated);
      setConfirmRemove(false);
      setMessage({ type: 'success', text: 'Your profile photo has been removed.' });
    } catch (err) {
      if (unmounted.current) return;
      setMessage({ type: 'error', text: getApiError(err, 'We could not remove your photo. Please try again.') });
    } finally {
      if (!unmounted.current) setPhase('idle');
    }
  };

  const shownSrc = preview || user?.profileImage || '';

  return (
    <div className="avatar-manager">
      <Notice type={message?.type} onDismiss={() => setMessage(null)}>{message?.text}</Notice>

      <div className="avatar-manager-row">
        <div className={`avatar-manager-photo ${phase === 'uploading' || phase === 'saving' ? 'is-busy' : ''}`}>
          <Avatar src={shownSrc} name={user?.name} size={96} className="avatar-manager-avatar" />
          {(phase === 'uploading' || phase === 'saving') && (
            <span className="avatar-manager-spinner" role="status" aria-label={phase === 'saving' ? 'Saving photo' : `Uploading photo, ${progress}%`}>
              <span className="ui-spinner-ring" aria-hidden="true" />
            </span>
          )}
        </div>

        <div className="avatar-manager-body">
          {phase === 'uploading' ? (
            <>
              <progress max="100" value={progress} aria-label="Upload progress" className="avatar-manager-progress" />
              <p className="avatar-manager-hint" aria-live="polite">Uploading… {progress}%</p>
              <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={cancelUpload}>
                <span className="ui-btn-label">Cancel</span>
              </button>
            </>
          ) : phase === 'saving' ? (
            <p className="avatar-manager-hint" aria-live="polite">Saving your photo…</p>
          ) : confirmRemove ? (
            <>
              <p className="avatar-manager-hint" role="alert">Remove your profile photo? Your initial will be shown instead.</p>
              <div className="avatar-manager-actions">
                <button type="button" className="ui-btn ui-btn-danger ui-btn-sm" onClick={handleRemove} disabled={busy} aria-busy={phase === 'removing'}>
                  <span className="ui-btn-label">{phase === 'removing' ? 'Removing…' : 'Yes, remove'}</span>
                </button>
                <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setConfirmRemove(false)} disabled={busy}>
                  <span className="ui-btn-label">Keep photo</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="avatar-manager-actions">
                <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
                  <span className="ui-btn-label">{hasImage ? 'Change photo' : 'Upload photo'}</span>
                </button>
                {hasImage && (
                  <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setConfirmRemove(true)} disabled={busy}>
                    <span className="ui-btn-label">Remove</span>
                  </button>
                )}
              </div>
              <p className="avatar-manager-hint">JPG, PNG, WebP, GIF or AVIF · up to {MAX_AVATAR_BYTES / 1024 / 1024} MB</p>
            </>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="uploader-input"
        tabIndex={-1}
        aria-label="Choose a profile photo"
        onChange={handleFile}
      />
    </div>
  );
}
