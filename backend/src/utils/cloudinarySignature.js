const crypto = require('crypto');

// Cloudinary signed-upload signature.
// https://cloudinary.com/documentation/authentication_signatures
//
// Sort the parameters alphabetically, join them as "key=value" with "&",
// append the API secret and take the SHA-1 hex digest. `file`, `cloud_name`,
// `resource_type` and `api_key` are never part of the signed string.
const EXCLUDED = new Set(['file', 'cloud_name', 'resource_type', 'api_key']);

const signUploadParams = (params, apiSecret) => {
  const toSign = Object.keys(params)
    .filter((key) => !EXCLUDED.has(key) && params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${Array.isArray(params[key]) ? params[key].join(',') : params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
};

module.exports = { signUploadParams };
