const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const roomRoutes = require('./src/routes/roomRoutes');
const fileRoutes = require('./src/routes/fileRoutes');
const initSocketService = require('./src/services/socketService');

// Load environment variables
dotenv.config();

// Connect to MongoDB Database
connectDB();

const app = express();

// Enable Cross-Origin Resource Sharing (CORS) first
const corsOptions = {
  origin: [
    'https://codealpha-vcapp.onrender.com',
    'http://localhost:8081',
    'http://localhost:19006',
    'http://10.0.2.2:5000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle pre-flight requests
app.use(express.json());

// Helmet security headers wrapper
app.use(helmet());

// Rate Limiting: general API endpoints (disabled in development)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production', // Disabled in development
});
app.use('/api', apiLimiter);

// Brute-force protection: harder limit on authentication endpoints (disabled in development)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // Limit each IP to 15 login/register attempts per hour
  message: { message: 'Too many authentication attempts from this IP, please try again after an hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production', // Disabled in development
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// HTTPS certificate check and server wrapping options
let server;
const sslPathKey = path.join(__dirname, './ssl/key.pem');
const sslPathCert = path.join(__dirname, './ssl/cert.pem');

if (fs.existsSync(sslPathKey) && fs.existsSync(sslPathCert)) {
  const options = {
    key: fs.readFileSync(sslPathKey),
    cert: fs.readFileSync(sslPathCert),
  };
  server = https.createServer(options, app);
  console.log('Secure HTTPS server wrapper configured');
} else {
  server = http.createServer(app);
  console.log('Standard HTTP server wrapper configured (no SSL certificates found)');
}

// Initialize Socket.io signaling service on HTTP/S server wrapper
initSocketService(server);

// Middleware
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Status / Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Syncora Collaboration Server is active',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/files', fileRoutes);

// Generic Error Handler Middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message || 'An unexpected server error occurred',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
