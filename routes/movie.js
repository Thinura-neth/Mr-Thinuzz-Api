const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const cheerio = require('cheerio');
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

// ============ SCRAPE MOVIE INFO WITH DOWNLOAD LINKS ============
async function getMovieInfoWithDownloads(movieUrl) {
    const cacheKey = `movie_info_${movieUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log(`📦 Cache hit: ${movieUrl}`);
        return cached;
    }
    
    try {
        console.log(`🎬 Scraping: ${movieUrl}`);
        
        const response = await axios.get(movieUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://cinesubz.lk/'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract movie details
        const title = cleanText($('h1.entry-title, .movie-title, h1.title').first().text());
        const poster = $('img.wp-post-image, .movie-poster img, .featured-image img').first().attr('src') || 
                       $('img[itemprop="image"]').attr('src');
        
        // Extract description/summary
        const description = cleanText($('.movie-description, .entry-content p, .summary').first().text());
        
        // Extract movie info (year, quality, etc)
        let year = '';
        let quality = '';
        let runtime = '';
        
        $('.movie-info li, .info-item, .meta-item').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Year') || text.includes('Release')) {
                year = text.match(/\d{4}/)?.[0] || '';
            }
            if (text.includes('Quality')) {
                quality = text.split(':')[1]?.trim() || '';
            }
            if (text.includes('Runtime')) {
                runtime = text.split(':')[1]?.trim() || '';
            }
        });
        
        // ============ EXTRACT ALL DOWNLOAD LINKS ============
        const downloadLinks = [];
        
        // Method 1: Look for iframe src (embedded players)
        $('iframe').each((i, el) => {
            let src = $(el).attr('src');
            if (src && (src.includes('.mp4') || src.includes('download') || src.includes('/dl/'))) {
                downloadLinks.push({
                    quality: 'iframe',
                    url: src,
                    type: 'direct'
                });
            }
        });
        
        // Method 2: Look for direct video links
        $('a[href*=".mp4"], a[href*=".mkv"], a[href*=".avi"], a[href*=".mov"]').each((i, el) => {
            const url = $(el).attr('href');
            const text = $(el).text();
            
            // Detect quality from filename or link text
            let detectedQuality = 'unknown';
            if (url.includes('480p') || text.includes('480p')) detectedQuality = '480p';
            if (url.includes('720p') || text.includes('720p')) detectedQuality = '720p';
            if (url.includes('1080p') || text.includes('1080p')) detectedQuality = '1080p';
            if (url.includes('4K') || text.includes('4k')) detectedQuality = '4K';
            
            downloadLinks.push({
                quality: detectedQuality,
                url: url,
                text: cleanText(text),
                type: 'direct'
            });
        });
        
        // Method 3: Look for download buttons/links
        $('.download-btn, .download-link, a[href*="download"], .btn-download').each((i, el) => {
            const url = $(el).attr('href');
            const text = $(el).text();
            
            if (url && !url.includes('#') && !url.includes('javascript')) {
                let detectedQuality = 'unknown';
                if (text.includes('480') || url.includes('480')) detectedQuality = '480p';
                if (text.includes('720') || url.includes('720')) detectedQuality = '720p';
                if (text.includes('1080') || url.includes('1080')) detectedQuality = '1080p';
                
                downloadLinks.push({
                    quality: detectedQuality,
                    url: url,
                    text: cleanText(text),
                    type: 'download_button'
                });
            }
        });
        
        // Method 4: Look for script tags with video URLs
        $('script').each((i, el) => {
            const scriptContent = $(el).html();
            if (scriptContent) {
                // Look for mp4 URLs in scripts
                const mp4Matches = scriptContent.match(/https?:\/\/[^\s"'<>]+\.(?:mp4|mkv|avi|mov)/gi);
                if (mp4Matches) {
                    mp4Matches.forEach(url => {
                        let quality = 'unknown';
                        if (url.includes('480p')) quality = '480p';
                        if (url.includes('720p')) quality = '720p';
                        if (url.includes('1080p')) quality = '1080p';
                        
                        downloadLinks.push({
                            quality: quality,
                            url: url,
                            type: 'script_extracted'
                        });
                    });
                }
            }
        });
        
        // Method 5: Check for server URLs in data attributes
        $('[data-src*=".mp4"], [data-video*=".mp4"], [data-url*=".mp4"]').each((i, el) => {
            const url = $(el).attr('data-src') || $(el).attr('data-video') || $(el).attr('data-url');
            if (url) {
                downloadLinks.push({
                    quality: 'unknown',
                    url: url,
                    type: 'data_attribute'
                });
            }
        });
        
        // Remove duplicates
        const uniqueLinks = [];
        const seenUrls = new Set();
        for (const link of downloadLinks) {
            if (!seenUrls.has(link.url)) {
                seenUrls.add(link.url);
                uniqueLinks.push(link);
            }
        }
        
        const result = {
            success: true,
            data: {
                title: title || 'Unknown Title',
                slug: extractMovieId(movieUrl),
                url: movieUrl,
                poster: poster || null,
                description: description,
                year: year,
                quality: quality,
                runtime: runtime,
                download_links: uniqueLinks.length > 0 ? uniqueLinks : [],
                total_download_links: uniqueLinks.length,
                scraped_at: new Date().toISOString()
            }
        };
        
        // Cache the result
        cache.set(cacheKey, result);
        return result;
        
    } catch (error) {
        console.error(`❌ Scraping error:`, error.message);
        return {
            success: false,
            error: `Failed to scrape: ${error.message}`,
            url: movieUrl
        };
    }
}

// ============ SEARCH MOVIES ============
async function searchMovies(query, pageNum = 1) {
    try {
        console.log(`🔍 Searching: ${query}`);
        
        const searchUrl = `https://cinesubz.lk/page/${pageNum}/?s=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const results = [];
        
        $('.display-item, .module-item, .item-box, article').each((i, element) => {
            const $item = $(element);
            const title = $item.find('.item-desc-title h3, .item-title, h2.entry-title').first().text().trim();
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
                results: results
            }
        };
        
    } catch (error) {
        return {
            success: false,
            error: `Search failed: ${error.message}`
        };
    }
}

