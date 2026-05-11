const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const NodeCache = require('node-cache');
const router = express.Router();

// Cache for downloaded URLs (TTL: 1 hour)
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

// ============ BROWSER MANAGEMENT ============
let browserInstance = null;

async function getBrowser() {
    if (browserInstance && browserInstance.isConnected()) {
        return browserInstance;
    }
    
    console.log('🚀 Launching browser...');
    
    browserInstance = await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1280,800',
            '--disable-blink-features=AutomationControlled'
        ],
        headless: 'new',
        ignoreHTTPSErrors: true,
        timeout: 60000
    });
    
    return browserInstance;
}

async function closeBrowser() {
    if (browserInstance && browserInstance.isConnected()) {
        console.log('🔒 Closing browser...');
        await browserInstance.close();
        browserInstance = null;
    }
}

// ============ EXTRACT FINAL DOWNLOAD URL FROM ZT-LINKS ============
async function extractDownloadUrl(ztUrl) {
    // Check cache first
    const cachedUrl = cache.get(ztUrl);
    if (cachedUrl) {
        console.log(`📦 Cache hit for: ${ztUrl}`);
        return { success: true, url: cachedUrl };
    }
    
    let page = null;
    
    try {
        console.log(`🔗 Extracting final download URL from: ${ztUrl}`);
        
        const browser = await getBrowser();
        page = await browser.newPage();
        
        // Set realistic headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://cinesubz.lk/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        // Navigate to ZT-links page
        await page.goto(ztUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        let currentUrl = page.url();
        console.log(`📍 Initial URL: ${currentUrl}`);
        
        // Wait for countdown button to become enabled (if exists)
        try {
            // Check if #link button exists
            const buttonExists = await page.$('#link');
            if (buttonExists) {
                console.log('⏳ Waiting for countdown to finish...');
                
                // Wait for button to become enabled (disabled attribute removed)
                await page.waitForFunction(
                    () => {
                        const btn = document.querySelector('#link');
                        return btn && !btn.hasAttribute('disabled');
                    },
                    { timeout: 60000 }
                ).catch(() => {
                    console.log('⚠️ Countdown timeout, proceeding anyway');
                });
                
                console.log('✅ Countdown finished, button is now clickable');
                
                // Click the button
                await page.click('#link');
                console.log('✅ Clicked #link button');
                
                // Wait for navigation or new page
                await delay(4000);
                currentUrl = page.url();
                console.log(`📍 After click: ${currentUrl}`);
            }
        } catch (e) {
            console.log('⚠️ #link button not found, trying alternative methods...');
        }
        
        // Handle crn77.com redirect (if appears)
        if (currentUrl.includes('crn77.com')) {
            console.log('🖱️ Processing crn77.com redirect...');
            try {
                await page.waitForSelector('a', { timeout: 10000 });
                
                await page.evaluate(() => {
                    const links = document.querySelectorAll('a');
                    for (const link of links) {
                        const text = (link.textContent || '').toLowerCase();
                        if (text.includes('click') || text.includes('here') || link.href) {
                            link.click();
                            return;
                        }
                    }
                    if (links.length > 0) links[0].click();
                });
                
                await delay(5000);
                currentUrl = page.url();
                console.log(`📍 After crn77.com click: ${currentUrl}`);
            } catch (e) {
                console.log('⚠️ Error handling crn77.com:', e.message);
            }
        }
        
        // Check for new page/tab opened
        const pages = await browser.pages();
        for (const p of pages) {
            const pUrl = p.url();
            if (pUrl !== ztUrl && pUrl !== 'about:blank' && !pUrl.includes('/zt-links/')) {
                currentUrl = pUrl;
                console.log(`📍 New tab detected: ${currentUrl}`);
                break;
            }
        }
        
        // Try to extract final download URL from page content if not redirected
        if (!currentUrl.includes('sonic-cloud') && !currentUrl.includes('.mp4') && !currentUrl.includes('.mkv')) {
            const html = await page.content();
            
            // Look for sonic-cloud URLs
            const sonicMatch = html.match(/https?:\/\/[^\s"'<>]*sonic-cloud[^\s"'<>]+/i);
            if (sonicMatch) {
                currentUrl = sonicMatch[0];
                console.log(`📍 Found sonic-cloud URL in page: ${currentUrl}`);
            }
            
            // Look for MP4/MKV URLs
            const fileMatch = html.match(/https?:\/\/[^\s"'<>]*\.(?:mp4|mkv)[^\s"'<>]*/i);
            if (fileMatch && !currentUrl) {
                currentUrl = fileMatch[0];
                console.log(`📍 Found direct file URL: ${currentUrl}`);
            }
        }
        
        await page.close();
        
        // Validate final URL
        if (currentUrl && (currentUrl.includes('sonic-cloud') || 
                           currentUrl.includes('.mp4') || 
                           currentUrl.includes('.mkv'))) {
            cache.set(ztUrl, currentUrl);
            return { success: true, url: currentUrl };
        } else {
            return { success: false, error: 'Could not extract final download URL' };
        }
        
    } catch (error) {
        console.error(`❌ Extraction error for ${ztUrl}:`, error.message);
        if (page) await page.close().catch(() => {});
        
        return { success: false, error: error.message };
    }
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

// ============ MOVIE INFO FUNCTION (WITH DOWNLOAD LINK EXTRACTION) ============
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
        
        // ============ DOWNLOAD LINKS WITH FINAL URL EXTRACTION ============
        const downloadLinks = [];
        
        // Method 1: Extract from .movie-download-button
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
                    original_zt_link: ztLink,
                    final_link: null
                });
            }
        });
        
        // Method 2: Extract from .link-directandtgdownload
        $('.link-directandtgdownload .movie-download-link-item a').each((i, el) => {
            const ztLink = $(el).attr('href');
            const parentText = $(el).parent().text();
            const meta = $(el).find('.movie-download-meta').text().trim();
            
            let qualityText = '';
            let sizeText = '';
            
            const qualityMatch = parentText.match(/(\d+p)/i);
            if (qualityMatch) qualityText = qualityMatch[1];
            
            const sizeMatch = parentText.match(/(\d+(?:\.\d+)?)\s*(MB|GB)/i);
            if (sizeMatch) sizeText = sizeMatch[1] + ' ' + sizeMatch[2];
            
            if (ztLink && ztLink.includes('/zt-links/')) {
                const exists = downloadLinks.some(l => l.original_zt_link === ztLink);
                if (!exists) {
                    downloadLinks.push({
                        quality: qualityText || 'Unknown',
                        size: sizeText || meta || 'Unknown',
                        original_zt_link: ztLink,
                        final_link: null
                    });
                }
            }
        });
        
        // Method 3: Extract from .links-table
        $('.links-table tbody tr').each((i, el) => {
            const $row = $(el);
            const qualityText = $row.find('td:first-child').text().trim();
            const sizeText = $row.find('td:nth-child(2)').text().trim();
            const ztLink = $row.find('td:last-child a').attr('href');
            
            if (ztLink && ztLink.includes('/zt-links/') && qualityText) {
                const exists = downloadLinks.some(l => l.original_zt_link === ztLink);
                if (!exists) {
                    downloadLinks.push({
                        quality: qualityText,
                        size: sizeText || 'Unknown',
                        original_zt_link: ztLink,
                        final_link: null
                    });
                }
            }
        });
        
        // ============ EXTRACT FINAL DOWNLOAD URLS ============
        console.log(`🔗 Extracting final download URLs for ${downloadLinks.length} links...`);
        
        for (let i = 0; i < downloadLinks.length; i++) {
            const link = downloadLinks[i];
            console.log(`  ⏳ (${i + 1}/${downloadLinks.length}) Processing: ${link.quality}`);
            
            const result = await extractDownloadUrl(link.original_zt_link);
            if (result.success) {
                link.final_link = result.url;
                console.log(`  ✅ Final URL obtained for ${link.quality}`);
            } else {
                console.log(`  ❌ Failed to get final URL for ${link.quality}: ${result.error}`);
                link.final_link = null;
            }
            
            if (i < downloadLinks.length - 1) {
                await delay(2000);
            }
        }
        
        // Filter out links where final_link is null
        const validDownloadLinks = downloadLinks.filter(link => link.final_link !== null);
        
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
                download_links: validDownloadLinks
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

// ============ RECENT MOVIES FUNCTION ============
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
        message: "🎬 CineSubz Movie API - Search, Info & Download Link Extraction",
        author: "Mr Thinuzz",
        version: "3.0.0",
        endpoints: {
            "GET /search?q=QUERY&page=1": "Search movies on CineSubz",
            "GET /info?url=URL": "Get movie details with final download links",
            "GET /recent?page=1": "Get recently added movies",
            "GET /extract?url=URL": "Extract final download URL from ZT-links page"
        },
        examples: {
            search: "/search?q=breaking+bad",
            info: "/info?url=https://cinesubz.net/movies/kiss-of-the-spider-woman-2025-sinhala-subtitles/",
            recent: "/recent",
            extract: "/extract?url=https://cinesubz.net/zt-links/niavvuv2re/"
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

// ============ INFO ENDPOINT (WITH FINAL DOWNLOAD LINKS) ============
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

// ============ EXTRACT ENDPOINT (SINGLE ZT-LINK) ============
router.get('/extract', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: "URL parameter required",
            usage: "/extract?url=ZT_LINK_URL",
            example: "/extract?url=https://cinesubz.net/zt-links/niavvuv2re/"
        });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    
    if (!decodedUrl.includes('/zt-links/')) {
        return res.status(400).json({
            success: false,
            error: "URL must be a ZT-links page"
        });
    }
    
    const result = await extractDownloadUrl(decodedUrl);
    
    if (result.success) {
        res.json({
            success: true,
            original_url: decodedUrl,
            download_url: result.url,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(404).json({
            success: false,
            error: result.error,
            original_url: decodedUrl
        });
    }
});

// ============ RECENT ENDPOINT ============
router.get('/recent', async (req, res) => {
    const pageNum = parseInt(req.query.page) || 1;
    const result = await getRecentMovies(pageNum);
    res.json(result);
});

// ============ CLEANUP ON EXIT ============
process.on('exit', async () => await closeBrowser());
process.on('SIGINT', async () => { 
    console.log('🛑 Shutting down...');
    await closeBrowser(); 
    process.exit(0);
});
process.on('SIGTERM', async () => { 
    console.log('🛑 Shutting down...');
    await closeBrowser(); 
    process.exit(0);
});

module.exports = router;
