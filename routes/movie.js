const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const router = express.Router();

// Cache for API responses (TTL: 10 minutes)
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// ============ HELPER FUNCTIONS ============

function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

function extractMovieId(url) {
    const match = url.match(/\/movies\/([^\/?#]+)/);
    return match ? match[1] : null;
}

// ============ SEARCH FUNCTION ============
async function searchMovies(query, pageNum = 1) {
    const cacheKey = `search_${query}_${pageNum}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log(`📦 Cache hit for search: ${query}`);
        return cached;
    }

    try {
        const searchUrl = `https://cinesubz.lk/page/${pageNum}/?s=${encodeURIComponent(query)}`;
        
        console.log(`🔍 Searching: ${searchUrl}`);
        
        const response = await axios.get(searchUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        
        const $ = cheerio.load(response.data);
        const results = [];
        
        // Extract search results
        $('.display-item, .module-item, .item-box, .post-item').each((i, element) => {
            const $item = $(element);
            
            const title = $item.find('.item-desc-title h3, .item-title, .entry-title').first().text().trim();
            const url = $item.find('a').first().attr('href');
            const poster = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-original');
            const quality = $item.find('.badge-quality-corner').text().trim();
            
            if (title && title.length > 2 && url && (url.includes('/movies/') || url.includes('/movie/'))) {
                results.push({
                    title: cleanText(title),
                    slug: extractMovieId(url),
                    url: url,
                    poster: poster || null,
                    quality: quality || null
                });
            }
        });
        
        // Get pagination info
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
        
        const result = {
            status: true,
            data: {
                query: query,
                page: pageNum,
                total_pages: totalPages,
                has_next_page: pageNum < totalPages,
                total_results: results.length,
                results: results
            }
        };
        
        cache.set(cacheKey, result);
        return result;
        
    } catch (error) {
        console.error(`❌ Search error:`, error.message);
        return {
            status: false,
            error: `Search failed: ${error.message}`
        };
    }
}

// ============ MOVIE INFO FUNCTION ============
async function getMovieInfo(movieUrl) {
    const cacheKey = `info_${movieUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log(`📦 Cache hit for info: ${movieUrl}`);
        return cached;
    }

    try {
        console.log(`🎬 Fetching movie info from: ${movieUrl}`);
        
        const response = await axios.get(movieUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // ============ TITLE ============
        let title = $('.details-title h3').first().text().trim();
        if (!title) title = $('title').text().trim();
        if (!title) title = $('h1').first().text().trim();
        
        const cleanTitle = title
            .replace(' – CineSubz', '')
            .replace(' | සිංහල උපසිරැසි සමඟ', '')
            .replace(' Sinhala Subtitles', '')
            .trim();
        
        // ============ POSTER ============
        let poster = $('.content-poster .poster-img').attr('src');
        if (!poster) poster = $('.poster-img').attr('src');
        if (!poster) poster = $('img[class*="poster"]').first().attr('src');
        if (poster && !poster.startsWith('http')) {
            poster = 'https://cinesubz.net' + poster;
        }
        
        // ============ DESCRIPTION ============
        let description = '';
        
        $('.details-desc p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 100 && text.length < 5000 && !text.includes('Player')) {
                description = text;
                return false;
            }
        });
        
        if (!description) {
            description = $('meta[name="description"]').attr('content') || '';
        }
        
        // ============ IMDb RATING ============
        let imdbRating = null;
        
        const imdbText = $('.data-imdb.v2, .data-imdb').first().text();
        const ratingMatch = imdbText.match(/(\d+\.?\d*)/);
        if (ratingMatch) {
            imdbRating = ratingMatch[1];
        }
        
        if (!imdbRating) {
            const starRating = $('.imdb-rating-badge .imdb-score').text().trim();
            if (starRating) imdbRating = starRating;
        }
        
        // ============ QUALITY ============
        let quality = $('.data-quality').first().text().trim();
        if (!quality) quality = $('.badge-quality-corner').first().text().trim();
        if (!quality) quality = "WEB-DL";
        
        // ============ YEAR ============
        let year = '';
        $('.info-col p, .details-info p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Year:')) {
                const yearMatch = text.match(/Year:\s*(\d{4})/i);
                if (yearMatch) year = yearMatch[1];
            }
        });
        
        if (!year) {
            const yearMatch = cleanTitle.match(/(\d{4})/);
            if (yearMatch) year = yearMatch[1];
        }
        
        // ============ GENRES ============
        const genres = [];
        $('.details-genre a, .genres a').each((i, el) => {
            const genre = $(el).text().trim();
            if (genre && genre.length < 50 && !genres.includes(genre)) {
                genres.push(genre);
            }
        });
        
        // ============ CAST ============
        const cast = [];
        $('.zt-cast-card, .cast-item, .actor-item').each((i, el) => {
            const $card = $(el);
            const name = $card.find('.zt-cast-name, .cast-name, .actor-name').first().text().trim();
            const role = $card.find('.zt-cast-role, .cast-role, .character-name').first().text().trim();
            
            if (name && name.length > 0 && name.length < 100) {
                cast.push({
                    name: name,
                    role: role || null
                });
            }
        });
        
        // ============ DOWNLOAD LINKS (ZT-LINKS ONLY - NO EXTRACTION) ============
        const downloadLinks = [];
        
        $('.movie-download-button').each((i, el) => {
            const $item = $(el);
            let qualityText = $item.find('.movie-download-type').text().trim();
            let sizeText = $item.find('.movie-download-meta').text().trim();
            let ztLink = $item.attr('href');
            
            if (!ztLink) ztLink = $item.find('a').first().attr('href');
            
            if (ztLink && ztLink.includes('/zt-links/')) {
                downloadLinks.push({
                    quality: qualityText || 'Unknown',
                    size: sizeText || 'Unknown',
                    url: ztLink
                });
            }
        });
        
        $('.links-table tbody tr').each((i, el) => {
            const $row = $(el);
            const qualityText = $row.find('td:first-child').text().trim();
            const sizeText = $row.find('td:nth-child(2)').text().trim();
            const ztLink = $row.find('td:last-child a').attr('href');
            
            if (ztLink && ztLink.includes('/zt-links/')) {
                const exists = downloadLinks.some(l => l.url === ztLink);
                if (!exists) {
                    downloadLinks.push({
                        quality: qualityText || 'Unknown',
                        size: sizeText || 'Unknown',
                        url: ztLink
                    });
                }
            }
        });
        
        const result = {
            status: true,
            data: {
                title: cleanTitle,
                url: movieUrl,
                poster: poster || null,
                description: description || null,
                imdb_rating: imdbRating || null,
                quality: quality,
                year: year || null,
                genres: genres,
                cast: cast.slice(0, 10),
                download_links: downloadLinks
            }
        };
        
        cache.set(cacheKey, result);
        return result;
        
    } catch (error) {
        console.error(`❌ Movie info error:`, error.message);
        return {
            status: false,
            error: `Failed to fetch: ${error.message}`,
            url: movieUrl
        };
    }
}

// ============ ROUTES ============

router.get('/', (req, res) => {
    res.json({
        status: true,
        message: "🎬 CineSubz Movie API - Search & Info Only",
        author: "Mr Thinuzz",
        version: "2.0.0",
        endpoints: {
            "GET /search?q=QUERY&page=1": "Search movies on CineSubz",
            "GET /info?url=URL": "Get movie details from movie page"
        },
        examples: {
            search: "/search?q=breaking+bad",
            search_page2: "/search?q=game+of+thrones&page=2",
            info: "/info?url=https://cinesubz.net/movies/kiss-of-the-spider-woman-2025-sinhala-subtitles/"
        }
    });
});

// ============ SEARCH ENDPOINT ============
router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    
    if (!q) {
        return res.status(400).json({
            status: false,
            error: "Search query parameter 'q' is required",
            usage: "/search?q=YOUR_SEARCH_TERM",
            example: "/search?q=breaking+bad"
        });
    }
    
    const query = decodeURIComponent(q);
    const pageNum = parseInt(page) || 1;
    const result = await searchMovies(query, pageNum);
    res.json(result);
});

// ============ INFO ENDPOINT ============
router.get('/info', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            usage: "/info?url=MOVIE_PAGE_URL",
            example: "/info?url=https://cinesubz.net/movies/kiss-of-the-spider-woman-2025-sinhala-subtitles/"
        });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
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
    
    const result = await getMovieInfo(decodedUrl);
    res.json(result);
});

module.exports = router;
