// config/firebase-realtime.js
// Firebase Realtime Database Configuration

const admin = require('firebase-admin');

// Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCnKZ6wpN8lr4VmgM_Xy2n_TZov_Tx8Ukw",
  authDomain: "mr-thinuzz-api.firebaseapp.com",
  projectId: "mr-thinuzz-api",
  databaseURL: "https://mr-thinuzz-api-default-rtdb.asia-southeast1.firebasedatabase.app/",
  storageBucket: "mr-thinuzz-api.firebasestorage.app",
  messagingSenderId: "16054651666",
  appId: "1:16054651666:web:26ec7e1a5bbd7f717cc1cb"
};

let database = null;
let isInitialized = false;

// Initialize Firebase Admin SDK
try {
  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    try {
      serviceAccount = require('../firebase-service-account.json');
    } catch (e) {
      console.log('⚠️ No service account file found. Running in development mode.');
    }
  }
  
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: firebaseConfig.databaseURL
    });
    database = admin.database();
    isInitialized = true;
    console.log('✅ Firebase Realtime Database initialized');
  } else {
    console.log('⚠️ Firebase not configured. Using in-memory storage.');
  }
} catch (error) {
  console.error('❌ Firebase init error:', error.message);
}

// In-memory storage for development
const inMemoryUsers = new Map();
const inMemoryApiKeys = new Map();
const inMemoryUsage = new Map();
const requestLogs = new Map();

// Rate limits
const RATE_LIMITS = {
  FREE: 50,
  BASIC: 500,
  PREMIUM: 5000
};

// Generate API Key
function generateApiKey() {
  const crypto = require('crypto');
  return 'MT_' + crypto.randomBytes(32).toString('hex');
}

// Hash password
function hashPassword(password) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Register user
async function registerUser(email, password, name = '') {
  if (!email || !password) {
    return { success: false, error: 'Email and password required' };
  }
  
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Invalid email format' };
  }
  
  try {
    if (isInitialized && database) {
      // Check if user exists in Realtime Database
      const usersRef = database.ref('users');
      const snapshot = await usersRef.orderByChild('email').equalTo(email).once('value');
      
      if (snapshot.exists()) {
        return { success: false, error: 'Email already registered' };
      }
      
      const userId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      const apiKey = generateApiKey();
      const hashedPassword = hashPassword(password);
      
      const userData = {
        id: userId,
        email: email,
        name: name || email.split('@')[0],
        password: hashedPassword,
        apiKey: apiKey,
        tier: 'FREE',
        status: 'active',
        createdAt: new Date().toISOString(),
        totalRequests: 0
      };
      
      // Save to Realtime Database
      await database.ref(`users/${userId}`).set(userData);
      await database.ref(`api_keys/${apiKey}`).set(userId);
      await database.ref(`usage/${userId}`).set({
        total: 0,
        daily: {},
        lastReset: new Date().toISOString().split('T')[0]
      });
      
      return {
        success: true,
        data: {
          userId: userId,
          email: email,
          name: userData.name,
          apiKey: apiKey,
          tier: 'FREE',
          createdAt: userData.createdAt
        },
        note: '⚠️ Save your API Key!'
      };
    } else {
      // In-memory mode
      for (const [id, user] of inMemoryUsers) {
        if (user.email === email) {
          return { success: false, error: 'Email already registered' };
        }
      }
      
      const userId = require('crypto').randomBytes(16).toString('hex');
      const apiKey = generateApiKey();
      const hashedPassword = hashPassword(password);
      
      const user = {
        id: userId,
        email,
        name: name || email.split('@')[0],
        password: hashedPassword,
        apiKey,
        tier: 'FREE',
        status: 'active',
        createdAt: new Date().toISOString(),
        totalRequests: 0
      };
      
      inMemoryUsers.set(userId, user);
      inMemoryApiKeys.set(apiKey, user);
      
      return {
        success: true,
        data: {
          userId,
          email,
          name: user.name,
          apiKey,
          tier: 'FREE',
          createdAt: user.createdAt
        }
      };
    }
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: error.message };
  }
}

