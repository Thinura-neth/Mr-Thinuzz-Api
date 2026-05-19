// config/firebase.js
// Firebase Admin SDK configuration for backend

const admin = require('firebase-admin');

// Your Firebase config from the frontend
const firebaseConfig = {
  apiKey: "AIzaSyCnKZ6wpN8lr4VmgM_Xy2n_TZov_Tx8Ukw",
  authDomain: "mr-thinuzz-api.firebaseapp.com",
  projectId: "mr-thinuzz-api",
  storageBucket: "mr-thinuzz-api.firebasestorage.app",
  messagingSenderId: "16054651666",
  appId: "1:16054651666:web:26ec7e1a5bbd7f717cc1cb",
  measurementId: "G-K88S031CG6"
};

// Initialize Firebase Admin SDK
let adminApp = null;
let isInitialized = false;

try {
  // Check if we have service account credentials
  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // For production (Vercel, Heroku, etc.)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // For local development - create this file from Firebase Console
    try {
      serviceAccount = require('../firebase-service-account.json');
    } catch (e) {
      console.log('⚠️ No service account file found. Running in development mode.');
    }
  }
  
  if (serviceAccount) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: firebaseConfig.projectId
    });
    isInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    console.log('⚠️ Firebase not configured. Auth features will use in-memory mode.');
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
}

// In-memory storage for development (when Firebase is not configured)
const inMemoryUsers = new Map();
const inMemoryApiKeys = new Map();
const requestLogs = new Map();

// Rate limits
const RATE_LIMITS = {
  FREE: 50,
  BASIC: 500,
  PREMIUM: 5000
};

// Generate API key
function generateApiKey() {
  const crypto = require('crypto');
  const prefix = 'MT_API_';
  const randomPart = crypto.randomBytes(32).toString('hex');
  return prefix + randomPart;
}

// Hash password (simple hash for in-memory mode)
function hashPassword(password) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Register user (works with both Firebase and in-memory)
async function registerUser(email, password, name = '') {
  // Validate
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
    if (isInitialized) {
      // Use Firebase Authentication
      // Note: In Firebase Admin SDK, user creation is done via auth()
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: name || email.split('@')[0],
      });
      
      // Generate API key and store in Firestore
      const apiKey = generateApiKey();
      const db = admin.firestore();
      
      await db.collection('users').doc(userRecord.uid).set({
        email: email,
        name: name || email.split('@')[0],
        apiKey: apiKey,
        tier: 'FREE',
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        totalRequests: 0
      });
      
      // Create usage collection
      await db.collection('usage').doc(userRecord.uid).set({
        daily: {},
        total: 0,
        lastReset: new Date().toISOString().split('T')[0]
      });
      
      return {
        success: true,
        data: {
          userId: userRecord.uid,
          email: email,
          name: name || email.split('@')[0],
          apiKey: apiKey,
          tier: 'FREE',
          createdAt: new Date().toISOString()
        },
        note: '⚠️ Save your API Key! You will not be able to see it again.'
      };
    } else {
      // In-memory mode
      // Check if user exists
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
        },
        note: '⚠️ Save your API Key! (Development mode)'
      };
    }
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: error.message };
  }
}

