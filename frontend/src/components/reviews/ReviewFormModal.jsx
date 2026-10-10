import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import StarRating from './StarRating';
import reviewService from '../../services/reviewService';
import { getApiError } from '../../utils/errors';
import { REVIEW_MAX_LENGTH, REVIEW_MIN_LENGTH, isDuplicateReviewError, validateReview } from '../../utils/reviews';

// Create (no `review`) or edit (`review` given) a review. The modal talks to
// the existing review service itself so the hotel page and My Bookings share
// one implementation.
//   hotel / booking : ids, only used when creating
//   onSaved(review, mode)  : called after a successful create/update
//   onDuplicate()          : backend says this booking already has a review
export default function ReviewFormModal({ open, hotelName, hotel, booking, review, onClose, onSaved, onDuplicate }) {
  const isEdit = Boolean(review);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setRating(review?.rating || 0);
    setComment(review?.comment || '');
    setError('');
    setSubmitting(false);
  }, [open, review]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validateReview({ rating, comment });
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = { rating, comment: comment.trim() };
      const saved = isEdit
        ? await reviewService.updateReview(review._id, payload)
        : await reviewService.createReview({ hotel, booking, ...payload });
      onSaved(saved, isEdit ? 'edit' : 'create');
    } catch (err) {
      if (!isEdit && isDuplicateReviewError(err)) {
        onDuplicate?.();
        return;
      }
      setError(getApiError(err, "We couldn't save your review. Please try again."));
      setSubmitting(false);
    }
  };

  const length = comment.trim().length;

  return (
    <div className="modal-overlay" role="presentation" onClick={() => !submitting && onClose()}>
      <div
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="review-form-title">{isEdit ? 'Edit your review' : 'Write a review'}</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose} disabled={submitting}>
            <Icon name="close" size={18} />
          </button>
        </div>
        {hotelName && <p className="review-form-hotel">{hotelName}</p>}

        <form onSubmit={handleSubmit} noValidate className="review-form">
          <div className="form-field">
            <span className="review-form-label" id="review-rating-label">
              Your rating
            </span>
            <StarRating value={rating} onChange={setRating} size={30} label="Your rating" />
          </div>

          <div className="form-field">
            <label htmlFor="review-comment">Your review</label>
            <textarea
              id="review-comment"
              rows={5}
              value={comment}
              maxLength={REVIEW_MAX_LENGTH + 200}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you like? Anything other guests should know?"
              disabled={submitting}
            />
            <span className={`form-hint review-counter ${length > REVIEW_MAX_LENGTH ? 'is-over' : ''}`}>
              {length}/{REVIEW_MAX_LENGTH} · minimum {REVIEW_MIN_LENGTH} characters
            </span>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}

          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEdit ? 'Save changes' : 'Submit review'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
