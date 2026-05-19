// routes/auth.js
const express = require('express');
const router = express.Router();

const {
  registerUser,
  loginUser,
  validateApiKey,
  regenerateApiKey,
  getUserStats,
  RATE_LIMITS,
  isInitialized
} = require('../config/firebase-realtime');

// Register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  const result = await registerUser(email, password, name);
  
  if (!result.success) {
    return res.status(400).json({
      status: false,
      error: result.error
    });
  }
  
  res.status(201).json({
    status: true,
    message: 'Account created successfully',
    data: result.data,
    note: '⚠️ Save your API Key!'
  });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      status: false,
      error: 'Email and password are required'
    });
  }
  
  const result = await loginUser(email, password);
  
  if (!result.success) {
    return res.status(401).json({
      status: false,
      error: result.error
    });
  }
  
  res.json({
    status: true,
    message: 'Login successful',
    data: result.data
  });
});

// Verify API Key
router.get('/verify', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      status: false,
      error: 'API Key required'
    });
  }
  
  const validation = await validateApiKey(apiKey);
  
  if (!validation.valid) {
    return res.status(401).json({
      status: false,
      error: validation.error
    });
  }
  
  res.json({
    status: true,
    valid: true,
    data: {
      email: validation.user.email,
      tier: validation.user.tier,
      userId: validation.user.id
    }
  });
});

// Profile
router.get('/profile', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      status: false,
      error: 'API Key required'
    });
  }
  
  const validation = await validateApiKey(apiKey);
  
  if (!validation.valid) {
    return res.status(401).json({
      status: false,
      error: validation.error
    });
  }
  
  const stats = await getUserStats(apiKey);
  
  res.json({
    status: true,
    data: {
      userId: validation.user.id,
      email: validation.user.email,
      name: validation.user.name,
      tier: validation.user.tier,
      totalRequests: stats?.totalRequests || 0,
      apiKey: validation.user.apiKey
    }
  });
});

// Regenerate API Key
router.post('/regenerate', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      status: false,
      error: 'Email and password are required'
    });
  }
  
  const result = await regenerateApiKey(email, password);
  
  if (!result.success) {
    return res.status(401).json({
      status: false,
      error: result.error
    });
  }
  
  res.json({
    status: true,
    message: 'API Key regenerated successfully',
    data: result.data,
    note: '⚠️ Your old API key is no longer valid'
  });
});

// Auth Info
router.get('/info', (req, res) => {
  res.json({
    status: true,
    auth_enabled: true,
    database: isInitialized ? 'Firebase Realtime Database' : 'In-Memory',
    version: '2.0.0',
    rate_limits: RATE_LIMITS,
    endpoints: {
      register: { method: 'POST', path: '/auth/register', body: { email: 'string', password: 'string', name: 'string' } },
      login: { method: 'POST', path: '/auth/login', body: { email: 'string', password: 'string' } },
      verify: { method: 'GET', path: '/auth/verify', headers: { 'X-API-Key': 'your_api_key' } },
      profile: { method: 'GET', path: '/auth/profile', headers: { 'X-API-Key': 'your_api_key' } },
      regenerate: { method: 'POST', path: '/auth/regenerate', body: { email: 'string', password: 'string' } }
    },
    example: {
      register: 'curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d \'{"email":"user@example.com","password":"123456"}\'',
      api_call: 'curl -X GET "http://localhost:3000/movie/search?q=test" -H "X-API-Key: YOUR_API_KEY"'
    }
  });
});

module.exports = router;
