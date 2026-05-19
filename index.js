const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Dynamic Routes තොරතුරු ගබඩා කිරීමට Global Object එකක් නිර්මාණය කිරීම
global.loadedRoutesInfo = {};

// ============ AUTO-LOAD ALL ROUTES FROM ROUTES/ FOLDER ============
const routesPath = path.join(__dirname, 'routes');
let routeFiles = [];

if (fs.existsSync(routesPath)) {
    routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js'));
    
    routeFiles.forEach(file => {
        const routeName = file.replace('.js', '');
        const routeHandler = require(path.join(routesPath, file));
        
        // Router එක ඇතුළේ apiConfig එකක් තිබේ නම් එය global object එකට එකතු කරයි
        if (routeHandler.apiConfig) {
            global.loadedRoutesInfo[routeName] = routeHandler.apiConfig;
        } else {
            // කිසිදු config එකක් නැතිනම් default සැකසුමක් සාදයි
            global.loadedRoutesInfo[routeName] = {
                name: `${routeName.toUpperCase()} API`,
                name_si: `${routeName.toUpperCase()} API`,
                icon: "fa-code",
                color: "#6b7280",
                base_path: `/${routeName}`,
                enabled: true,
                endpoints: []
            };
        }
        
        // Express Router එක ඇතුළත් කිරීම (e.g., app.use('/movie', movieRouter))
        app.use(`/${routeName}`, routeHandler);
        console.log(`✅ Loaded route dynamic info: /${routeName}`);
    });
} else {
    console.log('⚠️ Routes folder not found, creating...');
    fs.mkdirSync(routesPath, { recursive: true });
}

// ============ IMPORT ALL-APIS ROUTER ============
// සටහන: allApisRouter එකට global.loadedRoutesInfo අවශ්‍ය බැවින් මෙය රවුට්ස් වලට පසුව යෙදිය යුතුය
const allApisRouter = require('./all-apis');
app.use('/all-apis', allApisRouter);

// Health check with real-time stats
app.get('/health', (req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    
    res.json({
        status: true,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        memory_usage: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        platform: os.platform(),
        arch: os.arch(),
        timestamp: new Date().toISOString()
    });
});

// Root - serve UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: false,
        error: "Route not found",
        timestamp: new Date().toISOString()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        status: false,
        error: "Internal server error",
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║     🚀 MR THINUZZ REAL-TIME API SERVER v4.0                ║
    ╠════════════════════════════════════════════════════════════╣
    ║  📍 URL: http://localhost:${PORT}                            ║
    ║  👤 Author: Mr Thinuzz                                     ║
    ║  📁 Loaded Routes: ${Object.keys(global.loadedRoutesInfo).join(', ')}
    ║  🃏 Cards Endpoint: /all-apis/cards                        ║
    ╚════════════════════════════════════════════════════════════╝
    `);
});
