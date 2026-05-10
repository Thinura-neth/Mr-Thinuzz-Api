const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// ============ HELPER FUNCTIONS ============

function extractMovieId(url) {
    const match = url.match(/\/movies\/([^\/?#]+)/);
    return match ? match[1] : null;
}

function extractFilenameFromUrl(url) {
    try {
        if (url.includes('#')) {
            return decodeURIComponent(url.split('#')[1]);
        }
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.includes('.')) {
            return decodeURIComponent(lastPart);
        }
        return "download_file.mp4";
    } catch (e) {
        return "download_file.mp4";
    }
}

function extractHostFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch (e) {
        return 'unknown';
    }
}

// ============ GET MOVIE INFO (Main Function) ============

async function getMovieInfo(url) {
    try {
        console.log(`🎬 Fetching movie info: ${url}`);
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // ===== TITLE =====
        let title = $('.details-title h3').first().text().trim();
        if (!title) title = $('title').text().replace(' – CineSubz.lk - Sinhala Subtitles', '').replace(' | සිංහල උපසිරැසි සමඟ', '').trim();
        
        // ===== POSTER =====
        let poster = $('.content-poster .poster-img').attr('src');
        if (!poster) poster = $('.poster-img').attr('src');
        if (poster && !poster.startsWith('http')) poster = 'https://cinesubz.net' + poster;
        
        // ===== BACKDROP IMAGES =====
        const backdropImages = [];
        $('.content-gall .gall-item a').each((i, el) => {
            const imgUrl = $(el).attr('href');
            if (imgUrl && imgUrl.startsWith('http')) {
                backdropImages.push(imgUrl);
            }
        });
        
        // ===== IMDb RATING =====
        let imdbRating = null;
        let imdbVotes = null;
        const imdbElement = $('.data-imdb.v2');
        if (imdbElement.length) {
            const imdbText = imdbElement.text().trim();
            const ratingMatch = imdbText.match(/IMDb:\s*([\d.]+)/i);
            const votesMatch = imdbText.match(/\(([\d.]+K?)\)/i);
            if (ratingMatch) imdbRating = ratingMatch[1];
            if (votesMatch) imdbVotes = votesMatch[1];
        }
        
        // Fallback
        if (!imdbRating) {
            const imdbText = $('.data-imdb').text().trim();
            const match = imdbText.match(/([\d.]+)/);
            if (match) imdbRating = match[1];
        }
        
        // ===== QUALITY =====
        let quality = $('.data-quality').first().text().trim();
        if (!quality) quality = $('.badge-quality-corner').first().text().trim();
        
        // ===== RUNTIME =====
        let runtime = null;
        const durationElement = $('.data-views[itemprop="duration"]');
        if (durationElement.length) {
            runtime = durationElement.text().trim();
        }
        
        // ===== YEAR =====
        let year = null;
        $('.info-col p, .details-info p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Year:')) {
                const yearMatch = text.match(/Year:\s*(\d{4})/i);
                if (yearMatch) year = yearMatch[1];
            }
        });
        
        // ===== COUNTRY =====
        let country = null;
        $('.info-col p, .details-info p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Country:')) {
                country = text.replace('Country:', '').trim();
            }
        });
        
        // ===== DIRECTORS =====
        const directors = [];
        $('.info-col p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Director:')) {
                $(el).find('a').each((j, a) => {
                    directors.push($(a).text().trim());
                });
            }
        });
        
        // ===== SUBTITLE BY =====
        let subtitleBy = null;
        $('.info-col p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Subtitle By:')) {
                subtitleBy = text.replace('Subtitle By:', '').trim();
            }
        });
        
        // ===== GENRES =====
        const genres = [];
        $('.details-genre a').each((i, el) => {
            const genre = $(el).text().trim();
            if (genre && genre.length < 50 && !genres.includes(genre)) {
                genres.push(genre);
            }
        });
        
        // ===== CAST =====
        const cast = [];
        $('.zt-cast-card').each((i, el) => {
            const $card = $(el);
            const name = $card.find('.zt-cast-name').text().trim();
            const role = $card.find('.zt-cast-role').text().trim();
            const image = $card.find('.zt-cast-image img').attr('src');
            const castUrl = $card.find('.zt-cast-link').attr('href');
            
            if (name) {
                cast.push({
                    name: name,
                    role: role || null,
                    image: image || null,
                    url: castUrl ? (castUrl.startsWith('http') ? castUrl : 'https://cinesubz.net' + castUrl) : null
                });
            }
        });
        
        // ===== DESCRIPTION =====
        let description = '';
        $('.details-desc p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 5000 && !text.includes('Button එක ඔබලා')) {
                description = text;
                return false;
            }
        });
        
        // ===== TAGLINE =====
        let tagline = null;
        const taglineElement = $('.movie-tagline-box .tagline-text');
        if (taglineElement.length) {
            tagline = taglineElement.text().trim();
        }
        
        // ===== DOWNLOAD LINKS =====
        const downloadLinks = [];
        
        // Movie download buttons
        $('.movie-download-button').each((i, el) => {
            const href = $(el).attr('href');
            const type = $(el).find('.movie-download-type').text().trim();
            const meta = $(el).find('.movie-download-meta').text().trim();
            
            if (href && href.startsWith('https://cinesubz.net/zt-links/')) {
                downloadLinks.push({
                    url: href,
                    type: type || 'Direct & Telegram Download',
                    meta: meta || null,
                    host: 'cinesubz.net'
                });
            }
        });
        
        // Alternative download section
        $('.link-directandtgdownload .movie-download-link-item a').each((i, el) => {
            const href = $(el).attr('href');
            const meta = $(el).find('.movie-download-meta').text().trim();
            
            if (href && href.startsWith('https://cinesubz.net/zt-links/')) {
                const exists = downloadLinks.some(link => link.url === href);
                if (!exists) {
                    downloadLinks.push({
                        url: href,
                        type: 'Direct & Telegram Download',
                        meta: meta || null,
                        host: 'cinesubz.net'
                    });
                }
            }
        });
        
        // External links
        $('.links-table tbody tr td a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && (href.startsWith('http') || href.startsWith('magnet')) && !href.includes('cinesubz.net')) {
                const text = $(el).text().trim();
                downloadLinks.push({
                    url: href,
                    type: text || 'External Link',
                    meta: null,
                    host: extractHostFromUrl(href)
                });
            }
        });
        
        // ===== PLAYERS =====
        const players = [];
        $('.play-lists li.zetaflix_player_option').each((i, el) => {
            const serverName = $(el).find('.opt-name').text().trim();
            const serverTitle = $(el).find('.opt-titl').text().trim();
            const isTrailer = $(el).attr('id') === 'player-option-trailer';
            
            players.push({
                name: serverName || 'Server',
                title: serverTitle || null,
                is_trailer: isTrailer
            });
        });
        
        // ===== SIMILAR MOVIES =====
        const similarMovies = [];
        $('.similar-item, .related-item').each((i, el) => {
            const $item = $(el);
            const similarTitle = $item.find('.item-data h3, .data-title').text().trim();
            const movieUrl = $item.find('.item-url, a').first().attr('href');
            const similarPoster = $item.find('img').first().attr('src');
            
            if (similarTitle && movieUrl && movieUrl.includes('/movies/')) {
                similarMovies.push({
                    title: similarTitle,
                    slug: extractMovieId(movieUrl),
                    url: movieUrl,
                    poster: similarPoster || null
                });
            }
        });
        
        // ===== KEYWORDS =====
        const keywords = [];
        $('.data-keywords-inline a, .content-keywords a').each((i, el) => {
            const keyword = $(el).text().trim();
            if (keyword && !keywords.includes(keyword)) {
                keywords.push(keyword);
            }
        });
        
        // ===== SEARCH BOX RESULTS (for debugging) =====
        const searchResults = [];
        $('.search-results .result-title').each((i, el) => {
            const searchTitle = $(el).text().trim();
            if (searchTitle) searchResults.push(searchTitle);
        });
        
        // ===== CLEAN TITLE =====
        const cleanTitle = title.replace(' Sinhala Subtitles | සිංහල උපසිරැසි සමඟ', '').trim();
        
        // Remove duplicate download links
        const uniqueDownloads = [];
        const seenUrls = new Set();
        for (const link of downloadLinks) {
            if (!seenUrls.has(link.url)) {
                seenUrls.add(link.url);
                uniqueDownloads.push(link);
            }
        }
        
        return {
            status: true,
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                title: cleanTitle,
                original_title: title,
                slug: extractMovieId(url),
                url: url,
                poster: poster,
                backdrop_images: backdropImages,
                tagline: tagline,
                description: description,
                imdb_rating: imdbRating,
                imdb_votes: imdbVotes,
                quality: quality,
                runtime: runtime,
                year: year,
                country: country,
                directors: directors,
                subtitle_by: subtitleBy,
                genres: genres,
                cast: cast,
                keywords: keywords,
                download_links: uniqueDownloads,
                players: players,
                similar_movies: similarMovies
            }
        };
        
    } catch (error) {
        console.error(`❌ Movie info error:`, error.message);
        return {
            status: false,
            success: false,
            error: `Failed to fetch: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ SEARCH MOVIES ============

async function searchMovies(query, page = 1) {
    try {
        console.log(`🔍 Searching for: ${query} (Page: ${page})`);
        
        const searchUrl = `https://cinesubz.net/page/${page}/?s=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const results = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            let title = $item.find('.item-desc-title h3, .item-title, .item-data h3').text().trim();
            let url = $item.find('a').first().attr('href');
            let poster = $item.find('.thumb').attr('data-original') || $item.find('.thumb').attr('src');
            let imdbRating = $item.find('.imdb-rating-badge .imdb-score').text().trim();
            let quality = $item.find('.badge-quality-corner').text().trim();
            
            if (!title) title = $item.find('a[title]').attr('title');
            
            if (title && url && url.includes('/movies/')) {
                results.push({
                    title: title,
                    slug: extractMovieId(url),
                    url: url,
                    poster: poster || null,
                    imdb_rating: imdbRating || null,
                    quality: quality || null
                });
            }
        });
        
        // Get pagination
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
        
        const uniqueResults = [];
        const seenUrls = new Set();
        for (const result of results) {
            if (!seenUrls.has(result.url)) {
                seenUrls.add(result.url);
                uniqueResults.push(result);
            }
        }
        
        return {
            status: true,
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                query: query,
                page: page,
                total_pages: totalPages,
                has_next_page: page < totalPages,
                total_results: uniqueResults.length,
                results: uniqueResults.slice(0, 50)
            }
        };
        
    } catch (error) {
        return {
            status: false,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ RECENT MOVIES ============

async function getRecentMovies(page = 1) {
    try {
        const url = page === 1 
            ? 'https://cinesubz.net/movies/'
            : `https://cinesubz.net/movies/page/${page}/`;
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const movies = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            let title = $item.find('.item-desc-title h3, .item-title').text().trim();
            let url = $item.find('a').first().attr('href');
            let poster = $item.find('.thumb').attr('src');
            let quality = $item.find('.badge-quality-corner').text().trim();
            
            if (title && url && url.includes('/movies/')) {
                movies.push({
                    title: title,
                    slug: extractMovieId(url),
                    url: url,
                    poster: poster || null,
                    quality: quality || null
                });
            }
        });
        
        return {
            status: true,
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                page: page,
                total_movies: movies.length,
                movies: movies
            }
        };
        
    } catch (error) {
        return {
            status: false,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ ROUTES ============

// API Info
router.get('/api-info', (req, res) => {
    res.json({
        status: true,
        message: "CineSubz Movie Info API",
        timestamp: new Date().toISOString(),
        endpoints: {
            "GET /api-info": "Show this information",
            "GET /movie/info?url=URL": "Get complete movie details",
            "GET /movie/search?q=QUERY": "Search movies",
            "GET /movie/recent": "Get recent movies",
            "GET /movie/slug/:slug": "Get movie by slug"
        },
        examples: {
            info: "/movie/info?url=https://cinesubz.net/movies/the-super-mario-galaxy-movie-2026-sinhala-subtitles/",
            search: "/movie/search?q=mario",
            recent: "/movie/recent",
            slug: "/movie/slug/the-super-mario-galaxy-movie-2026-sinhala-subtitles"
        }
    });
});

// MAIN ENDPOINT - Movie Info
router.get('/movie/info', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            message: "Please provide a movie URL",
            example: "/movie/info?url=https://cinesubz.net/movies/movie-name-sinhala-subtitles/"
        });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    
    // Allow both cinesubz.net and cinesubz.lk
    if (!decodedUrl.includes('cinesubz.net') && !decodedUrl.includes('cinesubz.lk')) {
        return res.status(400).json({
            status: false,
            error: "Invalid URL",
            message: "Only cinesubz.net or cinesubz.lk URLs are allowed"
        });
    }
    
    const result = await getMovieInfo(decodedUrl);
    res.json(result);
});

// Search endpoint
router.get('/movie/search', async (req, res) => {
    const { q, page } = req.query;
    
    if (!q) {
        return res.status(400).json({
            status: false,
            error: "Search query 'q' is required",
            example: "/movie/search?q=mario"
        });
    }
    
    const result = await searchMovies(q, parseInt(page) || 1);
    res.json(result);
});

// Recent movies
router.get('/movie/recent', async (req, res) => {
    const { page } = req.query;
    const result = await getRecentMovies(parseInt(page) || 1);
    res.json(result);
});

// Get movie by slug
router.get('/movie/slug/:slug', async (req, res) => {
    const { slug } = req.params;
    const url = `https://cinesubz.net/movies/${slug}/`;
    
    const result = await getMovieInfo(url);
    res.json(result);
});

// Fallback route
router.use('*', (req, res) => {
    res.status(404).json({
        status: false,
        error: "Route not found",
        timestamp: new Date().toISOString(),
        message: "Check /api-info for available endpoints",
        available_endpoints: [
            "/api-info",
            "/movie/info?url=URL",
            "/movie/search?q=QUERY",
            "/movie/recent",
            "/movie/slug/:slug"
        ]
    });
});

module.exports = router;
