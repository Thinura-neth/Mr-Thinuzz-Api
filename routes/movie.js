const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
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

// ============ BROWSER MANAGEMENT ============
let browserInstance = null;
let browserLaunchTime = null;
const BROWSER_IDLE_TIMEOUT = 5 * 60 * 1000;

async function getBrowser() {
    const now = Date.now();
    
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

// ============ FUNCTION TO CHECK IF URL IS FINAL ============
function isFinalDownloadUrl(url) {
    if (!url) return false;
    const finalPatterns = [
        /\.(mp4|mkv|webm|avi|mov|m4v)(\?|$)/i,
        /sonic-cloud\.online/i,
        /pixeldrain\.com/i,
        /drive\.google\.com/i,
        /mega\.nz/i,
        /mediafire\.com/i
    ];
    for (const pattern of finalPatterns) {
        if (pattern.test(url)) return true;
    }
    return false;
}

function isIntermediateDomain(url) {
    try {
        const hostname = new URL(url).hostname;
        const intermediateDomains = ['crn77.com', 'cinesubz.lk', 'cinesubz.net', 'adstudio.cloud'];
        return intermediateDomains.some(domain => hostname.includes(domain));
    } catch {
        return true;
    }
}

// ============ MAIN EXTRACTION FUNCTION (NO STEALTH) ============
async function extractDownloadUrl(ztUrl) {
    let page = null;
    
    try {
        console.log(`🔗 Starting extraction from: ${ztUrl}`);
        
        const browser = await getBrowser();
        page = await browser.newPage();
        
        // Set realistic viewport
        await page.setViewport({ width: 1280, height: 800 });
        
        // Set extra headers to avoid detection
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://cinesubz.lk/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        // Navigate to the page
        await page.goto(ztUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        let currentUrl = page.url();
        console.log(`📍 Current URL: ${currentUrl}`);
        
        // Follow redirects chain
        let maxSteps = 15;
        let step = 0;
        const visitedUrls = new Set();
        
        while (step < maxSteps && !visitedUrls.has(currentUrl) && !isFinalDownloadUrl(currentUrl)) {
            visitedUrls.add(currentUrl);
            
            console.log(`\n📌 Step ${step + 1}: ${currentUrl}`);
            
            // If we're on crn77.com, click the click here link
            if (currentUrl.includes('crn77.com')) {
                console.log('🖱️ Clicking link on crn77.com...');
                
                // Wait for the clickable element
                await page.waitForSelector('a', { timeout: 10000 });
                
                // Get all links and click the first one that looks like a download link
                const links = await page.$$eval('a', elements => 
                    elements.map(el => ({ href: el.href, text: el.textContent }))
                );
                
                let clicked = false;
                for (const link of links) {
                    if (link.text.toLowerCase().includes('click') || 
                        link.text.toLowerCase().includes('here') ||
                        link.href) {
                        await page.click(`a[href="${link.href}"]`);
                        clicked = true;
                        console.log(`✅ Clicked: ${link.text} -> ${link.href}`);
                        break;
                    }
                }
                
                if (!clicked && links.length > 0) {
                    await page.click('a:first-child');
                    console.log(`✅ Clicked first link`);
                }
                
                // Wait for navigation
                await page.waitForTimeout(3000);
                currentUrl = page.url();
                console.log(`📍 New URL: ${currentUrl}`);
                
                if (isFinalDownloadUrl(currentUrl)) {
                    break;
                }
                step++;
                continue;
            }
            
            // Check for countdown button
            try {
                const hasCountdown = await page.evaluate(() => {
                    const btn = document.querySelector('#link');
                    return btn && btn.disabled;
                });
                
                if (hasCountdown) {
                    console.log('⏳ Countdown active, waiting...');
                    await page.waitForFunction(
                        () => {
                            const btn = document.querySelector('#link');
                            return btn && !btn.disabled;
                        },
                        { timeout: 60000 }
                    );
                    console.log('✅ Countdown finished');
                }
            } catch (e) {
                console.log('⚠️ No countdown found or already finished');
            }
            
            // Try to click download button
            const selectors = ['#link', '.wait-done a', 'a[href*="google.com/server"]', 'a[href*="sonic-cloud"]', '.download-button'];
            let clicked = false;
            
            for (const selector of selectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        await element.click();
                        console.log(`✅ Clicked: ${selector}`);
                        clicked = true;
                        break;
                    }
                } catch (err) {}
            }
            
            if (!clicked) {
                // Try to click any link that might lead to download
                await page.evaluate(() => {
                    const allLinks = document.querySelectorAll('a');
                    for (const link of allLinks) {
                        const href = link.href;
                        const text = link.textContent.toLowerCase();
                        if (href && (href.includes('google.com/server') || 
                                     href.includes('sonic-cloud') ||
                                     text.includes('download') ||
                                     text.includes('go to'))) {
                            link.click();
                            return true;
                        }
                    }
                    return false;
                });
                console.log('✅ Clicked via JavaScript evaluation');
            }
            
            // Wait for navigation
            await page.waitForTimeout(3000);
            
            // Check for new pages
            const pages = await browser.pages();
            for (const p of pages) {
                const pUrl = p.url();
                if (pUrl !== currentUrl && !visitedUrls.has(pUrl) && pUrl !== 'about:blank') {
                    currentUrl = pUrl;
                    console.log(`📌 New page detected: ${currentUrl}`);
                    break;
                }
            }
            
            // Update current URL
            const newUrl = page.url();
            if (newUrl !== currentUrl) {
                currentUrl = newUrl;
                console.log(`📍 Updated URL: ${currentUrl}`);
            }
            
            if (isFinalDownloadUrl(currentUrl)) {
                break;
            }
            
            step++;
        }
        
        // Extract URL from HTML if needed
        if (!isFinalDownloadUrl(currentUrl)) {
            const html = await page.content();
            const patterns = [
                /window\.location\.href\s*=\s*["']([^"']+)["']/i,
                /var\s+link\s*=\s*["']([^"']+)["']/i,
                /https?:\/\/[^\s"'<>]*(?:sonic-cloud|pixeldrain|drive\.google)[^\s"'<>]+/i
            ];
            
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    let extracted = match[1];
                    if (extracted.startsWith('/')) extracted = 'https://cinesubz.lk' + extracted;
                    if (extracted.startsWith('http')) {
                        console.log(`📌 Extracted from HTML: ${extracted}`);
                        currentUrl = extracted;
                        break;
                    }
                }
            }
        }
        
        // Clean up URL
        let cleanUrl = currentUrl;
        if (cleanUrl && !cleanUrl.startsWith('http')) {
            if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
            else if (cleanUrl.startsWith('/')) cleanUrl = 'https://cinesubz.lk' + cleanUrl;
        }
        
        // Extract filename
        let filename = null;
        if (cleanUrl) {
            const filenameMatch = cleanUrl.match(/\/([^\/?#]+\.(?:mp4|mkv|zip|rar|avi|mov|webm|m3u8))(?:\?|$)/i);
            if (filenameMatch) {
                filename = decodeURIComponent(filenameMatch[1]);
            } else {
                const title = await page.title();
                if (title && !title.includes('Redirect')) {
                    filename = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100) + '.mp4';
                }
            }
        }
        
        await page.close();
        
        if (cleanUrl && !isIntermediateDomain(cleanUrl)) {
            return { 
                success: true, 
                url: cleanUrl,
                filename: filename,
                is_telegram: cleanUrl.includes('t.me'),
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

// ============ SEARCH FUNCTION ============
async function searchMovies(query, page = 1) {
    try {
        const searchUrl = `https://cinesubz.lk/page/${page}/?s=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const $ = cheerio.load(response.data);
        const results = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
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
                if (pageMatch && parseInt(pageMatch[1]) > totalPages) totalPages = parseInt(pageMatch[1]);
            }
        });
        
        return {
            success: true,
            data: { query, page, total_pages: totalPages, has_next_page: page < totalPages, total_results: results.length, results: results.slice(0, 50) }
        };
    } catch (error) {
        return { success: false, error: `Search failed: ${error.message}` };
    }
}

// ============ RECENT MOVIES ============
async function getRecentMovies(page = 1) {
    try {
        const url = page === 1 ? 'https://cinesubz.lk/movies/' : `https://cinesubz.lk/movies/page/${page}/`;
        const response = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
        
        const $ = cheerio.load(response.data);
        const movies = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            let title = $item.find('.item-desc-title h3, .item-title').first().text().trim();
            let url = $item.find('a').first().attr('href');
            let poster = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-original');
            
            if (title && url && (url.includes('/movies/') || url.includes('/movie/'))) {
                movies.push({ title: cleanText(title), slug: extractMovieId(url), url: url, poster: poster || null });
            }
        });
        
        let totalPages = 1;
        $('.pagination a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/page/')) {
                const pageMatch = href.match(/\/page\/(\d+)/);
                if (pageMatch && parseInt(pageMatch[1]) > totalPages) totalPages = parseInt(pageMatch[1]);
            }
        });
        
        return { success: true, data: { page, total_pages: totalPages, has_next_page: page < totalPages, total_movies: movies.length, movies } };
    } catch (error) {
        return { success: false, error: `Failed to fetch: ${error.message}` };
    }
}

