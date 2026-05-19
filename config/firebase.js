// config/firebase.js - Updated for Realtime Database
const admin = require('firebase-admin');

// Firebase config (same as before)
const firebaseConfig = {
  apiKey: "AIzaSyCnKZ6wpN8lr4VmgM_Xy2n_TZov_Tx8Ukw",
  authDomain: "mr-thinuzz-api.firebaseapp.com",
  projectId: "mr-thinuzz-api",
  storageBucket: "mr-thinuzz-api.firebasestorage.app",
  messagingSenderId: "16054651666",
  appId: "1:16054651666:web:26ec7e1a5bbd7f717cc1cb",
  measurementId: "G-K88S031CG6"
};

let adminApp = null;
let isInitialized = false;
let database = null;

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
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`, // Realtime Database URL
      projectId: firebaseConfig.projectId
    });
    
    database = admin.database();
    isInitialized = true;
    console.log('✅ Firebase Admin SDK initialized with Realtime Database');
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
}

// Helper functions using Realtime Database
async function saveUser(userId, userData) {
  if (!isInitialized) return false;
  try {
    await database.ref(`users/${userId}`).set(userData);
    return true;
  } catch (error) {
    console.error('Save user error:', error);
    return false;
  }
}

async function getUserByEmail(email) {
  if (!isInitialized) return null;
  try {
    const snapshot = await database.ref('users').orderByChild('email').equalTo(email).once('value');
    if (snapshot.exists()) {
      const users = snapshot.val();
      const userId = Object.keys(users)[0];
      return { id: userId, ...users[userId] };
    }
    return null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

async function getUserByApiKey(apiKey) {
  if (!isInitialized) return null;
  try {
    const snapshot = await database.ref('users').orderByChild('apiKey').equalTo(apiKey).once('value');
    if (snapshot.exists()) {
      const users = snapshot.val();
      const userId = Object.keys(users)[0];
      return { id: userId, ...users[userId] };
    }
    return null;
  } catch (error) {
    console.error('Get user by API key error:', error);
    return null;
  }
}

module.exports = {
  saveUser,
  getUserByEmail,
  getUserByApiKey,
  isFirebaseInitialized: isInitialized,
  database
};
