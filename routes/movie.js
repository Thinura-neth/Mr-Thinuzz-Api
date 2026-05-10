const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const router = express.Router();

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

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

// ============ BROWSER MANAGEMENT ============
let browserInstance = null;
let browserLaunchTime = null;
const BROWSER_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

async function getBrowser() {
    const now = Date.now();
    
    // Close idle browser
    if (browserInstance && browserLaunchTime && (now - browserLaunchTime) > BROWSER_IDLE_TIMEOUT) {
        console.log('🔄 Closing idle browser...');
        await browserInstance.close();
        browserInstance = null;
        browserLaunchTime = null;
    }
    
    if (!browserInstance) {
        console.log('🚀 Launching browser...');
        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1280,800'
            ]
        });
        browserLaunchTime = now;
    }
    return browserInstance;
}

// ============ FOLLOW REDIRECTS AND EXTRACT FINAL URL ============
async function followRedirectsAndExtract(url, page) {
    console.log(`🔄 Following redirects from: ${url}`);
    
    let currentUrl = url;
    let visitedUrls = new Set();
    let maxRedirects = 10;
    let redirectCount = 0;
    
    while (redirectCount < maxRedirects && !visitedUrls.has(currentUrl)) {
        visitedUrls.add(currentUrl);
        
        // Check if this looks like a final download URL
        if (isFinalDownloadUrl(currentUrl)) {
            console.log(`✅ Found final download URL: ${currentUrl}`);
            return currentUrl;
        }
        
        console.log(`📍 Current URL: ${currentUrl}`);
        
        // Navigate to current URL
        await page.goto(currentUrl, { 
            waitUntil: 'networkidle2',
            timeout: 20000 
        });
        
        // Get the actual URL after potential redirects
        currentUrl = page.url();
        
        // Check again if this is a final download URL
        if (isFinalDownloadUrl(currentUrl)) {
            console.log(`✅ Found final download URL: ${currentUrl}`);
            return currentUrl;
        }
        
        // Look for clickable links on the page
        const clickableUrl = await findClickableDownloadLink(page);
        if (clickableUrl && clickableUrl !== currentUrl) {
            console.log(`🔗 Found clickable link: ${clickableUrl}`);
            currentUrl = clickableUrl;
            redirectCount++;
            continue;
        }
        
        // Check page content for redirect URLs
        const pageContent = await page.content();
        const extractedUrl = extractUrlFromHtml(pageContent);
        if (extractedUrl && extractedUrl !== currentUrl) {
            console.log(`📌 Extracted URL from HTML: ${extractedUrl}`);
            currentUrl = extractedUrl;
            redirectCount++;
            continue;
        }
        
        // No more redirects found
        break;
    }
    
    // Final check: if we have a URL that's not a known intermediate domain
    if (currentUrl && !isIntermediateDomain(currentUrl)) {
        console.log(`📤 Returning URL: ${currentUrl}`);
        return currentUrl;
    }
    
    return currentUrl;
}

function isFinalDownloadUrl(url) {
    const finalPatterns = [
        /\.(mp4|mkv|webm|avi|mov|m4v|mpg|mpeg)(\?|$)/i,
        /sonic-cloud\.online/i,
        /pixeldrain\.com/i,
        /drive\.google\.com/i,
        /mega\.nz/i,
        /mediafire\.com/i,
        /dropbox\.com/i,
        /direct-download/i
    ];
    
    for (const pattern of finalPatterns) {
        if (pattern.test(url)) {
            return true;
        }
    }
    return false;
}

function isIntermediateDomain(url) {
    try {
        const hostname = new URL(url).hostname;
        const intermediateDomains = [
            'crn77.com',
            'cinesubz.lk',
            'cinesubz.net',
            'google.com',
            'adstudio.cloud'
        ];
        return intermediateDomains.some(domain => hostname.includes(domain));
    } catch {
        return true;
    }
}

async function findClickableDownloadLink(page) {
    // Try multiple selectors
    const selectors = [
        '#link',
        '.wait-done a',
        '.download-button',
        '.btn-download',
        'a[href*="google.com/server"]',
        'a[href*="sonic-cloud"]',
        'a[href*="t.me"]',
        'a:contains("Download")',
        'a:contains("click here")',
        'a:contains("Go to Download")',
        'button:contains("Download")',
        '.direct-download-button a',
        '.movie-download-link-item a'
    ];
    
    for (const selector of selectors) {
        try {
            const element = await page.$(selector);
            if (element) {
                const href = await page.evaluate(el => el.getAttribute('href'), element);
                if (href && href.startsWith('http')) {
                    console.log(`📍 Found selector "${selector}" with href: ${href}`);
                    return href;
                }
                // Click and check for navigation
                await element.click();
                await page.waitForTimeout(2000);
                const newUrl = page.url();
                if (newUrl) return newUrl;
            }
        } catch (err) {
            // Continue to next selector
        }
    }
    
    // Try JavaScript evaluation to find any clickable download element
    const jsResult = await page.evaluate(() => {
        const allElements = document.querySelectorAll('a, button, div[onclick], span[onclick]');
        for (const el of allElements) {
            const text = el.textContent?.toLowerCase() || '';
            const href = el.getAttribute('href') || '';
            const onclick = el.getAttribute('onclick') || '';
            
            if (text.includes('download') || text.includes('click here') || text.includes('go to') ||
                href.includes('http') || onclick.includes('location')) {
                
                if (href && href.startsWith('http')) return href;
                if (onclick) {
                    const match = onclick.match(/["'](https?:\/\/[^"']+)["']/);
                    if (match) return match[1];
                }
                el.click();
                return 'clicked';
            }
        }
        return null;
    });
    
    if (jsResult && jsResult !== 'clicked') {
        return jsResult;
    }
    
    return null;
}

