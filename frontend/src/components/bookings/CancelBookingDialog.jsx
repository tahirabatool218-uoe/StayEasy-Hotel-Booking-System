import { useEffect } from 'react';

// A small, focused confirmation dialog — kept local to the booking flow
// rather than a generic modal system, since this is the only place (so far)
// that needs one. `booking` is null when the dialog should be hidden.
export default function CancelBookingDialog({ booking, onConfirm, onDismiss, submitting = false }) {
  useEffect(() => {
    if (!booking) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [booking, submitting, onDismiss]);

  if (!booking) return null;

  return (
    <div className="modal-overlay" role="presentation" onClick={() => !submitting && onDismiss()}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cancel-booking-title">Cancel this booking?</h3>
        <p>
          Are you sure you want to cancel your booking at <strong>{booking.hotel?.name}</strong>? This can&apos;t be
          undone.
        </p>

        <div className="modal-actions">
          <button type="button" className="ui-btn ui-btn-outline" onClick={onDismiss} disabled={submitting}>
            <span className="ui-btn-label">Keep booking</span>
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-danger"
            onClick={onConfirm}
            disabled={submitting}
            aria-busy={submitting}
          >
            <span className="ui-btn-label">{submitting ? 'Cancelling…' : 'Yes, cancel booking'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
