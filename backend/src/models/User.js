const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getBcryptRounds } = require('../config/env');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // HTTPS URL of the account's avatar in Cloudinary. Empty = no picture (the
    // UI shows initials). Accounts created before this field existed have no
    // value, which reads the same as ''. Only ever written through
    // PUT /api/users/profile, which accepts nothing but this user's own
    // Cloudinary avatar URL (see utils/profileImage.js).
    profileImage: {
      type: String,
      trim: true,
      default: '',
    },
    // Set when an existing account changes its password. Tokens issued before
    // this moment are rejected (see authMiddleware). Absent on accounts that
    // have never changed their password, so existing users are unaffected.
    passwordChangedAt: {
      type: Date,
    },
    // Deactivated accounts cannot sign in and their tokens stop working.
    // Accounts created before this field existed have no value; they count as
    // active (always test with `isUserActive`, never `=== true`).
    isActive: {
      type: Boolean,
      default: true,
    },
    deactivatedAt: {
      type: Date,
    },
    // Set when the user closed their own account (anonymised, see
    // userController.deleteMyAccount). Such an account can never be reactivated.
    closedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  // Cost factor comes from BCRYPT_ROUNDS (default 12). Hashes already stored
  // with another cost keep verifying, since the cost lives inside each hash.
  const salt = await bcrypt.genSalt(getBcryptRounds());
  this.password = await bcrypt.hash(this.password, salt);

  // A brand-new user has no earlier tokens to invalidate.
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Old accounts have no `isActive` field: only an explicit false means deactivated.
userSchema.statics.isUserActive = (user) => Boolean(user) && user.isActive !== false;

module.exports = mongoose.model('User', userSchema);