// Login user
async function loginUser(email, password) {
  const hashedPassword = hashPassword(password);
  
  try {
    if (isInitialized && database) {
      const usersRef = database.ref('users');
      const snapshot = await usersRef.orderByChild('email').equalTo(email).once('value');
      
      if (!snapshot.exists()) {
        return { success: false, error: 'Invalid email or password' };
      }
      
      let userData = null;
      let userId = null;
      
      snapshot.forEach((child) => {
        userData = child.val();
        userId = child.key;
      });
      
      if (userData.password !== hashedPassword) {
        return { success: false, error: 'Invalid email or password' };
      }
      
      if (userData.status !== 'active') {
        return { success: false, error: 'Account is disabled' };
      }
      
      // Update last active
      await database.ref(`users/${userId}`).update({
        lastActive: new Date().toISOString()
      });
      
      return {
        success: true,
        data: {
          userId: userId,
          email: userData.email,
          name: userData.name,
          apiKey: userData.apiKey,
          tier: userData.tier,
          totalRequests: userData.totalRequests || 0
        }
      };
    } else {
      // In-memory mode
      for (const [id, user] of inMemoryUsers) {
        if (user.email === email && user.password === hashedPassword) {
          if (user.status !== 'active') {
            return { success: false, error: 'Account is disabled' };
          }
          
          return {
            success: true,
            data: {
              userId: user.id,
              email: user.email,
              name: user.name,
              apiKey: user.apiKey,
              tier: user.tier,
              totalRequests: user.totalRequests || 0
            }
          };
        }
      }
      
      return { success: false, error: 'Invalid email or password' };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

// Validate API Key
async function validateApiKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' };
  
  try {
    if (isInitialized && database) {
      const apiKeyRef = database.ref(`api_keys/${apiKey}`);
      const snapshot = await apiKeyRef.once('value');
      
      if (!snapshot.exists()) {
        return { valid: false, error: 'Invalid API Key' };
      }
      
      const userId = snapshot.val();
      const userRef = database.ref(`users/${userId}`);
      const userSnapshot = await userRef.once('value');
      
      if (!userSnapshot.exists()) {
        return { valid: false, error: 'User not found' };
      }
      
      const userData = userSnapshot.val();
      
      if (userData.status !== 'active') {
        return { valid: false, error: 'Account is disabled' };
      }
      
      return {
        valid: true,
        user: {
          id: userId,
          email: userData.email,
          name: userData.name,
          tier: userData.tier,
          apiKey: apiKey
        }
      };
    } else {
      const user = inMemoryApiKeys.get(apiKey);
      if (!user) return { valid: false, error: 'Invalid API Key' };
      if (user.status !== 'active') return { valid: false, error: 'Account is disabled' };
      
      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
          apiKey: apiKey
        }
      };
    }
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, error: 'Validation service error' };
  }
}

// Check rate limit
function checkRateLimit(apiKey, tier = 'FREE') {
  const now = Date.now();
  const hourAgo = now - 3600000;
  const limit = RATE_LIMITS[tier] || RATE_LIMITS.FREE;
  
  if (!requestLogs.has(apiKey)) {
    requestLogs.set(apiKey, []);
  }
  
  const logs = requestLogs.get(apiKey);
  const recentLogs = logs.filter(timestamp => timestamp > hourAgo);
  
  if (recentLogs.length >= limit) {
    const oldest = Math.min(...recentLogs);
    const resetIn = Math.ceil((oldest + 3600000 - now) / 1000);
    return { allowed: false, remaining: 0, resetIn, limit };
  }
  
  recentLogs.push(now);
  requestLogs.set(apiKey, recentLogs);
  
  return {
    allowed: true,
    remaining: limit - recentLogs.length,
    limit
  };
}

// Update request count
async function updateRequestCount(apiKey) {
  try {
    if (isInitialized && database) {
      const apiKeyRef = database.ref(`api_keys/${apiKey}`);
      const snapshot = await apiKeyRef.once('value');
      
      if (snapshot.exists()) {
        const userId = snapshot.val();
        const userRef = database.ref(`users/${userId}`);
        
        // Increment total requests
        await userRef.transaction((currentData) => {
          if (currentData) {
            currentData.totalRequests = (currentData.totalRequests || 0) + 1;
            currentData.lastActive = new Date().toISOString();
          }
          return currentData;
        });
        
        // Update daily usage
        const today = new Date().toISOString().split('T')[0];
        const usageRef = database.ref(`usage/${userId}/daily/${today}`);
        await usageRef.transaction((current) => {
          return (current || 0) + 1;
        });
        
        // Update total usage
        const totalRef = database.ref(`usage/${userId}/total`);
        await totalRef.transaction((current) => {
          return (current || 0) + 1;
        });
      }
    } else {
      const user = inMemoryApiKeys.get(apiKey);
      if (user) {
        user.totalRequests = (user.totalRequests || 0) + 1;
        inMemoryApiKeys.set(apiKey, user);
      }
    }
  } catch (error) {
    console.error('Update count error:', error);
  }
}

