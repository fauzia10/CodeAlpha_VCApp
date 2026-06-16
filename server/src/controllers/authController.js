const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper to sign JWT tokens (30 days expiration)
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'supersecretcodealphaprivatekeyforjsonwebtoken',
    { expiresIn: '30d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please provide username, email, and password' });
    }

    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid input types' });
    }

    if (global.isMockDB) {
      global.mockUsers = global.mockUsers || [];
      const userExists = global.mockUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === username.toLowerCase()
      );
      if (userExists) {
        return res.status(400).json({ message: 'User with this email or username already exists' });
      }

      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const mockId = require('crypto').randomBytes(12).toString('hex');
      const newUser = {
        _id: mockId,
        username,
        email,
        password: hashedPassword,
        avatarUrl: '',
      };
      global.mockUsers.push(newUser);

      return res.status(201).json({
        token: generateToken(mockId),
        user: {
          id: mockId,
          username: newUser.username,
          email: newUser.email,
          avatarUrl: newUser.avatarUrl,
        },
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }

    // Create user (triggers the pre-save bcrypt hash middleware)
    const user = await User.create({
      username,
      email,
      password,
    });

    if (user) {
      return res.status(201).json({
        token: generateToken(user._id),
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      });
    } else {
      return res.status(400).json({ message: 'Invalid user data provided' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid input types' });
    }

    if (global.isMockDB) {
      global.mockUsers = global.mockUsers || [];
      const user = global.mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (user) {
        const bcrypt = require('bcryptjs');
        const matches = await bcrypt.compare(password, user.password);
        if (matches) {
          return res.json({
            token: generateToken(user._id),
            user: {
              id: user._id,
              username: user.username,
              email: user.email,
              avatarUrl: user.avatarUrl,
            },
          });
        }
      }
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Find user by email
    const user = await User.findOne({ email });

    // Check if password matches using schema helper
    if (user && (await user.matchPassword(password))) {
      return res.json({
        token: generateToken(user._id),
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      });
    } else {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    if (global.isMockDB) {
      global.mockUsers = global.mockUsers || [];
      const user = global.mockUsers.find((u) => u._id.toString() === req.user._id.toString());
      if (user) {
        return res.json({
          id: user._id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
        });
      }
      return res.status(404).json({ message: 'User not found' });
    }

    const user = await User.findById(req.user._id);

    if (user) {
      return res.json({
        id: user._id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
    } else {
      return res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
};