// ============ MOVIE DETAILS ============
async function getMovieDetails(url) {
    try {
        const response = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
        const $ = cheerio.load(response.data);
        
        let title = $('.details-title h3').first().text().trim();
        if (!title) title = $('title').text().replace(' – CineSubz', '').trim();
        
        let poster = $('.content-poster .poster-img').attr('src');
        if (!poster) poster = $('.poster-img').attr('src');
        if (poster && !poster.startsWith('http')) poster = 'https://cinesubz.lk' + poster;
        
        let description = '';
        $('.details-desc p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 5000) { description = text; return false; }
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
            data: { title: cleanTitle, slug: extractMovieId(url), url, poster, description, imdb_rating: imdbRating, quality, year, genres, download_links: downloadLinks, similar_movies: similarMovies.slice(0, 10) }
        };
    } catch (error) {
        return { success: false, error: `Failed to fetch: ${error.message}` };
    }
}

async function getPopularMovies() { return await getRecentMovies(1); }
async function closeBrowser() { if (browserInstance) { await browserInstance.close(); browserInstance = null; } }

// ============ ROUTES ============

router.get('/', (req, res) => {
    res.json({
        success: true,
        message: "🎬 CineSubz API - Working Without Stealth Plugin",
        author: "Mr Thinuzz",
        endpoints: {
            "GET /extract?url=URL": "Extract final download URL",
            "GET /search?q=QUERY": "Search movies",
            "GET /recent": "Recent movies",
            "GET /info?url=URL": "Movie details"
        }
    });
});

router.get('/extract', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: "URL parameter required" });
    
    let decodedUrl;
    try { decodedUrl = decodeURIComponent(url); } catch (e) { decodedUrl = url; }
    
    if (!decodedUrl.startsWith('http')) return res.status(400).json({ success: false, error: "Invalid URL format" });
    if ((!decodedUrl.includes('cinesubz.lk') && !decodedUrl.includes('cinesubz.net')) || !decodedUrl.includes('/zt-links/')) {
        return res.status(400).json({ success: false, error: "URL must be a CineSubz ZT-links page" });
    }
    
    const result = await extractDownloadUrl(decodedUrl);
    if (result.success) {
        res.json({ success: true, author: "Mr Thinuzz", timestamp: new Date().toISOString(), data: result });
    } else {
        res.status(404).json({ success: false, error: result.error, original_url: decodedUrl });
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
    try { decodedUrl = decodeURIComponent(url); } catch (e) { decodedUrl = url; }
    const result = await getMovieDetails(decodedUrl);
    res.json(result);
});

router.get('/popular', async (req, res) => {
    const result = await getPopularMovies();
    res.json(result);
});

process.on('exit', async () => await closeBrowser());
process.on('SIGINT', async () => { await closeBrowser(); process.exit(); });

module.exports = router;
