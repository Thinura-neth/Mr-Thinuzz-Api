const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const admin = require('firebase-admin');
const crypto = require('crypto');

// ============ FIREBASE ADMIN INIT ============
let serviceAccount;
if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID || "mr-thinuzz-api",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
} else {
    try {
        serviceAccount = require('./serviceAccountKey.json');
    } catch(e) {
        console.error("❌ Firebase credentials missing. Set env vars or add serviceAccountKey.json");
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
app.use(express.static('public'));

// ============ HELPER FUNCTIONS ============
function generateApiKey() {
    return 'api_' + crypto.randomBytes(16).toString('hex');
}

// ============ API KEY MIDDLEWARE (Coins Deduction) ============
const publicPaths = ['/health', '/auth/', '/all-apis/cards', '/', '/dashboard', '/login', '/register'];

async function apiKeyMiddleware(req, res, next) {
    if (publicPaths.some(p => req.path.startsWith(p))) {
        return next();
    }
    
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) {
        return res.status(401).json({ error: "API key required. Use 'x-api-key' header or 'api_key' query param" });
    }
    
    try {
        const snapshot = await db.ref('users').orderByChild('apiKey').equalTo(apiKey).once('value');
        if (!snapshot.exists()) {
            return res.status(401).json({ error: "Invalid API key" });
        }
        
        let userId, userData;
        snapshot.forEach(child => { userId = child.key; userData = child.val(); });
        
        if (userData.coins < 1) {
            return res.status(403).json({ error: "Insufficient coins. Please recharge." });
        }
        
        const newCoins = userData.coins - 1;
        const newTotal = (userData.totalRequests || 0) + 1;
        await db.ref(`users/${userId}`).update({ coins: newCoins, totalRequests: newTotal });
        
        req.user = { ...userData, userId, coins: newCoins };
        next();
    } catch (err) {
        console.error("Middleware error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

// ============ AUTO-LOAD ROUTES (with middleware wrapper) ============
const routesPath = path.join(__dirname, 'routes');
global.loadedRoutesInfo = {};

if (fs.existsSync(routesPath)) {
    const routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js'));
    routeFiles.forEach(file => {
        const routeName = file.replace('.js', '');
        const originalRouter = require(path.join(routesPath, file));
        
        // Wrap the original router with API key middleware
        const wrappedRouter = express.Router();
        wrappedRouter.use(apiKeyMiddleware);
        wrappedRouter.use(originalRouter);
        app.use(`/${routeName}`, wrappedRouter);
        
        // Build info for /all-apis/cards
        const endpoints = [];
        if (originalRouter.stack) {
            originalRouter.stack.forEach(layer => {
                if (layer.route) {
                    const p = layer.route.path;
                    if (p !== '/') {
                        endpoints.push({
                            name: p.replace('/', '').replace(/-/g, ' '),
                            method: Object.keys(layer.route.methods)[0].toUpperCase(),
                            path: p,
                            example: `/${routeName}${p}`
                        });
                    }
                }
            });
        }
        
        global.loadedRoutesInfo[routeName] = {
            name: `${routeName.charAt(0).toUpperCase() + routeName.slice(1)} API`,
            icon: "fa-code",
            color: "#3b82f6",
            base_path: `/${routeName}`,
            enabled: true,
            endpoints
        };
        console.log(`✅ Protected route /${routeName} (coin deduction active)`);
    });
} else {
    console.log('⚠️ Routes folder not found, creating...');
    fs.mkdirSync(routesPath, { recursive: true });
}

// ============ AUTH ROUTES (no API key needed) ============
const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Missing name, email, or password" });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    try {
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        const apiKey = generateApiKey();
        const userId = email.replace(/[^a-z0-9]/gi, '_') + '_' + Date.now();
        
        await db.ref(`users/${userId}`).set({
            name, email, password: hashedPassword, apiKey,
            coins: 1000, totalRequests: 0, createdAt: Date.now()
        });
        res.status(201).json({ success: true, apiKey, coins: 1000, userId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });
    try {
        const snapshot = await db.ref('users').orderByChild('email').equalTo(email).once('value');
        if (!snapshot.exists()) return res.status(401).json({ error: "Invalid credentials" });
        let userData, userId;
        snapshot.forEach(child => { userId = child.key; userData = child.val(); });
        const hashedInput = crypto.createHash('sha256').update(password).digest('hex');
        if (userData.password !== hashedInput) return res.status(401).json({ error: "Invalid credentials" });
        res.json({ success: true, apiKey: userData.apiKey, name: userData.name, coins: userData.coins });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

authRouter.get('/me', apiKeyMiddleware, (req, res) => {
    res.json({ user: req.user });
});

app.use('/auth', authRouter);

// ============ OTHER PUBLIC ROUTES ============
const allApisRouter = require('./all-apis');
app.use('/all-apis', allApisRouter);

app.get('/health', (req, res) => {
    res.json({ status: true, timestamp: new Date().toISOString() });
});

// Serve frontend HTML (if you have public/index.html and public/dashboard.html)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// 404 & error handlers
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
