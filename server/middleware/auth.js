const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Express middleware — verifies the JWT from the Authorization header.
 * Attaches the decoded user document (minus password) to req.user.
 * Expects header format: "Bearer <token>"
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from the Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: 'Not authorized — no token provided' });
    }

    // Verify the token and decode payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request (exclude password hash)
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res
        .status(401)
        .json({ message: 'Not authorized — user not found' });
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res
      .status(401)
      .json({ message: 'Not authorized — token invalid or expired' });
  }
};

module.exports = { protect };
