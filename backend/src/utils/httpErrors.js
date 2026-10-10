// One place that turns an unexpected exception into a client-safe response.
//
// The full error is logged on the server; the client only ever receives a
// generic message, so database error text, connection strings, field values
// and stack traces cannot leak through a 500.
const serverError = (res, error) => {
  console.error('Request failed:', error);

  // A malformed value that slipped past a controller's own checks (for example
  // an object where a string/ObjectId was expected) is the client's fault.
  if (error && error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid value in request' });
  }
  if (error && error.name === 'ValidationError') {
    return res.status(400).json({ message: error.message });
  }
  if (error && error.code === 11000) {
    return res.status(409).json({ message: 'A record with that value already exists' });
  }

  return res.status(500).json({ message: 'Server error' });
};

module.exports = { serverError };
