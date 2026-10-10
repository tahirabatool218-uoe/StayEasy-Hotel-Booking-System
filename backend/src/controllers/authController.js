const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { getBcryptRounds } = require('../config/env');
const { serverError } = require('../utils/httpErrors');
const {
  validateName,
  validateEmail,
  validateNewPassword,
  validateExistingPassword,
} = require('../utils/validators');

// Compared against when the email is unknown, so a login for a missing account
// costs the same bcrypt time as a wrong password and response timing does not
// reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('stayeasy-timing-equaliser', getBcryptRounds());

const authPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  profileImage: user.profileImage || '',
  token: generateToken(user._id),
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (name === undefined || email === undefined || password === undefined) {
      return res.status(400).json({ message: 'Please provide name, email and password' });
    }

    const parsedName = validateName(name);
    if (parsedName.error) return res.status(400).json({ message: parsedName.error });

    const parsedEmail = validateEmail(email);
    if (parsedEmail.error) return res.status(400).json({ message: parsedEmail.error });

    const parsedPassword = validateNewPassword(password);
    if (parsedPassword.error) return res.status(400).json({ message: parsedPassword.error });

    const userExists = await User.findOne({ email: parsedEmail.value });
    if (userExists) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Role is never read from the request: public sign-ups are always 'user'.
    const user = await User.create({
      name: parsedName.value,
      email: parsedEmail.value,
      password: parsedPassword.value,
    });

    return res.status(201).json(authPayload(user));
  } catch (error) {
    // Two simultaneous sign-ups with one email: the unique index catches the loser.
    if (error.code === 11000) {
      return res.status(409).json({ message: 'User already exists' });
    }
    return serverError(res, error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (email === undefined || password === undefined) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const parsedEmail = validateEmail(email);
    const parsedPassword = validateExistingPassword(password);
    if (parsedEmail.error || parsedPassword.error) {
      // Same wording whatever was wrong, so the response teaches nothing about accounts.
      return res.status(400).json({ message: 'Please provide a valid email and password' });
    }

    const user = await User.findOne({ email: parsedEmail.value }).select('+password');
    const passwordMatches = user
      ? await user.matchPassword(parsedPassword.value)
      : await bcrypt.compare(parsedPassword.value, DUMMY_HASH).then(() => false);

    if (!user || !passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Checked only after the password matched, so a wrong password never
    // reveals whether an account is deactivated.
    if (user.isActive === false) {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact support.' });
    }

    return res.status(200).json(authPayload(user));
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Get currently authenticated user's profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    // req.user is attached by the `protect` middleware and already excludes password
    return res.status(200).json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      profileImage: req.user.profileImage || '',
      createdAt: req.user.createdAt,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = { registerUser, loginUser, getMe };
