const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const router = express.Router();

// Cache for API responses (TTL: 1 hour)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

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

// ============ SCRAPE MOVIE INFO FROM CINESUBZ ============

async function scrapeMovieInfo(movieUrl) {
    const cacheKey = `info_${movieUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log(`📦 Cache hit for info: ${movieUrl}`);
        return cached;
    }
    
    try {
        console.log(`🎬 Scraping movie info from: ${movieUrl}`);
        
        const response = await axios.get(movieUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        
        const cheerio = require('cheerio');
        const $ = cheerio.load(response.data);
        
        // Extract movie details
        const title = $('h1.entry-title, .movie-title, .title').first().text().trim();
        const poster = $('.movie-poster img, .featured-image img, .poster img').first().attr('src') || 
                       $('img.wp-post-image').first().attr('src');
        
        // Extract description/summary
        const description = $('.movie-description, .entry-content p, .summary, .description').first().text().trim();
        
        // Extract movie metadata
        const movieInfo = {};
        $('.movie-info li, .info-item, .meta-item').each((i, el) => {
            const label = $(el).find('.label, .info-label').text().trim().replace(':', '');
            const value = $(el).find('.value, .info-value').text().trim();
            if (label && value) {
                movieInfo[label.toLowerCase()] = value;
            }
        });
        
        // Extract download links / quality options
        const downloadLinks = [];
        $('.download-links a, .movie-download-links a, .quality-item a, .download-btn').each((i, el) => {
            const linkUrl = $(el).attr('href');
            const quality = $(el).find('.quality, .badge').text().trim() || 
                           $(el).text().match(/\d+p/i)?.[0] || 
                           `Link ${i + 1}`;
            
            if (linkUrl && (linkUrl.startsWith('http') || linkUrl.startsWith('//'))) {
                downloadLinks.push({
                    quality: quality,
                    url: linkUrl.startsWith('//') ? `https:${linkUrl}` : linkUrl
                });
            }
        });
        
        // Extract iframe sources (embed links)
        const embedLinks = [];
        $('iframe, .embed-container iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.startsWith('http')) {
                embedLinks.push(src);
            }
        });
        
        // Extract genres
        const genres = [];
        $('.genres a, .genre a, .movie-genres a').each((i, el) => {
            const genre = $(el).text().trim();
            if (genre) genres.push(genre);
        });
        
        // Extract cast
        const cast = [];
        $('.cast a, .actors a, .movie-cast a').each((i, el) => {
            const actor = $(el).text().trim();
            if (actor) cast.push(actor);
        });
        
        const result = {
            status: true,
            data: {
                url: movieUrl,
                title: cleanText(title),
                poster: poster || null,
                description: cleanText(description),
                genres: genres,
                cast: cast,
                metadata: movieInfo,
                download_links: downloadLinks,
                embed_links: embedLinks,
                source: "Scraped from CineSubz",
                scraped_at: new Date().toISOString()
            }
        };
        
        // Cache the result
        cache.set(cacheKey, result);
        return result;
        
    } catch (error) {
        console.error(`❌ Scraping error:`, error.message);
        return {
            status: false,
            error: `Failed to scrape movie info: ${error.message}`,
            url: movieUrl,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ SEARCH FUNCTION (Direct from CineSubz) ============
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

// ============ RECENT MOVIES FUNCTION (Direct from CineSubz) ============
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
        message: "🎬 CineSubz Movie API - Powered by Web Scraping",
        author: "Mr Thinuzz",
        version: "6.0.0",
        endpoints: {
            "GET /info?q=URL": "Get movie details (Scraped from CineSubz)",
            "GET /search?q=QUERY&page=1": "Search movies (Direct from CineSubz)",
            "GET /recent?page=1": "Get recently added movies (Direct from CineSubz)"
        },
        examples: {
            info: "/info?q=https://cinesubz.lk/movies/guns-blazin-2024-sinhala-subtitles/",
            search: "/search?q=guns%20blazin",
            recent: "/recent"
        }
    });
});

// ============ INFO ENDPOINT (Scraped from CineSubz) ============
router.get('/info', async (req, res) => {
    const { q, url } = req.query;
    const targetUrl = q || url;
    
    if (!targetUrl) {
        return res.status(400).json({
            status: false,
            error: "URL parameter 'q' or 'url' is required",
            example: "/info?q=https://cinesubz.lk/movies/guns-blazin-2024-sinhala-subtitles/"
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
    const result = await scrapeMovieInfo(decodedUrl);
    res.json(result);
});

// ============ SEARCH ENDPOINT ============
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

// ============ RECENT ENDPOINT ============
router.get('/recent', async (req, res) => {
    const pageNum = parseInt(req.query.page) || 1;
    const result = await getRecentMovies(pageNum);
    res.json(result);
});

module.exports = router;
