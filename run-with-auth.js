#!/usr/bin/env node

// run-with-auth.js - Start server with Firebase authentication

console.log('');
console.log('╔════════════════════════════════════════════════════╗');
console.log('║     🔐 Starting Mr Thinuzz API with Firebase Auth  ║');
console.log('╚════════════════════════════════════════════════════╝');
console.log('');

const fs = require('fs');
const path = require('path');

// Check required files
const requiredFiles = [
  'config/firebase.js',
  'middleware/firebase-auth.js',
  'routes/auth.js',
  'server-with-auth.js'
];

let missing = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(__dirname, file))) {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.error('❌ Error: Missing required files:');
  missing.forEach(f => console.error(`   - ${f}`));
  console.log('');
  console.log('📝 Please add these files first.');
  process.exit(1);
}

console.log('✅ All auth files found');
console.log('✅ Firebase authentication ready');
console.log('');

// Start server
require('./server-with-auth');
