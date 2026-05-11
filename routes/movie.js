const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const router = express.Router();

// Cache for API responses (TTL: 1 hour)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// SADAS API Configuration
const SADAS_API_KEY = 'b70d2c3be55a4bd017321ee4beb00af5';
const SADAS_BASE_URL = 'https://apis.sadas.dev/api/v1/movie/cinesubz';

// ============ HELPER FUNCTIONS ============

function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

function extractMovieId(url) {
    const match = url.match(/\/movies\/([^\/?#]+)/);
    return match ? match[1] : null;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ PROXY TO SADAS API ============

// Get movie info from sadas.dev API
async function getMovieInfoFromSadas(movieUrl) {
    const cacheKey = `info_${movieUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log(`📦 Cache hit for info: ${movieUrl}`);
        return cached;
    }
    
    try {
        console.log(`🎬 Fetching movie info from SADAS API: ${movieUrl}`);
        
        const response = await axios.get(`${SADAS_BASE_URL}/info`, {
            params: {
                q: movieUrl,
                apiKey: SADAS_API_KEY
            },
            timeout: 30000,
            headers: {
                'User-Agent': 'Mr-Thinuzz-API/1.0',
                'Accept': 'application/json'
            }
        });
        
        if (response.data && response.data.status === true) {
            // Transform to match your existing format if needed
            const result = {
                status: true,
                data: response.data.data,
                remainingCoins: response.data.remainingCoins || 0,
                source: "sadas.dev API",
                timestamp: new Date().toISOString()
            };
            
            cache.set(cacheKey, result);
            return result;
        } else {
            return {
                status: false,
                error: response.data?.error || "Failed to fetch movie info",
                timestamp: new Date().toISOString()
            };
        }
        
    } catch (error) {
        console.error(`❌ SADAS API error:`, error.message);
        return {
            status: false,
            error: `Failed to fetch from SADAS API: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// Get download link from sadas.dev API
async function getDownloadLinkFromSadas(downloadUrl) {
    const cacheKey = `dl_${downloadUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log(`📦 Cache hit for download: ${downloadUrl}`);
        return cached;
    }
    
    try {
        console.log(`📥 Fetching download link from SADAS API: ${downloadUrl}`);
        
        const response = await axios.get(`${SADAS_BASE_URL}/dl`, {
            params: {
                q: downloadUrl,
                apiKey: SADAS_API_KEY
            },
            timeout: 30000,
            headers: {
                'User-Agent': 'Mr-Thinuzz-API/1.0',
                'Accept': 'application/json'
            }
        });
        
        if (response.data && response.data.status === true) {
            const result = {
                success: true,
                download_url: response.data.download_url || response.data.data?.download_url,
                original_url: downloadUrl,
                source: "sadas.dev API",
                timestamp: new Date().toISOString()
            };
            
            cache.set(cacheKey, result);
            return result;
        } else {
            return {
                success: false,
                error: response.data?.error || "Failed to get download link",
                original_url: downloadUrl,
                timestamp: new Date().toISOString()
            };
        }
        
    } catch (error) {
        console.error(`❌ SADAS DL API error:`, error.message);
        return {
            success: false,
            error: `Failed to fetch from SADAS API: ${error.message}`,
            original_url: downloadUrl,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ SEARCH FUNCTION (Direct from CineSubz - No API) ============
async function searchMovies(query, pageNum = 1) {
    try {
        console.log(`🔍 Searching CineSubz: ${query}`);
        
        const searchUrl = `https://cinesubz.lk/page/${pageNum}/?s=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const cheerio = require('cheerio');
        const $ = cheerio.load(response.data);
        const results = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            const title = $item.find('.item-desc-title h3, .item-title').first().text().trim();
            const movieUrl = $item.find('a').first().attr('href');
            const poster = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-original');
            
            if (title && movieUrl && (movieUrl.includes('/movies/') || movieUrl.includes('/movie/'))) {
                results.push({
                    title: cleanText(title),
                    slug: extractMovieId(movieUrl),
                    url: movieUrl,
                    poster: poster || null
                });
            }
        });
        
        let totalPages = 1;
        $('.pagination a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/page/')) {
                const pageMatch = href.match(/\/page\/(\d+)/);
                if (pageMatch && parseInt(pageMatch[1]) > totalPages) {
                    totalPages = parseInt(pageMatch[1]);
                }
            }
        });
        
        return {
            success: true,
            data: {
                query: query,
                page: pageNum,
                total_pages: totalPages,
                has_next_page: pageNum < totalPages,
                total_results: results.length,
                results: results.slice(0, 50)
            }
        };
        
    } catch (error) {
        console.error(`❌ Search error:`, error.message);
        return {
            success: false,
            error: `Search failed: ${error.message}`
        };
    }
}

