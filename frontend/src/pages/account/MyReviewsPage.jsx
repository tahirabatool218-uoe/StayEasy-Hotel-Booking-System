import { Link } from 'react-router-dom';
import PageHeading from '../../components/account/PageHeading';
import StateBlock from '../../components/account/StateBlock';
import StarRating from '../../components/reviews/StarRating';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/ui/Icon';
import useApiData from '../../hooks/useApiData';
import reviewService from '../../services/reviewService';
import { formatShortDate, formatShortStayDate } from '../../utils/booking';

const ERR = 'We could not load your reviews. Please try again.';

// GET /reviews/my returns only the caller's reviews, hidden ones included.
// A hidden review is invisible to everyone else, so it is labelled clearly.
export default function MyReviewsPage() {
  const { status, data, error, reload } = useApiData(reviewService.getMyReviews, ERR);

  return (
    <>
      <PageHeading title="My Reviews" description="What you've shared about the places you've stayed." />
      <StateBlock status={status} error={error} onRetry={reload} label="Loading your reviews">
        {data?.length === 0 ? (
          <EmptyState
            icon={<Icon name="star" size={26} />}
            title="No reviews yet"
            description="After a stay is completed you can review it from My Bookings."
            action={<Link to="/account/bookings?status=completed" className="ui-btn ui-btn-primary"><span className="ui-btn-label">View completed stays</span></Link>}
          />
        ) : (
          <ul className="review-list">
            {data?.map((review) => {
              const hidden = review.status === 'hidden';
              const hotel = review.hotel;
              return (
                <li key={review._id} className="card review-item">
                  <div className="review-item-head">
                    <div>
                      <h2>{hotel?.name || 'Hotel'}</h2>
                      {(hotel?.city || hotel?.country) && (
                        <span className="review-item-sub">
                          <Icon name="pin" size={13} /> {[hotel.city, hotel.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                    <Badge tone={hidden ? 'warning' : 'accent'}>{hidden ? 'Hidden' : 'Published'}</Badge>
                  </div>
                  <StarRating value={review.rating} size={18} />
                  <p className="review-item-comment">{review.comment}</p>
                  {hidden && (
                    <p className="review-item-note">
                      This review has been hidden by a moderator. Only you can see it; it isn&apos;t shown on the hotel page.
                    </p>
                  )}
                  <div className="review-item-foot">
                    <span>
                      Posted {formatShortDate(review.createdAt)}
                      {review.booking?.checkInDate && ` · Stay ${formatShortStayDate(review.booking.checkInDate)}`}
                    </span>
                    {hotel?._id && !hidden && <Link to={`/hotels/${hotel._id}`}>View hotel</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </StateBlock>
    </>
  );
}
