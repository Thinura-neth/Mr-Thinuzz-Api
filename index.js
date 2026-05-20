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

// Dynamic Routes තොරතුරු ගබඩා කිරීමට Global Object එකක්
global.loadedRoutesInfo = {};

// ============ AUTO-PARSING & LOADING ALL ROUTES ============
const routesPath = path.join(__dirname, 'routes');
let routeFiles = [];

if (fs.existsSync(routesPath)) {
    routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js'));
    
    routeFiles.forEach(file => {
        const routeName = file.replace('.js', '');
        const routeHandler = require(path.join(routesPath, file));
        
        // 1. මුලින්ම Express Router එක ඇතුළත් කරන්න
        app.use(`/${routeName}`, routeHandler);
        
        // 2. ⚡ Router එක ඇතුළේ තියෙන endpoints ස්වයංක්‍රීයවම සොයාගැනීම (Auto-generation)
        const endpoints = [];
        
        if (routeHandler.stack) {
            routeHandler.stack.forEach(layer => {
                if (layer.route) {
                    const pathStr = layer.route.path;
                    // ප්‍රධාන '/' route එක විස්තර ලැයිස්තුවට දැමීම මඟහරින්න (අවශ්‍ය නම් පමණක් ගන්න)
                    if (pathStr === '/') return; 

                    const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
                    
                    // Route එකේ parameters තියෙනවාද බලන්න (e.g., query params අනුමානය කරන්න)
                    // සාමාන්‍යයෙන් query params කේතයෙන් auto අහුවෙන්නේ නැති නිසා default එකක් දාමු
                    let params = [];
                    let required_params = [];
                    
                    if (pathStr.includes('search')) { params = ['q']; required_params = ['q']; }
                    if (pathStr.includes('info') || pathStr.includes('download')) { params = ['url']; required_params = ['url']; }

                    endpoints.push({
                        name: pathStr.replace('/', '').replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()), // ලස්සන නමක් හැදීම
                        method: methods[0] || 'GET',
                        path: pathStr,
                        params: params,
                        required_params: required_params,
                        example: `/${routeName}${pathStr}${params.length ? `?${params[0]}=test` : ''}`,
                        description: `Auto-generated endpoint for /${routeName}${pathStr}`
                    });
                }
            });
        }

        // 3. ලස්සන Icon සහ Color එකක් දාලා Config එක Auto-generate කිරීම
        // එකම ෆෝල්ඩර එකේ විවිධ ඒවට වෙනස් icon වැටෙන්න default ලිස්ට් එකක් දාමු
        const icons = { game: 'fa-gamepad', movie: 'fa-film', anime: 'fa-dragon', news: 'fa-newspaper', ai: 'fa-robot' };
        const colors = { game: '#10b981', movie: '#6366f1', anime: '#ec4899', news: '#3b82f6', ai: '#8b5cf6' };

        global.loadedRoutesInfo[routeName] = {
            name: `${routeName.charAt(0).toUpperCase() + routeName.slice(1)} API`,
            name_si: `${routeName.charAt(0).toUpperCase() + routeName.slice(1)} API`,
            icon: icons[routeName] || "fa-code",
            color: colors[routeName] || "#6b7280",
            base_path: `/${routeName}`,
            enabled: true,
            endpoints: endpoints
        };
        
        console.log(`⚡ Fully Auto-Generated Info for: /${routeName}`);
    });
} else {
    console.log('⚠️ Routes folder not found, creating...');
    fs.mkdirSync(routesPath, { recursive: true });
}

// ============ IMPORT ALL-APIS ROUTER ============
const allApisRouter = require('./all-apis');
app.use('/all-apis', allApisRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: true, timestamp: new Date().toISOString() });
});

// Root UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 & Error Handler
app.use((req, res) => res.status(404).json({ status: false, error: "Route not found" }));
app.use((err, req, res, next) => res.status(500).json({ status: false, error: err.message }));

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
