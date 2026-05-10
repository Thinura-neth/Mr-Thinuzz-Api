const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// Helper functions
function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

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
        return "unknown_file.mkv";
    } catch (e) {
        return "unknown_file.mkv";
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

// Search movies on CineSubz
async function searchMovies(query, page = 1) {
    try {
        console.log(`🔍 Searching CineSubz for: ${query} (Page: ${page})`);
        
        const searchUrl = `https://cinesubz.net/page/${page}/?s=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
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
                    title: cleanText(title),
                    slug: extractMovieId(url),
                    url: url,
                    poster: poster || null,
                    imdb_rating: imdbRating || null,
                    quality: quality || null,
                    language: 'Sinhala Subtitles'
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
        
        const hasNextPage = page < totalPages;
        
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
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                query: query,
                page: page,
                total_pages: totalPages,
                has_next_page: hasNextPage,
                total_results: uniqueResults.length,
                results: uniqueResults.slice(0, 50)
            }
        };
        
    } catch (error) {
        console.error(`❌ Search error:`, error.message);
        return {
            status: false,
            error: `Search failed: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// Get recent movies
async function getRecentMovies(page = 1) {
    try {
        console.log(`📺 Fetching recent movies from CineSubz (Page: ${page})`);
        
        const url = page === 1 
            ? 'https://cinesubz.net/movies/'
            : `https://cinesubz.net/movies/page/${page}/`;
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        
        const $ = cheerio.load(response.data);
        const movies = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            
            let title = $item.find('.item-desc-title h3, .item-title').text().trim();
            let url = $item.find('a').first().attr('href');
            let poster = $item.find('.thumb').attr('data-original') || $item.find('.thumb').attr('src');
            let imdbRating = $item.find('.imdb-rating-badge .imdb-score').text().trim();
            let quality = $item.find('.badge-quality-corner').text().trim();
            
            if (!title) title = $item.find('a[title]').attr('title');
            
            if (title && url && url.includes('/movies/')) {
                movies.push({
                    title: cleanText(title),
                    slug: extractMovieId(url),
                    url: url,
                    poster: poster || null,
                    imdb_rating: imdbRating || null,
                    quality: quality || null,
                    language: 'Sinhala Subtitles'
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
            status: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                page: page,
                total_pages: totalPages,
                has_next_page: page < totalPages,
                total_movies: movies.length,
                movies: movies
            }
        };
        
    } catch (error) {
        console.error(`❌ Error fetching recent movies:`, error.message);
        return {
            status: false,
            error: `Failed to fetch: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// Get movie details
async function getMovieDetails(url) {
    try {
        console.log(`🎬 Fetching movie details: ${url}`);
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract Title
        let title = $('.details-title h3, .content-title h1, h1').first().text().trim();
        if (!title) title = $('title').text().replace(' – CineSubz.lk', '').replace(' - CineSubz.lk', '').trim();
        
        // Extract Poster
        let poster = $('.content-poster img, .poster-img').attr('src');
        if (!poster) poster = $('.details-poster img').attr('src');
        
        // Extract IMDb Rating
        let imdbRating = null;
        const imdbElement = $('.data-imdb, .imdb-rating-badge .imdb-score');
        if (imdbElement.length) imdbRating = imdbElement.text().trim();
        
        // Extract Quality
        let quality = null;
        const qualityElement = $('.data-quality, .badge-quality-corner');
        if (qualityElement.length) quality = qualityElement.text().trim();
        
        // Extract Year
        let year = null;
        $('.details-info p, .info-details').each((i, el) => {
            const text = $(el).text();
            const yearMatch = text.match(/Year:\s*(\d{4})/i);
            if (yearMatch) year = yearMatch[1];
        });
        
        // Extract Genres
        let genres = [];
        $('.details-genre a, .genres-list a, .data-genre a').each((i, el) => {
            const genre = $(el).text().trim();
            if (genre && genre.length < 50) genres.push(genre);
        });
        
        // Extract Description
        let description = '';
        $('.details-desc p, .content-description p, .entry-content p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 5000 && !text.includes('Download')) {
                description = text;
                return false;
            }
        });
        
        // Extract Download Links
        const downloadLinks = [];
        
        $('.movie-download-button, .links-table tbody tr a, .download-button, .btn-download').each((i, el) => {
            const href = $(el).attr('href');
            if (href && (href.includes('http') || href.includes('magnet'))) {
                const text = $(el).text().trim();
                downloadLinks.push({
                    url: href,
                    type: text || 'Download Link',
                    host: extractHostFromUrl(href),
                    filename: extractFilenameFromUrl(href)
                });
            }
        });
        
        // Extract fuckingfast.co links
        const fuckingFastLinks = downloadLinks.filter(link => link.url.includes('fuckingfast.co'));
        
        // Remove duplicates
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
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                title: title || "Title not found",
                slug: extractMovieId(url),
                url: url,
                poster: poster || null,
                imdb_rating: imdbRating,
                quality: quality,
                year: year,
                genres: genres,
                description: description,
                download_links: uniqueDownloads,
                fuckingfast_links: fuckingFastLinks
            }
        };
        
    } catch (error) {
        console.error(`❌ Movie details error:`, error.message);
        return {
            status: false,
            error: `Failed to fetch: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// Extract fuckingfast.co direct link
async function extractFuckingFastDownload(url) {
    try {
        console.log(`🔄 Extracting download from: ${url}`);
        
        const response = await axios.get(url.split('#')[0], {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://fuckingfast.co/'
            }
        });
        
        const html = response.data;
        const $ = cheerio.load(html);
        let downloadUrl = null;
        
        // Meta refresh
        const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
        if (metaRefresh && metaRefresh.includes('url=')) {
            const match = metaRefresh.match(/url=(.+)$/i);
            if (match) downloadUrl = decodeURIComponent(match[1]);
        }
        
        // Download button
        if (!downloadUrl) {
            const downloadBtn = $('a[class*="download"], .download-btn, .btn-download');
            if (downloadBtn.length) downloadUrl = downloadBtn.first().attr('href');
        }
        
        // Pattern matching
        if (!downloadUrl) {
            const patterns = [/https?:\/\/dl\.fuckingfast\.co\/[^\s"'<>]+/g, /https?:\/\/cdn\.fuckingfast\.co\/[^\s"'<>]+/g];
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[0]) {
                    downloadUrl = match[0];
                    break;
                }
            }
        }
        
        if (downloadUrl) {
            if (!downloadUrl.startsWith('http')) downloadUrl = 'https://' + downloadUrl;
            return {
                status: true,
                author: "Mr Thinuzz",
                timestamp: new Date().toISOString(),
                data: {
                    original_url: url,
                    download_url: downloadUrl,
                    filename: extractFilenameFromUrl(url)
                }
            };
        }
        
        return {
            status: false,
            error: "Could not extract direct download link",
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        return {
            status: false,
            error: `Failed to extract: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ ROUTES ============

router.get('/', (req, res) => {
    res.json({
        status: true,
        message: "🎬 CineSubz Movie Search API - Real-time Scraper",
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString(),
        endpoints: {
            "GET /movie/search?q=SEARCH": "Search movies on CineSubz",
            "GET /movie/recent": "Get recently added movies",
            "GET /movie/info?url=URL": "Get movie details with download links",
            "GET /movie/download?url=URL": "Extract direct download link",
            "GET /movie/popular": "Get popular movies"
        },
        examples: {
            search: "/movie/search?q=oppenheimer",
            recent: "/movie/recent",
            info: "/movie/info?url=https://cinesubz.net/movies/oppenheimer-2023-sinhala-subtitles/",
            download: "/movie/download?url=https://fuckingfast.co/..."
        }
    });
});

router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    if (!q) {
        return res.status(400).json({
            status: false,
            error: "Search query parameter 'q' is required",
            timestamp: new Date().toISOString()
        });
    }
    const searchTerm = decodeURIComponent(q);
    const pageNum = parseInt(page) || 1;
    const result = await searchMovies(searchTerm, pageNum);
    res.json(result);
});

router.get('/recent', async (req, res) => {
    const { page } = req.query;
    const pageNum = parseInt(page) || 1;
    const result = await getRecentMovies(pageNum);
    res.json(result);
});

router.get('/info', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            timestamp: new Date().toISOString()
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
            error: "Only cinesubz.net or cinesubz.lk URLs are allowed",
            timestamp: new Date().toISOString()
        });
    }
    const result = await getMovieDetails(decodedUrl);
    res.json(result);
});

router.get('/download', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            timestamp: new Date().toISOString()
        });
    }
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    if (!decodedUrl.includes('fuckingfast.co')) {
        return res.status(400).json({
            status: false,
            error: "Only fuckingfast.co URLs are supported",
            timestamp: new Date().toISOString()
        });
    }
    const result = await extractFuckingFastDownload(decodedUrl);
    res.json(result);
});

router.get('/popular', async (req, res) => {
    const result = await getRecentMovies(1);
    if (result.status) {
        result.data.type = "popular";
        result.data.message = "Popular movies from CineSubz";
    }
    res.json(result);
});

module.exports = router;
