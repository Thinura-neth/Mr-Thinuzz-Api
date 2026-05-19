// server-with-auth.js - Main server with Firebase authentication
// Original code එකට කිසිම වෙනසක් නොකර auth එක add කරයි

const express = require('express');
const path = require('path');
const cors = require('cors');

// Import original app
const originalApp = require('./index');

// Import auth middleware and routes
const authMiddleware = require('./middleware/firebase-auth');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// ============ AUTH ROUTES (Public - No API key needed) ============
app.use('/auth', authRoutes);

// ============ PUBLIC INFO ENDPOINTS ============
app.get('/health', (req, res) => {
  res.json({
    status: true,
    timestamp: new Date().toISOString(),
    auth: {
      enabled: true,
      version: '2.0.0',
      firebase: true
    },
    message: 'Authentication enabled. Use X-API-Key header for API calls.'
  });
});

app.get('/api-info', (req, res) => {
  res.json({
    name: 'Mr Thinuzz API',
    version: '3.1.0',
    auth_required: true,
    auth_type: 'API Key',
    auth_endpoints: {
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      verify: 'GET /auth/verify',
      profile: 'GET /auth/profile',
      regenerate: 'POST /auth/regenerate',
      info: 'GET /auth/info'
    },
    rate_limits: {
      FREE: '50 requests/hour',
      BASIC: '500 requests/hour',
      PREMIUM: '5000 requests/hour'
    },
    how_to_use: {
      step1: 'Register: POST /auth/register with email & password',
      step2: 'Save your API key from the response',
      step3: 'Use header: X-API-Key: YOUR_API_KEY for all API calls'
    }
  });
});

app.get('/server-stats', (req, res) => {
  res.json({
    status: true,
    timestamp: new Date().toISOString(),
    server: 'Mr Thinuzz API',
    auth_enabled: true,
    endpoints_available: '/all-apis/cards'
  });
});

// ============ APPLY AUTH MIDDLEWARE TO ALL API REQUESTS ============
app.use((req, res, next) => {
  // Skip auth for these paths
  const skipAuth = [
    '/auth', '/health', '/api-info', '/server-stats', 
    '/all-apis', '/css', '/js', '/'
  ];
  
  if (skipAuth.some(path => req.path === path || req.path.startsWith(path + '/'))) {
    return next();
  }
  
  // Apply auth middleware
  authMiddleware(req, res, next);
});

// ============ FORWARD ALL OTHER REQUESTS TO ORIGINAL APP ============
app.use((req, res) => {
  originalApp(req, res);
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    status: false,
    error: 'Internal server error',
    message: err.message
  });
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     🔐 Mr Thinuzz API with Firebase Auth         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║   🚀 Server: http://localhost:${PORT}              ║`);
  console.log(`║   🔒 Auth: ENABLED (Firebase)                    ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║   📝 Register:  POST /auth/register              ║');
  console.log('║   🔑 Login:     POST /auth/login                 ║');
  console.log('║   🔧 API Key:   X-API-Key header                 ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║   📚 Docs:      /auth/info                       ║');
  console.log('║   ❤️  Health:    /health                          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});
