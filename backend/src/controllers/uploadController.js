const { signUploadParams } = require('../utils/cloudinarySignature');
const { buildAvatarUploadParams } = require('../utils/profileImage');
const { serverError } = require('../utils/httpErrors');

// @desc    Signed parameters for a direct browser -> Cloudinary image upload
// @route   POST /api/uploads/signature
// @access  Private. Body { purpose: 'avatar' } = any signed-in user, for their
//          own profile picture only. No purpose (hotel/room images) = admin only
//          (enforced in uploadRoute.js).
//
// The API secret stays on the server: the browser receives only the cloud
// name, the (public) API key, the timestamp, the folder and the signature.
const getUploadSignature = async (req, res) => {
  try {
    // The route has already enforced who may ask for which kind (see uploadRoute).
    const wantsAvatar = Boolean(req.body) && req.body.purpose === 'avatar' && Boolean(req.user);

    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(503).json({ message: 'Image uploads are not configured on the server' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    if (wantsAvatar) {
      // The public_id is the caller's own id, taken from the verified token,
      // never from the request, so nobody can sign an upload over another
      // user's picture. `params` lists every extra field the browser must send.
      const params = buildAvatarUploadParams(req.user._id);
      const signature = signUploadParams({ ...params, timestamp }, apiSecret);
      return res.status(200).json({
        cloudName,
        apiKey,
        timestamp,
        folder: params.folder,
        signature,
        uploadUrl,
        params,
      });
    }

    const folder = (process.env.CLOUDINARY_UPLOAD_FOLDER || 'stayeasy').trim();
    const signature = signUploadParams({ folder, timestamp }, apiSecret);

    return res.status(200).json({ cloudName, apiKey, timestamp, folder, signature, uploadUrl });
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = { getUploadSignature };
