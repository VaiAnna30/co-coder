const express = require('express');
// JWT is used for generating and verifying JSON Web Tokens for authentication. It allows us to create signed tokens that clients can use to authenticate their requests to protected routes.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
// This Protect middleware is used to secure routes by verifying the JWT token sent in the Authorization header of requests. It ensures that only authenticated users can access certain endpoints and attaches the user information to the request object for use in route handlers.
const { protect } = require('../middleware/auth');
const crypto = require('crypto');
const { redisClient } = require('../config/redis');
const { producer } = require('../config/kafka');

const router = express.Router();

// ─── Helper: generate a signed JWT ────────────────────────────────────────────
// This function take user ID as input and generate the token based on the secret key and return the signed JWT token as the output that will expire in 7 days. The token can then be sent to the client to be used for authenticating future requests to protected routes.
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Register a new user. Returns user info + JWT.
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Please provide username, email, and password' });
    }

    // Check for existing user by email or username
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      const field =
        existingUser.email === email ? 'email' : 'username';
      return res
        .status(400)
        .json({ message: `A user with that ${field} already exists` });
    }

    // Create user (password hashed by pre-save hook)
    const user = await User.create({ username, email, password });

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Store OTP in Redis with 10 minutes expiration
    await redisClient.setEx(`otp:${email}`, 600, otp);

    // Publish event to Kafka
    await producer.send({
      topic: 'auth-events',
      messages: [
        {
          key: email,
          value: JSON.stringify({ type: 'USER_REGISTERED', email, otp }),
        },
      ],
    });

    res.status(201).json({
      message: 'Registration successful. Please check your email for the OTP to verify your account.',
      email: user.email,
    });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Authenticate user with email + password. Returns user info + JWT.

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Please provide email and password' });
    }

    // Find user by email (include password for comparison)
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(401).json({ message: 'Please verify your email before logging in.' });
    }

    // Compare plaintext password to stored hash
    // The matchPassword method is defined in the User model and uses bcrypt to compare the plaintext password provided by the user during login with the hashed password stored in the database. It returns true if the passwords match and false otherwise. This is a crucial step in the authentication process to verify that the user has provided the correct password before granting access to protected resources.
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      token: generateToken(user._id),
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ─── POST /api/auth/verify-email ──────────────────────────────────────────────
router.post('/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and otp' });
    }

    const storedOtp = await redisClient.get(`otp:${email}`);

    if (!storedOtp) {
      return res.status(400).json({ message: 'OTP has expired or is invalid' });
    }

    if (storedOtp !== otp) {
      return res.status(400).json({ message: 'Incorrect OTP' });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clear OTP from Redis
    await redisClient.del(`otp:${email}`);

    res.json({
      message: 'Email verified successfully',
      token: generateToken(user._id),
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Verify email error:', error.message);
    res.status(500).json({ message: 'Server error during verification' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Return the currently authenticated user's profile.
// This route is protected by the protect middleware, which verifies the JWT token sent in the Authorization header of the request. If the token is valid, the middleware attaches the decoded user information to req.user. The route handler then returns the user's profile information (excluding the password) in the response. This allows clients to fetch the current user's profile data after they have logged in and obtained a token.
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      user: {
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
      },
    });
  } catch (error) {
    console.error('Get me error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
