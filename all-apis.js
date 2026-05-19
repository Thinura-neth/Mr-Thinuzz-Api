const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Load route configuration - FIXED PATH
const configPath = path.join(__dirname, 'route-config.json');
let routeConfig = { apis: {} };

// Function to reload config
function reloadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            routeConfig = JSON.parse(configData);
            console.log('✅ Route configuration reloaded from:', configPath);
            console.log('📋 Loaded APIs:', Object.keys(routeConfig.apis));
        } else {
            console.log('⚠️ route-config.json not found at:', configPath);
            // Create default config if not exists
            const defaultConfig = {
                version: "1.0",
                apis: {
                    movies: {
                        name: "Movies API",
                        name_si: "චිත්‍රපට API",
                        icon: "fa-film",
                        color: "#6366f1",
                        base_path: "/movie",
                        enabled: true,
                        endpoints: []
                    },
                    games: {
                        name: "Games API",
                        name_si: "ක්‍රීඩා API", 
                        icon: "fa-gamepad",
                        color: "#10b981",
                        base_path: "/game",
                        enabled: true,
                        endpoints: []
                    },
                    games: {
                        name: "Games API",
                        name_si: "ක්‍රීඩා API", 
                        icon: "fa-star",
                        color: "#10b981",
                        base_path: "/mvpro",
                        enabled: true,
                        endpoints: []
                    },
                    anime: {
                        name: "Anime API",
                        name_si: "ඇනිමේ API",
                        icon: "fa-dragon",
                        color: "#ec4899",
                        base_path: "/anime",
                        enabled: true,
                        endpoints: []
                    }
                }
            };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            routeConfig = defaultConfig;
            console.log('✅ Created default route-config.json');
        }
    } catch (error) {
        console.error('❌ Error loading config:', error.message);
        routeConfig = { apis: {} };
    }
}

// Initial load
reloadConfig();

