const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header: "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      // Verify token signatures
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'supersecretcodealphaprivatekeyforjsonwebtoken'
      );

      // Find user profile by ID and omit the password field
      if (global.isMockDB) {
        global.mockUsers = global.mockUsers || [];
        const user = global.mockUsers.find(u => u._id === decoded.id);
        if (!user) {
          return res.status(401).json({ message: 'User not found, unauthorized' });
        }
        req.user = { _id: user._id, username: user.username, email: user.email };
      } else {
        req.user = await User.findById(decoded.id).select('-password');
        if (!req.user) {
          return res.status(401).json({ message: 'User not found, unauthorized' });
        }
      }

      return next();
    } catch (error) {
      console.error('JWT verification failed:', error.message);
      return res.status(401).json({ message: 'Not authorized, token validation failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
