// Hotel and room amenities/images are arrays in the API, but read far better in
// a form as one comma-separated line. These two helpers are the only place that
// conversion is defined, so the create and edit forms cannot disagree.

export const parseList = (value) =>
  String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const formatList = (value) => (Array.isArray(value) ? value.join(', ') : '');