// Watch for config file changes (for development)
if (process.env.NODE_ENV !== 'production') {
    try {
        fs.watch(configPath, (eventType) => {
            if (eventType === 'change') {
                console.log('📝 Config file changed, reloading...');
                reloadConfig();
            }
        });
    } catch (err) {
        console.log('⚠️ Cannot watch config file:', err.message);
    }
}

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Helper function to fetch API
async function fetchAPI(endpoint, params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const url = `${BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mr-Thinuzz-API/1.0' }
        });
        return response.data;
    } catch (error) {
        return { status: false, error: error.message, endpoint: endpoint };
    }
}

// ============ AUTO GENERATED CARDS ENDPOINT ============

// GET /all-apis/cards - Returns all API cards data for frontend
router.get('/cards', (req, res) => {
    const cards = [];
    
    for (const [key, api] of Object.entries(routeConfig.apis)) {
        if (api.enabled !== false) {
            cards.push({
                id: key,
                name: api.name,
                name_si: api.name_si || api.name,
                icon: api.icon || 'fa-code',
                color: api.color || '#6366f1',
                base_path: api.base_path,
                endpoints: (api.endpoints || []).map(ep => ({
                    name: ep.name,
                    method: ep.method || 'GET',
                    path: ep.path,
                    params: ep.params || [],
                    required_params: ep.required_params || [],
                    example: ep.example,
                    description: ep.description || 'No description available'
                }))
            });
        }
    }
    
    res.json({
        status: true,
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString(),
        total_apis: cards.length,
        cards: cards
    });
});

// ============ AUTO GENERATED ENDPOINTS ============

// Dynamically create routes based on config
for (const [apiKey, apiConfig] of Object.entries(routeConfig.apis)) {
    if (apiConfig.enabled !== false && apiConfig.endpoints) {
        
        // Create sub-router for each API
        const subRouter = express.Router();
        
        // Root endpoint for this API
        subRouter.get('/', (req, res) => {
            res.json({
                status: true,
                name: apiConfig.name,
                name_si: apiConfig.name_si,
                icon: apiConfig.icon,
                base_path: apiConfig.base_path,
                endpoints: apiConfig.endpoints.map(ep => ({
                    name: ep.name,
                    method: ep.method || 'GET',
                    url: `${apiConfig.base_path}${ep.path}`,
                    params: ep.params || [],
                    example: ep.example,
                    description: ep.description
                }))
            });
        });
        
        // Create individual endpoints (proxy to actual routes)
        for (const endpoint of apiConfig.endpoints) {
            const fullPath = endpoint.path;
            const method = (endpoint.method || 'GET').toLowerCase();
            
            subRouter[method](fullPath, async (req, res) => {
                // Check required params
                if (endpoint.required_params && endpoint.required_params.length > 0) {
                    const missingParams = [];
                    for (const param of endpoint.required_params) {
                        if (!req.query[param]) {
                            missingParams.push(param);
                        }
                    }
                    
                    if (missingParams.length > 0) {
                        return res.status(400).json({
                            status: false,
                            error: `Missing required parameters: ${missingParams.join(', ')}`,
                            required_params: endpoint.required_params,
                            example: `${apiConfig.base_path}${endpoint.path}?${endpoint.required_params.map(p => `${p}=...`).join('&')}`
                        });
                    }
                }
                
                // Forward request to actual endpoint
                const targetUrl = `${BASE_URL}${apiConfig.base_path}${endpoint.path}`;
                const params = req.query;
                
                try {
                    const response = await axios.get(targetUrl, { 
                        params,
                        timeout: 30000,
                        headers: { 'User-Agent': 'Mr-Thinuzz-API/1.0' }
                    });
                    res.json(response.data);
                } catch (error) {
                    res.status(error.response?.status || 500).json({
                        status: false,
                        error: error.message,
                        original_endpoint: targetUrl,
                        note: "Make sure the original route is loaded in server.js"
                    });
                }
            });
        }
        
        // Mount the sub-router
        router.use(`/${apiKey}`, subRouter);
    }
}

// ============ MAIN AGGREGATOR ============

router.get('/', async (req, res) => {
    const { section, action, ...params } = req.query;
    
    // If specific section requested
    if (section && routeConfig.apis[section]) {
        const apiConfig = routeConfig.apis[section];
        
        if (action) {
            const endpoint = apiConfig.endpoints.find(ep => ep.name.toLowerCase() === action.toLowerCase());
            if (endpoint) {
                const result = await fetchAPI(`${apiConfig.base_path}${endpoint.path}`, params);
                return res.json({
                    status: true,
                    section: section,
                    action: action,
                    timestamp: new Date().toISOString(),
                    data: result
                });
            }
        }
        
        // Return all endpoints for this section
        return res.json({
            status: true,
            section: section,
            name: apiConfig.name,
            icon: apiConfig.icon,
            endpoints: apiConfig.endpoints.map(ep => ({
                name: ep.name,
                url: `/all-apis/${section}?action=${ep.name.toLowerCase()}`,
                example: ep.example
            }))
        });
    }
    
    // Fetch all sections summary
    const summary = {};
    for (const [key, apiConfig] of Object.entries(routeConfig.apis)) {
        if (apiConfig.enabled !== false) {
            try {
                const response = await axios.get(`${BASE_URL}${apiConfig.base_path}`, { timeout: 5000 });
                summary[key] = {
                    status: true,
                    name: apiConfig.name,
                    info: response.data
                };
            } catch (error) {
                summary[key] = {
                    status: false,
                    name: apiConfig.name,
                    error: error.message
                };
            }
        }
    }
    
    res.json({
        status: true,
        message: "🎬 Mr Thinuzz - Complete API Aggregator",
        author: "Mr Thinuzz",
        version: routeConfig.version,
        timestamp: new Date().toISOString(),
        total_apis: Object.keys(routeConfig.apis).length,
        apis: summary,
        auto_generated_cards: "/all-apis/cards",
        how_to_add_new_api: {
            step1: "Add new API configuration to route-config.json",
            step2: "Restart server - card auto generates!",
            example: {
                new_api: {
                    name: "New API Name",
                    icon: "fa-star",
                    color: "#ff6b6b",
                    base_path: "/newapi",
                    enabled: true,
                    endpoints: [
                        {
                            name: "Get Data",
                            method: "GET",
                            path: "/data",
                            params: ["query"],
                            required_params: ["query"],
                            example: "/newapi/data?query=test"
                        }
                    ]
                }
            }
        }
    });
});

// ============ INSTAGRAM SECTION ============

router.get('/instagram', async (req, res) => {
    res.json({
        status: true,
        section: 'instagram',
        name: "Instagram API",
        message: "Instagram API - Coming Soon!",
        note: "Add Instagram configuration to route-config.json",
        timestamp: new Date().toISOString()
    });
});

// ============ MOVE/ANIMATION SECTION ============

router.get('/move', async (req, res) => {
    res.json({
        status: true,
        section: 'move_animation',
        name: "Move & Animation API",
        icon: "fa-person-walking",
        endpoints_available: [
            "/all-apis/anime - Anime API",
            "/all-apis/movies - Movies API"
        ]
    });
});

// Export router and config reloader
router.reloadConfig = reloadConfig;
module.exports = router;