function extractUrlFromHtml(html) {
    const patterns = [
        /window\.location\.href\s*=\s*["']([^"']+)["']/i,
        /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
        /var\s+downloadUrl\s*=\s*["']([^"']+)["']/i,
        /var\s+link\s*=\s*["']([^"']+)["']/i,
        /data-url=["']([^"']+)["']/i,
        /data-href=["']([^"']+)["']/i,
        /<meta[^>]*http-equiv=["']refresh["'][^>]*content=["']\d+;\s*url=([^"']+)/i,
        /https?:\/\/(?:www\.)?(?:sonic-cloud|pixeldrain|drive\.google|mega\.nz|mediafire)[^\s"'<>]+/i
    ];
    
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let url = match[1];
            if (url.startsWith('/')) url = 'https://cinesubz.lk' + url;
            if (url.startsWith('http')) return url;
        }
    }
    return null;
}

// ============ MAIN EXTRACTION FUNCTION ============
async function extractDownloadUrl(ztUrl) {
    let page = null;
    
    try {
        console.log(`🔗 Starting extraction from: ${ztUrl}`);
        
        const browser = await getBrowser();
        page = await browser.newPage();
        
        // Set realistic viewport and headers
        await page.setViewport({ width: 1280, height: 800 });
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://cinesubz.lk/'
        });
        
        // Follow all redirects and extract final URL
        const finalUrl = await followRedirectsAndExtract(ztUrl, page);
        
        // Clean up URL
        let cleanUrl = finalUrl;
        if (cleanUrl && !cleanUrl.startsWith('http')) {
            if (cleanUrl.startsWith('//')) {
                cleanUrl = 'https:' + cleanUrl;
            } else if (cleanUrl.startsWith('/')) {
                cleanUrl = 'https://cinesubz.lk' + cleanUrl;
            }
        }
        
        // Extract filename
        let filename = null;
        if (cleanUrl) {
            const filenameMatch = cleanUrl.match(/\/([^\/?#]+\.(?:mp4|mkv|zip|rar|avi|mov|webm|m3u8))(?:\?|$)/i);
            if (filenameMatch) {
                filename = decodeURIComponent(filenameMatch[1]);
            } else {
                // Try to get from page title
                const title = await page.title();
                if (title && !title.includes('Redirect')) {
                    filename = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100) + '.mp4';
                }
            }
        }
        
        // Determine if Telegram
        const isTelegram = cleanUrl ? cleanUrl.includes('t.me') : false;
        
        await page.close();
        
        if (cleanUrl && !cleanUrl.includes('/zt-links/')) {
            return { 
                success: true, 
                url: cleanUrl,
                filename: filename,
                is_telegram: isTelegram,
                host: extractHostFromUrl(cleanUrl)
            };
        } else {
            throw new Error('Could not extract final download URL');
        }
        
    } catch (error) {
        console.error(`❌ Extraction error:`, error.message);
        if (page) await page.close().catch(() => {});
        return { success: false, error: error.message };
    }
}

// ============ SEARCH MOVIES FUNCTION ============
async function searchMovies(query, page = 1) {
    try {
        const searchUrl = `https://cinesubz.lk/page/${page}/?s=${encodeURIComponent(query)}`;
        
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
            let title = $item.find('.item-desc-title h3, .item-title').first().text().trim();
            let url = $item.find('a').first().attr('href');
            let poster = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-original');
            
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
                page: page,
                total_pages: totalPages,
                has_next_page: page < totalPages,
                total_results: results.length,
                results: results.slice(0, 50)
            }
        };
        
    } catch (error) {
        return { success: false, error: `Search failed: ${error.message}` };
    }
}

// ============ RECENT MOVIES FUNCTION ============
async function getRecentMovies(page = 1) {
    try {
        const url = page === 1 ? 'https://cinesubz.lk/movies/' : `https://cinesubz.lk/movies/page/${page}/`;
        
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
            let title = $item.find('.item-desc-title h3, .item-title').first().text().trim();
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
        
        return {
            success: true,
            data: {
                page: page,
                total_pages: totalPages,
                has_next_page: page < totalPages,
                total_movies: movies.length,
                movies: movies
            }
        };
        
    } catch (error) {
        return { success: false, error: `Failed to fetch: ${error.message}` };
    }
}

