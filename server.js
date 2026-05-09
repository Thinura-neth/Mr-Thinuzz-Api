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
app.use(express.static('public'));

// Auto-load all routes from routes/ folder
const routesPath = path.join(__dirname, 'routes');
const routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js'));

routeFiles.forEach(file => {
    const routeName = file.replace('.js', '');
    const routeHandler = require(path.join(routesPath, file));
    app.use(`/${routeName}`, routeHandler);
    console.log(`✅ Loaded route: /${routeName}`);
});

// Real-time server stats endpoint
app.get('/server-stats', (req, res) => {
    res.json({
        status: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: os.cpus().length,
        platform: os.platform(),
        node_version: process.version
    });
});

// Health check with real-time stats
app.get('/health', (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        author: "Mr Thinuzz",
        uptime: `${Math.floor(process.uptime())} seconds`,
        memory_usage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        available_routes: routeFiles.map(f => f.replace('.js', '')),
        endpoints_count: routeFiles.length
    });
});

// API Info with real-time endpoints
app.get('/api-info', (req, res) => {
    const endpoints = [];
    
    routeFiles.forEach(file => {
        const routeName = file.replace('.js', '');
        endpoints.push({
            route: `/${routeName}`,
            methods: ["GET"],
            description: getRouteDescription(routeName)
        });
    });
    
    res.json({
        name: "Mr Thinuzz Free APIs",
        version: "2.0.0",
        author: "Mr Thinuzz",
        status: "online",
        timestamp: new Date().toISOString(),
        features: [
            "No API Key Required",
            "Unlimited Requests",
            "Real-time Scraping",
            "Live Endpoint Status"
        ],
        endpoints: {
            "GET /": "Beautiful UI Interface",
            "GET /health": "Server health & stats",
            "GET /server-stats": "Real-time server statistics",
            "GET /api-info": "This API information",
            "GET /game/fitgirl-search?q=SEARCH": "Search games",
            "GET /game/fitgirl-info?url=URL": "Get game info",
            "GET /game/fitgirl-download?url=URL": "Extract download link"
        }
    });
});

function getRouteDescription(route) {
    const descriptions = {
        'game': 'FitGirl Repacks - Search, Info & Download endpoints'
    };
    return descriptions[route] || 'Available endpoints';
}

// Root - serve beautiful UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: false,
        error: "Route not found",
        timestamp: new Date().toISOString(),
        message: "Check /api-info for available endpoints"
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
    ╔════════════════════════════════════════════════════╗
    ║     🚀 MR THINUZZ REAL-TIME API SERVER             ║
    ╠════════════════════════════════════════════════════╣
    ║  📍 URL: http://localhost:${PORT}                    ║
    ║  👤 Author: Mr Thinuzz                             ║
    ║  📁 Routes: ${routeFiles.map(f => f.replace('.js', '')).join(', ')}                        ║
    ║  ⚡ Status: Online - Real-time Ready               ║
    ║  ✨ Unlimited Requests - No API Key                ║
    ╚════════════════════════════════════════════════════╝
    `);
});
