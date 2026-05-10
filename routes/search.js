const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        status: true,
        message: "🔍 Universal Search API",
        author: "Mr Thinuzz",
        status_type: "coming_soon",
        timestamp: new Date().toISOString(),
        endpoints: {
            "GET /search/web?q=QUERY": "Web search",
            "GET /search/images?q=QUERY": "Image search",
            "GET /search/news?q=QUERY": "News search"
        },
        coming_soon: true,
        estimated_release: "Coming Soon"
    });
});

router.get('/web', async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({
            status: false,
            error: "Search query 'q' is required"
        });
    }
    
    res.json({
        status: "coming_soon",
        message: "Web search feature is under development",
        query: decodeURIComponent(q),
        timestamp: new Date().toISOString()
    });
});

router.get('/images', async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({
            status: false,
            error: "Search query 'q' is required"
        });
    }
    
    res.json({
        status: "coming_soon",
        message: "Image search feature is under development",
        query: decodeURIComponent(q),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
