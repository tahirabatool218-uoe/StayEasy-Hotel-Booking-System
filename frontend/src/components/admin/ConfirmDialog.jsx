import { useEffect } from 'react';
import Button from '../ui/Button';

// Confirmation dialog shared by every destructive action in the admin panel
// (deleting a hotel, room, booking, review or user).
//
// Show it by setting `open`; Escape and an overlay click dismiss it, and both
// are blocked while `submitting` so a request in flight cannot be abandoned
// halfway through. Reuses the .modal-overlay / .modal styles from bookings.css.
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Yes, delete',
  confirmVariant = 'danger',
  cancelLabel = 'Cancel',
  submitting = false,
  onConfirm,
  onDismiss,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onDismiss();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onDismiss]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!submitting) onDismiss();
      }}
      role="presentation"
    >
      {/* stopPropagation so clicks inside the panel do not dismiss it */}
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-dialog-title">{title}</h3>
        <p>{description}</p>
        <div className="modal-actions">
          <Button variant="outline" onClick={onDismiss} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={submitting}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