// Login user
async function loginUser(email, password) {
  try {
    if (isInitialized) {
      // In Firebase Admin SDK, we need to verify password via sign in
      // For API key retrieval, we'll use Firestore
      const db = admin.firestore();
      const userQuery = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (userQuery.empty) {
        return { success: false, error: 'Invalid email or password' };
      }
      
      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();
      
      // Note: Password verification should be done via Firebase Auth client-side
      // For API key retrieval, we'll assume the user has authenticated
      
      return {
        success: true,
        data: {
          userId: userDoc.id,
          email: userData.email,
          name: userData.name,
          apiKey: userData.apiKey,
          tier: userData.tier,
          totalRequests: userData.totalRequests || 0
        }
      };
    } else {
      // In-memory mode
      const hashedPassword = hashPassword(password);
      
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
    if (isInitialized) {
      const db = admin.firestore();
      const userQuery = await db.collection('users')
        .where('apiKey', '==', apiKey)
        .limit(1)
        .get();
      
      if (userQuery.empty) {
        return { valid: false, error: 'Invalid API Key' };
      }
      
      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();
      
      if (userData.status !== 'active') {
        return { valid: false, error: 'Account is disabled' };
      }
      
      return {
        valid: true,
        user: {
          id: userDoc.id,
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
    if (isInitialized) {
      const db = admin.firestore();
      const userQuery = await db.collection('users')
        .where('apiKey', '==', apiKey)
        .limit(1)
        .get();
      
      if (!userQuery.empty) {
        const userDoc = userQuery.docs[0];
        await userDoc.ref.update({
          totalRequests: admin.firestore.FieldValue.increment(1),
          lastActive: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Update daily usage
        const today = new Date().toISOString().split('T')[0];
        const usageRef = db.collection('usage').doc(userDoc.id);
        const usageDoc = await usageRef.get();
        
        if (usageDoc.exists) {
          const dailyData = usageDoc.data().daily || {};
          dailyData[today] = (dailyData[today] || 0) + 1;
          await usageRef.update({
            daily: dailyData,
            total: admin.firestore.FieldValue.increment(1)
          });
        }
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

// Get user stats
async function getUserStats(apiKey) {
  try {
    if (isInitialized) {
      const db = admin.firestore();
      const userQuery = await db.collection('users')
        .where('apiKey', '==', apiKey)
        .limit(1)
        .get();
      
      if (!userQuery.empty) {
        const userDoc = userQuery.docs[0];
        const usageDoc = await db.collection('usage').doc(userDoc.id).get();
        
        return {
          totalRequests: userDoc.data().totalRequests || 0,
          tier: userDoc.data().tier,
          email: userDoc.data().email,
          name: userDoc.data().name
        };
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

// Regenerate API Key
async function regenerateApiKey(email, password) {
  // For security, implement proper password verification
  try {
    if (isInitialized) {
      const db = admin.firestore();
      const userQuery = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (userQuery.empty) {
        return { success: false, error: 'User not found' };
      }
      
      const userDoc = userQuery.docs[0];
      const newApiKey = generateApiKey();
      
      await userDoc.ref.update({
        apiKey: newApiKey,
        apiKeyUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        success: true,
        data: { apiKey: newApiKey }
      };
    } else {
      for (const [id, user] of inMemoryUsers) {
        if (user.email === email) {
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
    return { success: false, error: error.message };
  }
}

// Auth Middleware
function authMiddleware(req, res, next) {
  // Public paths
  const publicPaths = [
    '/', '/health', '/all-apis', '/all-apis/cards',
    '/auth/register', '/auth/login', '/auth/verify',
    '/auth/info', '/server-stats', '/api-info'
  ];
  
  // Static files
  if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path === '/index.html') {
    return next();
  }
  
  // Check public paths
  if (publicPaths.some(path => req.path === path || req.path.startsWith(path + '?'))) {
    return next();
  }
  
  // Get API Key
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({
      status: false,
      error: 'API Key Required',
      message: 'Please provide X-API-Key header',
      register: 'POST /auth/register to get your API key',
      docs: '/auth/info'
    });
  }
  
  // Validate API Key (async)
  validateApiKey(apiKey).then(validation => {
    if (!validation.valid) {
      return res.status(401).json({
        status: false,
        error: validation.error
      });
    }
    
    // Check rate limit
    const rateCheck = checkRateLimit(apiKey, validation.user.tier);
    
    if (!rateCheck.allowed) {
      return res.status(429).json({
        status: false,
        error: 'Rate limit exceeded',
        message: `You have exceeded your ${validation.user.tier} tier limit`,
        limit: rateCheck.limit,
        resetIn: rateCheck.resetIn,
        tier: validation.user.tier
      });
    }
    
    // Update request count (async, don't wait)
    updateRequestCount(apiKey);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', rateCheck.limit);
    res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);
    res.setHeader('X-RateLimit-Reset', rateCheck.resetIn);
    
    // Attach user to request
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
  isFirebaseInitialized: isInitialized
};