// ============ MOVIE DETAILS FUNCTION ============
async function getMovieDetails(url) {
    try {
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        let title = $('.details-title h3').first().text().trim();
        if (!title) title = $('title').text().replace(' – CineSubz', '').trim();
        
        let poster = $('.content-poster .poster-img').attr('src');
        if (!poster) poster = $('.poster-img').attr('src');
        if (poster && !poster.startsWith('http')) poster = 'https://cinesubz.lk' + poster;
        
        let description = '';
        $('.details-desc p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 5000) {
                description = text;
                return false;
            }
        });
        
        let imdbRating = null;
        const imdbElement = $('.data-imdb').text();
        const ratingMatch = imdbElement.match(/IMDb:\s*([\d.]+)/i);
        if (ratingMatch) imdbRating = ratingMatch[1];
        
        let quality = $('.data-quality').first().text().trim();
        if (!quality) quality = $('.badge-quality-corner').first().text().trim();
        
        let year = null;
        $('.info-col p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Year:')) {
                const yearMatch = text.match(/Year:\s*(\d{4})/i);
                if (yearMatch) year = yearMatch[1];
            }
        });
        
        const genres = [];
        $('.details-genre a').each((i, el) => {
            const genre = $(el).text().trim();
            if (genre && !genres.includes(genre)) genres.push(genre);
        });
        
        const downloadLinks = [];
        $('.movie-download-button, .link-directandtgdownload .movie-download-link-item a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/zt-links/')) {
                downloadLinks.push({ url: href, type: 'Direct & Telegram Download', host: 'cinesubz.lk' });
            }
        });
        
        const similarMovies = [];
        $('.similar-item, .related-item').each((i, el) => {
            const similarTitle = $(el).find('.item-data h3, .data-title').text().trim();
            const movieUrl = $(el).find('a').first().attr('href');
            if (similarTitle && movieUrl && movieUrl.includes('/movies/')) {
                similarMovies.push({ title: similarTitle, slug: extractMovieId(movieUrl), url: movieUrl });
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
                download_links: downloadLinks,
                similar_movies: similarMovies.slice(0, 10)
            }
        };
        
    } catch (error) {
        return { success: false, error: `Failed to fetch: ${error.message}` };
    }
}

async function getPopularMovies() {
    return await getRecentMovies(1);
}

async function closeBrowser() {
    if (browserInstance) {
        console.log('🔒 Closing browser...');
        await browserInstance.close();
        browserInstance = null;
        browserLaunchTime = null;
    }
}

// ============ EXPRESS ROUTES ============

router.get('/', (req, res) => {
    res.json({
        success: true,
        message: "🎬 CineSubz API - Full Working Version (Handles Redirects)",
        author: "Mr Thinuzz",
        version: "4.0.0",
        endpoints: {
            "GET /extract?url=URL": "Extract final download URL (follows crn77.com redirects)",
            "GET /search?q=QUERY": "Search movies",
            "GET /recent": "Recent movies",
            "GET /info?url=URL": "Movie details",
            "GET /popular": "Popular movies"
        },
        example_extract: "/extract?url=https://cinesubz.lk/zt-links/niavvuv2re/"
    });
});

router.get('/extract', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ success: false, error: "URL parameter required" });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    
    if (!decodedUrl.startsWith('http')) {
        return res.status(400).json({ success: false, error: "Invalid URL format" });
    }
    
    if ((!decodedUrl.includes('cinesubz.lk') && !decodedUrl.includes('cinesubz.net')) || 
        !decodedUrl.includes('/zt-links/')) {
        return res.status(400).json({ 
            success: false, 
            error: "URL must be a CineSubz ZT-links page" 
        });
    }
    
    console.log(`📥 Extraction request: ${decodedUrl}`);
    const result = await extractDownloadUrl(decodedUrl);
    
    if (result.success) {
        res.json({
            success: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                original_url: decodedUrl,
                download_url: result.url,
                filename: result.filename,
                is_telegram: result.is_telegram,
                host: result.host
            }
        });
    } else {
        res.status(404).json({
            success: false,
            error: result.error,
            original_url: decodedUrl
        });
    }
});

router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    if (!q) return res.status(400).json({ success: false, error: "Missing 'q' parameter" });
    
    const result = await searchMovies(decodeURIComponent(q), parseInt(page) || 1);
    res.json(result);
});

router.get('/recent', async (req, res) => {
    const result = await getRecentMovies(parseInt(req.query.page) || 1);
    res.json(result);
});

router.get('/info', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: "Missing 'url' parameter" });
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    
    const result = await getMovieDetails(decodedUrl);
    res.json(result);
});

router.get('/popular', async (req, res) => {
    const result = await getPopularMovies();
    res.json(result);
});

// Cleanup on exit
process.on('exit', async () => await closeBrowser());
process.on('SIGINT', async () => { await closeBrowser(); process.exit(); });

module.exports = router;
