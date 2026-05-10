const express = require('express');
const moviesRouter = require('./routes/movies');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Routes
app.use('/movies', moviesRouter);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "🎬 CineSubz Movie API - Real-time Scraper",
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString(),
        endpoints: {
            "GET /movies": "API information",
            "GET /movies/search?q=SEARCH": "Search movies",
            "GET /movies/search?q=SEARCH&page=2": "Search with pagination",
            "GET /movies/recent": "Recently added movies",
            "GET /movies/recent?page=2": "Recent movies with pagination",
            "GET /movies/info?url=URL": "Get complete movie details",
            "GET /movies/popular": "Popular/trending movies"
        },
        examples: {
            search: "http://localhost:3000/movies/search?q=oppenheimer",
            recent: "http://localhost:3000/movies/recent",
            info: "http://localhost:3000/movies/info?url=https://cinesubz.net/movies/dune-2021-sinhala-subtitles/"
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: false,
        error: "Endpoint not found",
        timestamp: new Date().toISOString()
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        status: false,
        error: "Internal server error",
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🎬 CineSubz Movie API - Real-time Scraper                 ║
║                                                              ║
║   Server running on: http://localhost:${PORT}                 ║
║                                                              ║
║   Endpoints:                                                ║
║   • GET  /movies                                            ║
║   • GET  /movies/search?q=KEYWORD                           ║
║   • GET  /movies/recent                                     ║
║   • GET  /movies/info?url=URL                               ║
║   • GET  /movies/popular                                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