// ============ RECENT MOVIES FUNCTION (Direct from CineSubz - No API) ============
async function getRecentMovies(pageNum = 1) {
    try {
        const url = pageNum === 1 
            ? 'https://cinesubz.lk/movies/' 
            : `https://cinesubz.lk/movies/page/${pageNum}/`;
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const cheerio = require('cheerio');
        const $ = cheerio.load(response.data);
        const movies = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            const title = $item.find('.item-desc-title h3, .item-title').first().text().trim();
            const movieUrl = $item.find('a').first().attr('href');
            const poster = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-original');
            
            if (title && movieUrl && (movieUrl.includes('/movies/') || movieUrl.includes('/movie/'))) {
                movies.push({
                    title: cleanText(title),
                    slug: extractMovieId(movieUrl),
                    url: movieUrl,
                    poster: poster || null
                });
            }
        });
        
        let totalPages = 1;
        $('.pagination a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/page/')) {
                const pageMatch = href.match(/\/page\/(\d+)/);
                if (pageMatch && parseInt(pageMatch[1]) > totalPages) {
                    totalPages = parseInt(pageMatch[1]);
                }
            }
        });
        
        return {
            success: true,
            data: {
                page: pageNum,
                total_pages: totalPages,
                has_next_page: pageNum < totalPages,
                total_movies: movies.length,
                movies: movies
            }
        };
        
    } catch (error) {
        console.error(`❌ Recent movies error:`, error.message);
        return {
            success: false,
            error: `Failed to fetch: ${error.message}`
        };
    }
}

// ============ ROUTES ============

router.get('/', (req, res) => {
    res.json({
        status: true,
        message: "🎬 CineSubz Movie API - Powered by SADAS API",
        author: "Mr Thinuzz",
        version: "5.0.0",
        endpoints: {
            "GET /info?q=URL": "Get movie details (via SADAS API)",
            "GET /extract?url=URL": "Extract download link (via SADAS API)",
            "GET /search?q=QUERY&page=1": "Search movies (Direct from CineSubz)",
            "GET /recent?page=1": "Get recently added movies (Direct from CineSubz)"
        },
        examples: {
            info: "/info?q=https://cinesubz.net/movies/guns-blazin-2024-sinhala-subtitles/",
            extract: "/extract?url=https://bot3.sonic-cloud.online/server6/202601/Guns%20Blazin%20(2024)%20English%20WEB-%5BCineSubz.co%5D-480p.mp4",
            search: "/search?q=guns%20blazin",
            recent: "/recent"
        }
    });
});

// ============ INFO ENDPOINT (Proxy to SADAS) ============
router.get('/info', async (req, res) => {
    const { q, url } = req.query;
    const targetUrl = q || url;
    
    if (!targetUrl) {
        return res.status(400).json({
            status: false,
            error: "URL parameter 'q' or 'url' is required",
            example: "/info?q=https://cinesubz.net/movies/guns-blazin-2024-sinhala-subtitles/"
        });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(targetUrl);
    } catch (e) {
        decodedUrl = targetUrl;
    }
    
    if (!decodedUrl.includes('cinesubz.net') && !decodedUrl.includes('cinesubz.lk')) {
        return res.status(400).json({
            status: false,
            error: "Only cinesubz.net or cinesubz.lk URLs are allowed"
        });
    }
    
    if (!decodedUrl.includes('/movies/') && !decodedUrl.includes('/movie/')) {
        return res.status(400).json({
            status: false,
            error: "URL must be a movie page (contains /movies/ or /movie/)"
        });
    }
    
    console.log(`📥 Movie info request: ${decodedUrl}`);
    const result = await getMovieInfoFromSadas(decodedUrl);
    res.json(result);
});

// ============ EXTRACT ENDPOINT (Proxy to SADAS DL) ============
router.get('/extract', async (req, res) => {
    const { url, q } = req.query;
    const targetUrl = url || q;
    
    if (!targetUrl) {
        return res.status(400).json({
            success: false,
            error: "URL parameter is required",
            usage: "/extract?url=https://bot3.sonic-cloud.online/...",
            example: "/extract?url=https://bot3.sonic-cloud.online/server6/202601/Guns%20Blazin%20(2024)%20English%20WEB-%5BCineSubz.co%5D-480p.mp4"
        });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(targetUrl);
    } catch (e) {
        decodedUrl = targetUrl;
    }
    
    console.log(`📥 Extract request: ${decodedUrl}`);
    const result = await getDownloadLinkFromSadas(decodedUrl);
    res.json(result);
});

// ============ SEARCH ENDPOINT (Direct from CineSubz) ============
router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    
    if (!q) {
        return res.status(400).json({
            success: false,
            error: "Search query parameter 'q' is required"
        });
    }
    
    const query = decodeURIComponent(q);
    const pageNum = parseInt(page) || 1;
    const result = await searchMovies(query, pageNum);
    res.json(result);
});

// ============ RECENT ENDPOINT (Direct from CineSubz) ============
router.get('/recent', async (req, res) => {
    const pageNum = parseInt(req.query.page) || 1;
    const result = await getRecentMovies(pageNum);
    res.json(result);
});

module.exports = router;
