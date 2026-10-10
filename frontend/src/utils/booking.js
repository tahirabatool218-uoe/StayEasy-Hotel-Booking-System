const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Booking dates are calendar dates, not instants: the backend parses
// "YYYY-MM-DD" and stores midnight UTC (see backend/src/utils/bookingValidation.js).
// Formatting them in the browser's local zone shifts them a day backwards for
// anyone behind UTC — a 2026-03-29 check-in renders as "Mar 28" in New York.
// Every stay date therefore formats with timeZone: 'UTC'.
//
// `createdAt` is a real timestamp and is deliberately NOT pinned to UTC; it is
// formatted with formatDate / formatShortDate.
export const calculateNights = (checkIn, checkOut) => {
  const inDate = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const outDate = checkOut instanceof Date ? checkOut : new Date(checkOut);
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) return 0;
  return Math.ceil((outDate.getTime() - inDate.getTime()) / MS_PER_DAY);
};

export const formatPrice = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);

// Real timestamps (when a booking was created). Shown in the visitor's own
// timezone, which is what "booked on" should mean.
export const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatShortDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Calendar dates (check-in / check-out). Pinned to UTC so the day a guest
// arrives never depends on where their browser thinks it is.
export const formatStayDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export const formatShortStayDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

// A booking can only be cancelled by its owner while it hasn't already
// finished or been cancelled — mirrors the backend's updateBooking guard
// (src/controllers/bookingController.js) so the UI never offers an action
// the server would reject.
export const isCancellable = (status) => status === 'pending' || status === 'confirmed';

// Short, human-friendly booking reference derived from the booking id.
export const bookingRef = (id) => (id ? `#${String(id).slice(-8).toUpperCase()}` : '—');