// Regenerate API Key
async function regenerateApiKey(email, password) {
  const hashedPassword = hashPassword(password);
  
  try {
    if (isInitialized && database) {
      const usersRef = database.ref('users');
      const snapshot = await usersRef.orderByChild('email').equalTo(email).once('value');
      
      if (!snapshot.exists()) {
        return { success: false, error: 'User not found' };
      }
      
      let userId = null;
      let userData = null;
      
      snapshot.forEach((child) => {
        userId = child.key;
        userData = child.val();
      });
      
      if (userData.password !== hashedPassword) {
        return { success: false, error: 'Invalid credentials' };
      }
      
      const newApiKey = generateApiKey();
      const oldApiKey = userData.apiKey;
      
      // Remove old API key mapping
      await database.ref(`api_keys/${oldApiKey}`).remove();
      
      // Add new API key mapping
      await database.ref(`api_keys/${newApiKey}`).set(userId);
      
      // Update user with new API key
      await database.ref(`users/${userId}`).update({
        apiKey: newApiKey,
        apiKeyUpdatedAt: new Date().toISOString()
      });
      
      return {
        success: true,
        data: { apiKey: newApiKey }
      };
    } else {
      for (const [id, user] of inMemoryUsers) {
        if (user.email === email && user.password === hashedPassword) {
          const newApiKey = generateApiKey();
          const oldApiKey = user.apiKey;
          
          inMemoryApiKeys.delete(oldApiKey);
          user.apiKey = newApiKey;
          inMemoryUsers.set(id, user);
          inMemoryApiKeys.set(newApiKey, user);
          
          return {
            success: true,
            data: { apiKey: newApiKey }
          };
        }
      }
      return { success: false, error: 'User not found' };
    }
  } catch (error) {
    console.error('Regenerate error:', error);
    return { success: false, error: error.message };
  }
}

// Get user stats
async function getUserStats(apiKey) {
  try {
    if (isInitialized && database) {
      const apiKeyRef = database.ref(`api_keys/${apiKey}`);
      const snapshot = await apiKeyRef.once('value');
      
      if (snapshot.exists()) {
        const userId = snapshot.val();
        const userRef = database.ref(`users/${userId}`);
        const userSnapshot = await userRef.once('value');
        
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          return {
            totalRequests: userData.totalRequests || 0,
            tier: userData.tier,
            email: userData.email,
            name: userData.name
          };
        }
      }
    } else {
      const user = inMemoryApiKeys.get(apiKey);
      if (user) {
        return {
          totalRequests: user.totalRequests || 0,
          tier: user.tier,
          email: user.email,
          name: user.name
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Get stats error:', error);
    return null;
  }
}

// Auth Middleware
function authMiddleware(req, res, next) {
  const publicPaths = [
    '/', '/health', '/all-apis', '/all-apis/cards',
    '/auth/register', '/auth/login', '/auth/verify',
    '/auth/info', '/server-stats', '/api-info'
  ];
  
  if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path === '/index.html') {
    return next();
  }
  
  if (publicPaths.some(path => req.path === path || req.path.startsWith(path + '?'))) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({
      status: false,
      error: 'API Key Required',
      message: 'Please provide X-API-Key header',
      register: 'POST /auth/register to get your API key'
    });
  }
  
  validateApiKey(apiKey).then(validation => {
    if (!validation.valid) {
      return res.status(401).json({
        status: false,
        error: validation.error
      });
    }
    
    const rateCheck = checkRateLimit(apiKey, validation.user.tier);
    
    if (!rateCheck.allowed) {
      return res.status(429).json({
        status: false,
        error: 'Rate limit exceeded',
        limit: rateCheck.limit,
        resetIn: rateCheck.resetIn,
        tier: validation.user.tier
      });
    }
    
    updateRequestCount(apiKey);
    
    res.setHeader('X-RateLimit-Limit', rateCheck.limit);
    res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);
    res.setHeader('X-RateLimit-Reset', rateCheck.resetIn);
    
    req.user = validation.user;
    next();
  }).catch(error => {
    res.status(500).json({
      status: false,
      error: 'Authentication service error',
      message: error.message
    });
  });
}

module.exports = {
  authMiddleware,
  registerUser,
  loginUser,
  validateApiKey,
  regenerateApiKey,
  getUserStats,
  RATE_LIMITS,
  isInitialized
};
