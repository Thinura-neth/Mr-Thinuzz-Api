const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// ============ HELPER FUNCTIONS ============

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

// ============ AXIOS INSTANCE WITH PROPER HEADERS ============
const cinesubzAxios = axios.create({
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    }
});

let cookieJar = '';

async function refreshCookies() {
    try {
        const response = await cinesubzAxios.get('https://cinesubz.net');
        if (response.headers['set-cookie']) {
            cookieJar = response.headers['set-cookie'].join('; ');
            cinesubzAxios.defaults.headers['Cookie'] = cookieJar;
        }
    } catch (error) {
        // Silent fail - continue without cookies
    }
}

// ============ MAIN EXTRACTION FUNCTION (NO PUPPETEER) ============
async function extractDownloadUrl(ztUrl) {
    console.log(`🔗 Extracting from: ${ztUrl}`);
    
    await refreshCookies();
    
    try {
        let response = await cinesubzAxios.get(ztUrl, {
            maxRedirects: 5,
            validateStatus: status => status < 400
        });
        
        let currentUrl = response.request.res.responseUrl || ztUrl;
        let html = response.data;
        
        // Check if already redirected to download URL
        if (!currentUrl.includes('/zt-links/') && currentUrl !== ztUrl && !currentUrl.includes('cinesubz.net')) {
            return { success: true, url: currentUrl };
        }
        
        // METHOD 1: Meta refresh extraction
        const metaPattern = /<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'](\d+);\s*url=([^"']+)/i;
        let metaMatch = html.match(metaPattern);
        
        if (metaMatch) {
            let redirectUrl = decodeURIComponent(metaMatch[2]);
            if (redirectUrl.startsWith('/')) {
                redirectUrl = 'https://cinesubz.net' + redirectUrl;
            }
            
            const redirectResponse = await cinesubzAxios.get(redirectUrl, { 
                maxRedirects: 10,
                validateStatus: status => status < 400
            });
            const finalUrl = redirectResponse.request.res.responseUrl || redirectUrl;
            
            if (!finalUrl.includes('/zt-links/') && !finalUrl.includes('cinesubz.net')) {
                return { success: true, url: finalUrl };
            }
            html = redirectResponse.data;
        }
        
        // METHOD 2: Extract from JavaScript variables
        const jsPatterns = [
            /window\.location\.href\s*=\s*["']([^"']+)["']/i,
            /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
            /var\s+downloadUrl\s*=\s*["']([^"']+)["']/i,
            /var\s+link\s*=\s*["']([^"']+)["']/i,
            /let\s+download_link\s*=\s*["']([^"']+)["']/i,
            /const\s+url\s*=\s*["']([^"']+)["']/i,
            /data-url=["']([^"']+)["']/i,
            /data-href=["']([^"']+)["']/i,
            /href=["'](https?:\/\/(?:www\.)?(?:drive\.google|google\.com|sonic-cloud|pixeldrain|t\.me|mega\.nz|mediafire)[^"']+)["']/i,
            /src=["'](https?:\/\/(?:www\.)?(?:drive\.google|google\.com|sonic-cloud|pixeldrain)[^"']+)["']/i
        ];
        
        for (const pattern of jsPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let url = match[1];
                if (url.startsWith('/')) url = 'https://cinesubz.net' + url;
                if (url.includes('http') && !url.includes('cinesubz.net') && !url.includes('/zt-links/')) {
                    return { success: true, url: url };
                }
            }
        }
        
        // METHOD 3: Cheerio - extract links from DOM
        const $ = cheerio.load(html);
        const externalLinks = [];
        
        // Check all anchor tags
        $('a[href]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.startsWith('http') && 
                !href.includes('cinesubz.net') && 
                !href.includes('cinesubz.lk') &&
                !href.includes('/zt-links/') &&
                !href.includes('facebook.com') &&
                !href.includes('twitter.com') &&
                !href.includes('instagram.com')) {
                externalLinks.push(href);
            }
        });
        
        // Check iframes
        $('iframe[src]').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.startsWith('http') && !src.includes('cinesubz.net')) {
                externalLinks.push(src);
            }
        });
        
        // Check embed tags
        $('embed[src]').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.startsWith('http') && !src.includes('cinesubz.net')) {
                externalLinks.push(src);
            }
        });
        
        // Check meta tags
        $('meta[content]').each((i, el) => {
            const content = $(el).attr('content');
            if (content && content.startsWith('http') && 
                !content.includes('cinesubz.net') && 
                (content.includes('google') || content.includes('download') || content.includes('server'))) {
                externalLinks.push(content);
            }
        });
        
        if (externalLinks.length > 0) {
            return { success: true, url: externalLinks[0] };
        }
        
        // METHOD 4: Look for specific download button patterns
        const buttonSelectors = ['#link', '.wait-done a', '.download-button', '.btn-download', '.direct-download-button', '.movie-download-link-item a'];
        
        for (const selector of buttonSelectors) {
            const element = $(selector).first();
            if (element.length) {
                const href = element.attr('href');
                const dataHref = element.attr('data-href');
                const onclick = element.attr('onclick');
                
                if (href && href.startsWith('http') && !href.includes('cinesubz.net')) {
                    return { success: true, url: href };
                }
                if (dataHref && dataHref.startsWith('http')) {
                    return { success: true, url: dataHref };
                }
                if (onclick) {
                    const urlMatch = onclick.match(/["']([^"']+\.(?:mp4|mkv|zip|rar)[^"']*)["']/i);
                    if (urlMatch && urlMatch[1].startsWith('http')) {
                        return { success: true, url: urlMatch[1] };
                    }
                }
            }
        }
        
        // METHOD 5: Search entire HTML for patterns
        const htmlPatterns = [
            /https?:\/\/(?:www\.)?google\.com\/server\d+\/[^\s"'<>]+/gi,
            /https?:\/\/[^\s"'<>]*sonic-cloud[^\s"'<>]+\.(?:mp4|mkv)/gi,
            /https?:\/\/[^\s"'<>]*pixeldrain[^\s"'<>]+/gi,
            /https?:\/\/t\.me\/[^\s"'<>]+/gi,
            /https?:\/\/[^\s"'<>]*drive\.google[^\s"'<>]+/gi,
            /https?:\/\/[^\s"'<>]*mega\.nz[^\s"'<>]+/gi,
            /https?:\/\/[^\s"'<>]*mediafire[^\s"'<>]+/gi
        ];
        
        for (const pattern of htmlPatterns) {
            const matches = html.match(pattern);
            if (matches && matches.length > 0) {
                let url = matches[0];
                if (url.includes('&quot;')) url = url.replace(/&quot;/g, '"');
                if (url.includes('&#039;')) url = url.replace(/&#039;/g, "'");
                if (!url.includes('cinesubz.net')) {
                    return { success: true, url: url };
                }
            }
        }
        
        return { success: false, error: 'No download URL could be extracted' };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============ SEARCH MOVIES FUNCTION ============
async function searchMovies(query, page = 1) {
    try {
        await refreshCookies();
        
        const searchUrl = `https://cinesubz.net/page/${page}/?s=${encodeURIComponent(query)}`;
        
        const response = await cinesubzAxios.get(searchUrl);
        const $ = cheerio.load(response.data);
        const results = [];
        
        $('.display-item, .module-item, .item-box, .post-item, .movie-item').each((i, element) => {
            const $item = $(element);
            
            let title = $item.find('.item-desc-title h3, .item-title, .entry-title, h3').first().text().trim();
            let url = $item.find('a').first().attr('href');
            let poster = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-original');
            
            if (!title) title = $item.find('a[title]').attr('title');
            
            if (title && url && (url.includes('/movies/') || url.includes('/movie/'))) {
                results.push({
                    title: cleanText(title),
                    slug: extractMovieId(url),
                    url: url,
                    poster: poster || null
                });
            }
        });
        
        let totalPages = 1;
        $('.pagination a, .page-numbers').each((i, el) => {
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
            success: true,
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
            success: false,
            error: `Search failed: ${error.message}`
        };
    }
}

// ============ RECENT MOVIES FUNCTION ============
async function getRecentMovies(page = 1) {
    try {
        await refreshCookies();
        
        const url = page === 1 
            ? 'https://cinesubz.net/movies/'
            : `https://cinesubz.net/movies/page/${page}/`;
        
        const response = await cinesubzAxios.get(url);
        const $ = cheerio.load(response.data);
        const movies = [];
        
        $('.display-item, .module-item, .item-box, .post-item').each((i, element) => {
            const $item = $(element);
            
            let title = $item.find('.item-desc-title h3, .item-title, .entry-title').first().text().trim();
            let url = $item.find('a').first().attr('href');
            let poster = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-original');
            
            if (title && url && (url.includes('/movies/') || url.includes('/movie/'))) {
                movies.push({
                    title: cleanText(title),
                    slug: extractMovieId(url),
                    url: url,
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
        
        const uniqueMovies = [];
        const seenUrls = new Set();
        for (const movie of movies) {
            if (!seenUrls.has(movie.url)) {
                seenUrls.add(movie.url);
                uniqueMovies.push(movie);
            }
        }
        
        return {
            success: true,
            data: {
                page: page,
                total_pages: totalPages,
                has_next_page: page < totalPages,
                total_movies: uniqueMovies.length,
                movies: uniqueMovies
            }
        };
        
    } catch (error) {
        return {
            success: false,
            error: `Failed to fetch: ${error.message}`
        };
    }
}

// ============ MOVIE DETAILS FUNCTION ============
async function getMovieDetails(url) {
    try {
        await refreshCookies();
        
        const response = await cinesubzAxios.get(url);
        const $ = cheerio.load(response.data);
        
        // Title
        let title = $('.details-title h3').first().text().trim();
        if (!title) title = $('title').text().replace(' – CineSubz', '').trim();
        
        // Poster
        let poster = $('.content-poster .poster-img').attr('src');
        if (!poster) poster = $('.poster-img').attr('src');
        if (poster && !poster.startsWith('http')) poster = 'https://cinesubz.net' + poster;
        
        // Description
        let description = '';
        $('.details-desc p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 5000) {
                description = text;
                return false;
            }
        });
        
        // IMDb Rating
        let imdbRating = null;
        const imdbElement = $('.data-imdb').text();
        const ratingMatch = imdbElement.match(/IMDb:\s*([\d.]+)/i);
        if (ratingMatch) imdbRating = ratingMatch[1];
        
        // Quality
        let quality = $('.data-quality').first().text().trim();
        if (!quality) quality = $('.badge-quality-corner').first().text().trim();
        
        // Year
        let year = null;
        $('.info-col p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Year:')) {
                const yearMatch = text.match(/Year:\s*(\d{4})/i);
                if (yearMatch) year = yearMatch[1];
            }
        });
        
        // Genres
        const genres = [];
        $('.details-genre a').each((i, el) => {
            const genre = $(el).text().trim();
            if (genre && !genres.includes(genre)) genres.push(genre);
        });
        
        // Cast
        const cast = [];
        $('.zt-cast-card').each((i, el) => {
            const name = $(el).find('.zt-cast-name').text().trim();
            if (name) cast.push({ name: name });
        });
        
        // Download Links (ZT-links)
        const downloadLinks = [];
        
        $('.movie-download-button, .link-directandtgdownload .movie-download-link-item a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/zt-links/')) {
                downloadLinks.push({
                    url: href,
                    type: 'Direct & Telegram Download',
                    host: 'cinesubz.net'
                });
            }
        });
        
        // Similar Movies
        const similarMovies = [];
        $('.similar-item, .related-item').each((i, el) => {
            const similarTitle = $(el).find('.item-data h3, .data-title').text().trim();
            const movieUrl = $(el).find('a').first().attr('href');
            if (similarTitle && movieUrl && movieUrl.includes('/movies/')) {
                similarMovies.push({
                    title: similarTitle,
                    slug: extractMovieId(movieUrl),
                    url: movieUrl
                });
            }
        });
        
        const cleanTitle = title.replace(' Sinhala Subtitles | සිංහල උපසිරැසි සමඟ', '').trim();
        
        return {
            success: true,
            data: {
                title: cleanTitle,
                slug: extractMovieId(url),
                url: url,
                poster: poster,
                description: description,
                imdb_rating: imdbRating,
                quality: quality,
                year: year,
                genres: genres,
                cast: cast.slice(0, 10),
                download_links: downloadLinks,
                similar_movies: similarMovies.slice(0, 10)
            }
        };
        
    } catch (error) {
        return {
            success: false,
            error: `Failed to fetch: ${error.message}`
        };
    }
}

// ============ POPULAR MOVIES FUNCTION ============
async function getPopularMovies() {
    return await getRecentMovies(1);
}

// ============ EXPRESS ROUTES ============

router.get('/', (req, res) => {
    res.json({
        success: true,
        message: "🎬 CineSubz Movie Search API - Full Working Version (No Puppeteer Required)",
        author: "Mr Thinuzz",
        version: "2.0.0",
        timestamp: new Date().toISOString(),
        endpoints: {
            "GET /extract?url=URL": "Extract direct download URL from ZT-links page",
            "GET /search?q=QUERY&page=1": "Search movies on CineSubz",
            "GET /recent?page=1": "Get recently added movies",
            "GET /info?url=URL": "Get movie details with download links",
            "GET /popular": "Get popular movies"
        },
        examples: {
            extract: "/extract?url=https://cinesubz.net/zt-links/example/",
            search: "/search?q=oppenheimer",
            recent: "/recent?page=1",
            info: "/info?url=https://cinesubz.net/movies/oppenheimer-2023/",
            popular: "/popular"
        }
    });
});

router.get('/extract', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: "URL parameter is required",
            usage: "/extract?url=https://cinesubz.net/zt-links/xxxxx/"
        });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    
    if (!decodedUrl.startsWith('http')) {
        return res.status(400).json({
            success: false,
            error: "Invalid URL format. Must start with http:// or https://"
        });
    }
    
    if (!decodedUrl.includes('cinesubz.net') || !decodedUrl.includes('/zt-links/')) {
        return res.status(400).json({
            success: false,
            error: "URL must be a CineSubz ZT-links page",
            required_format: "https://cinesubz.net/zt-links/[id]/"
        });
    }
    
    console.log(`📥 Extraction request: ${decodedUrl}`);
    const result = await extractDownloadUrl(decodedUrl);
    
    if (result.success) {
        const filename = extractFilenameFromUrl(result.url);
        const isTelegram = result.url.includes('t.me');
        
        res.json({
            success: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                original_url: decodedUrl,
                download_url: result.url,
                filename: filename,
                is_telegram: isTelegram,
                host: extractHostFromUrl(result.url)
            }
        });
    } else {
        res.status(404).json({
            success: false,
            error: result.error,
            original_url: decodedUrl,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    
    if (!q) {
        return res.status(400).json({
            success: false,
            error: "Search query parameter 'q' is required"
        });
    }
    
    const searchTerm = decodeURIComponent(q);
    const pageNum = parseInt(page) || 1;
    const result = await searchMovies(searchTerm, pageNum);
    
    if (result.success) {
        res.json({
            success: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: result.data
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/recent', async (req, res) => {
    const { page } = req.query;
    const pageNum = parseInt(page) || 1;
    const result = await getRecentMovies(pageNum);
    
    if (result.success) {
        res.json({
            success: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: result.data
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/info', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: "URL parameter is required"
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
            success: false,
            error: "Only cinesubz.net or cinesubz.lk URLs are allowed"
        });
    }
    
    const result = await getMovieDetails(decodedUrl);
    
    if (result.success) {
        res.json({
            success: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: result.data
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/popular', async (req, res) => {
    const result = await getPopularMovies();
    
    if (result.success) {
        res.json({
            success: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                type: "popular",
                message: "Popular movies from CineSubz",
                ...result.data
            }
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
