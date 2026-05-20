const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const admin = require('firebase-admin');

// ============ FIREBASE ADMIN INIT ============
// Vercel / production environment variables වලින් service account load කරන්න
let serviceAccount;
if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID || "mr-thinuzz-api",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
} else {
    // Local development සඳහා JSON file එකක් භාවිත කරන්න (GitHub එකට push නොකරන්න)
    try {
        serviceAccount = require('./serviceAccountKey.json');
    } catch(e) {
        console.error("No Firebase credentials found! Please set environment variables or add serviceAccountKey.json");
        process.exit(1);
    }
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://mr-thinuzz-api-default-rtdb.firebaseio.com"
    });
}
const db = admin.database();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS)
app.use(express.static('public'));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// ============ API KEY MIDDLEWARE (Coins Deduction) ============
// Public paths that don't require API key
const publicPaths = ['/health', '/auth/', '/all-apis/cards', '/', '/dashboard', '/login', '/register'];

async function apiKeyMiddleware(req, res, next) {
    // Check if path is public
    if (publicPaths.some(p => req.path.startsWith(p))) {
        return next();
    }
    
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) {
        return res.status(401).json({ error: "API key required. Provide 'x-api-key' header or 'api_key' query param" });
    }
    
    try {
        // Find user by API key
        const snapshot = await db.ref('users').orderByChild('apiKey').equalTo(apiKey).once('value');
        if (!snapshot.exists()) {
            return res.status(401).json({ error: "Invalid API key" });
        }
        
        let userId, userData;
        snapshot.forEach(child => {
            userId = child.key;
            userData = child.val();
        });
        
        if (userData.coins < 1) {
            return res.status(403).json({ error: "Insufficient coins. Please recharge." });
        }
        
        // Deduct 1 coin and increment totalRequests
        const newCoins = userData.coins - 1;
        const newTotal = (userData.totalRequests || 0) + 1;
        await db.ref(`users/${userId}`).update({
            coins: newCoins,
            totalRequests: newTotal
        });
        
        // Attach user data to request for routes
        req.user = { ...userData, userId, coins: newCoins };
        next();
    } catch (err) {
        console.error("API key middleware error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Apply middleware to all API routes (but after dynamic routes are loaded)
// We'll apply it after route loading but before the route handlers

// ============ AUTO-LOAD ROUTES ============
const routesPath = path.join(__dirname, 'routes');
global.loadedRoutesInfo = {};

if (fs.existsSync(routesPath)) {
    const routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js'));
    
    routeFiles.forEach(file => {
        const routeName = file.replace('.js', '');
        const routeHandler = require(path.join(routesPath, file));
        
        // Wrap the route handler with API key middleware (only for this router)
        // We'll create a wrapper that applies middleware then passes to original router
        const wrappedRouter = express.Router();
        wrappedRouter.use(apiKeyMiddleware);
        wrappedRouter.use(routeHandler);
        
        app.use(`/${routeName}`, wrappedRouter);
        
        // Generate info for dashboard (auto)
        const endpoints = [];
        if (routeHandler.stack) {
            routeHandler.stack.forEach(layer => {
                if (layer.route) {
                    const pathStr = layer.route.path;
                    if (pathStr === '/') return;
                    const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
                    endpoints.push({
                        name: pathStr.replace('/', '').replace('-', ' '),
                        method: methods[0] || 'GET',
                        path: pathStr,
                        params: [],
                        required_params: [],
                        example: `/${routeName}${pathStr}`
                    });
                }
            });
        }
        
        global.loadedRoutesInfo[routeName] = {
            name: `${routeName.charAt(0).toUpperCase() + routeName.slice(1)} API`,
            icon: "fa-code",
            color: "#3b82f6",
            base_path: `/${routeName}`,
            enabled: true,
            endpoints: endpoints
        };
        
        console.log(`✅ Loaded route /${routeName} with API key protection`);
    });
} else {
    console.log('⚠️ Routes folder not found');
}

// ============ AUTH ROUTES (NO API KEY NEEDED) ============
const authRouter = express.Router();
const crypto = require('crypto');

function generateApiKey() {
    return 'api_' + crypto.randomBytes(16).toString('hex');
}

// Register endpoint
authRouter.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Missing name, email, or password" });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    
    try {
        // Since we're not using Firebase Auth, we'll store password hashed (simplified)
        // For production, use Firebase Auth or bcrypt
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        const apiKey = generateApiKey();
        const userId = email.replace(/[^a-z0-9]/gi, '_') + '_' + Date.now();
        
        await db.ref(`users/${userId}`).set({
            name,
            email,
            password: hashedPassword,
            apiKey,
            coins: 1000,
            totalRequests: 0,
            createdAt: Date.now()
        });
        
        res.status(201).json({ success: true, apiKey, coins: 1000, userId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Login endpoint
authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
    }
    
    try {
        const snapshot = await db.ref('users').orderByChild('email').equalTo(email).once('value');
        if (!snapshot.exists()) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        let userData, userId;
        snapshot.forEach(child => {
            userId = child.key;
            userData = child.val();
        });
        
        const hashedInput = crypto.createHash('sha256').update(password).digest('hex');
        if (userData.password !== hashedInput) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        res.json({ success: true, apiKey: userData.apiKey, name: userData.name, coins: userData.coins });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get user info by API key (for dashboard)
authRouter.get('/me', apiKeyMiddleware, async (req, res) => {
    res.json({ user: req.user });
});

app.use('/auth', authRouter);

// ============ SPECIAL ENDPOINTS (Public) ============
const allApisRouter = require('./all-apis');
app.use('/all-apis', allApisRouter);

app.get('/health', (req, res) => {
    res.json({ status: true, timestamp: new Date().toISOString() });
});

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