// ============ RECENT MOVIES ============
async function getRecentMovies(pageNum = 1) {
    try {
        const url = pageNum === 1 
            ? 'https://cinesubz.lk/movies/' 
            : `https://cinesubz.lk/movies/page/${pageNum}/`;
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const movies = [];
        
        $('.display-item, .module-item, .item-box, article').each((i, element) => {
            const $item = $(element);
            const title = $item.find('.item-desc-title h3, .item-title, h2.entry-title').first().text().trim();
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
        message: "🎬 CineSubz Movie API - Direct Download Links",
        author: "Mr Thinuzz",
        version: "6.0.0",
        endpoints: {
            "GET /info?url=URL": "Get movie details with ALL download links",
            "GET /search?q=QUERY&page=1": "Search movies",
            "GET /recent?page=1": "Get recently added movies"
        },
        examples: {
            info: "/info?url=https://cinesubz.lk/movies/guns-blazin-2024-sinhala-subtitles/",
            search: "/search?q=guns%20blazin",
            recent: "/recent"
        }
    });
});

// ============ INFO ENDPOINT - WITH DIRECT DOWNLOAD LINKS ============
router.get('/info', async (req, res) => {
    const { url, q } = req.query;
    const targetUrl = url || q;
    
    if (!targetUrl) {
        return res.status(400).json({
            success: false,
            error: "URL parameter 'url' or 'q' is required",
            example: "/info?url=https://cinesubz.lk/movies/movie-name/"
        });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(targetUrl);
    } catch (e) {
        decodedUrl = targetUrl;
    }
    
    if (!decodedUrl.includes('cinesubz.lk') && !decodedUrl.includes('cinesubz.net')) {
        return res.status(400).json({
            success: false,
            error: "Only cinesubz.lk or cinesubz.net URLs are allowed"
        });
    }
    
    console.log(`📥 Info request: ${decodedUrl}`);
    const result = await getMovieInfoWithDownloads(decodedUrl);
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
