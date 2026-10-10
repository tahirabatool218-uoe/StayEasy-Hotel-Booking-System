// Every backend route in this project answers a failure as { message }, so this
// is the single place that turns an axios rejection into something showable.
// Passing the `fallback` keeps a copy of each page's own wording.
export const getApiError = (error, fallback = 'Something went wrong. Please try again.') =>
  error?.response?.data?.message || fallback;
