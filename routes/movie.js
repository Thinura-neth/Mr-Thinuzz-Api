const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const NodeCache = require('node-cache');
const router = express.Router();

// Cache for downloaded URLs (TTL: 1 hour)
const cache = new NodeCache({ stdTTL: 3600 });

// ============ HELPER FUNCTIONS ============

function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

function extractMovieId(url) {
    const match = url.match(/\/movies\/([^\/?#]+)/);
    return match ? match[1] : null;
}

function extractHostFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch (e) {
        return 'unknown';
    }
}

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

// ============ BROWSER MANAGEMENT ============
let browserInstance = null;

async function getBrowser() {
    if (browserInstance) {
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
        ignoreHTTPSErrors: true
    });
    
    return browserInstance;
}

async function closeBrowser() {
    if (browserInstance) {
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
        console.log(`🔗 Extracting from: ${ztUrl}`);
        
        const browser = await getBrowser();
        page = await browser.newPage();
        
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://cinesubz.lk/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        await page.goto(ztUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        let currentUrl = page.url();
        console.log(`📍 Current URL: ${currentUrl}`);
        
        let maxSteps = 15;
        let step = 0;
        
        while (step < maxSteps && !isFinalDownloadUrl(currentUrl)) {
            console.log(`📌 Step ${step + 1}: ${currentUrl}`);
            
            if (currentUrl.includes('crn77.com')) {
                console.log('🖱️ Processing crn77.com...');
                try {
                    await page.waitForSelector('a', { timeout: 10000 });
                    await page.evaluate(() => {
                        const links = document.querySelectorAll('a');
                        for (const link of links) {
                            if (link.textContent.toLowerCase().includes('click') || link.href) {
                                link.click();
                                return;
                            }
                        }
                    });
                    await page.waitForTimeout(3000);
                    currentUrl = page.url();
                } catch (e) {
                    console.log('⚠️ Error on crn77.com:', e.message);
                }
                
                if (isFinalDownloadUrl(currentUrl)) break;
                step++;
                continue;
            }
            
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
            } catch (e) {}
            
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
                await page.evaluate(() => {
                    const links = document.querySelectorAll('a');
                    for (const link of links) {
                        const href = link.href;
                        const text = link.textContent.toLowerCase();
                        if (href && (href.includes('google.com/server') || href.includes('sonic-cloud') ||
                            text.includes('download') || text.includes('go to'))) {
                            link.click();
                            return;
                        }
                    }
                });
                console.log('✅ Clicked via JavaScript');
            }
            
            await page.waitForTimeout(3000);
            currentUrl = page.url();
            console.log(`📍 Updated URL: ${currentUrl}`);
            
            if (isFinalDownloadUrl(currentUrl)) break;
            step++;
        }
        
        let cleanUrl = currentUrl;
        if (cleanUrl && !cleanUrl.startsWith('http')) {
            if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
            else if (cleanUrl.startsWith('/')) cleanUrl = 'https://cinesubz.lk' + cleanUrl;
        }
        
        await page.close();
        
        if (cleanUrl && !isIntermediateDomain(cleanUrl) && cleanUrl !== ztUrl) {
            // Store in cache
            cache.set(ztUrl, cleanUrl);
            return { success: true, url: cleanUrl };
        } else {
            throw new Error('Could not extract final download URL');
        }
        
    } catch (error) {
        console.error(`❌ Extraction error:`, error.message);
        if (page) await page.close().catch(() => {});
        return { success: false, error: error.message };
    }
}

// ============ MOVIE DETAILS FUNCTION WITH PRE-FETCHED FINAL LINKS ============
async function getMovieDetails(url) {
    try {
        console.log(`🎬 Fetching movie details: ${url}`);
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // ============ TITLE ============
        let title = $('.details-title h3').first().text().trim();
        if (!title) title = $('title').text().replace(' – CineSubz.lk - Sinhala Subtitles', '').replace(' | සිංහල උපසිරැසි සමඟ', '').trim();
        const cleanTitle = title.replace(' Sinhala Subtitles | සිංහල උපසිරැසි සමඟ', '').trim();
        
        // ============ POSTER ============
        let poster = $('.content-poster .poster-img').attr('src');
        if (!poster) poster = $('.poster-img').attr('src');
        if (poster && !poster.startsWith('http')) poster = 'https://cinesubz.net' + poster;
        
        // ============ DESCRIPTION ============
        let description = '';
        $('.details-desc p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 5000 && !text.includes('Button එක ඔබලා')) {
                description = text;
                return false;
            }
        });
        
        // ============ IMDb RATING ============
        let imdbRating = null;
        const imdbElement = $('.data-imdb.v2, .data-imdb').first().text();
        const ratingMatch = imdbElement.match(/IMDb:\s*([\d.]+)/i);
        if (ratingMatch) imdbRating = ratingMatch[1];
        
        if (!imdbRating) {
            const starRating = $('.imdb-rating-badge .imdb-score').text().trim();
            if (starRating) imdbRating = starRating;
        }
        
        // ============ QUALITY ============
        let quality = $('.data-quality').first().text().trim();
        if (!quality) quality = $('.badge-quality-corner').first().text().trim();
        
        // ============ YEAR ============
        let year = null;
        $('.info-col p, .details-info p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Year:')) {
                const yearMatch = text.match(/Year:\s*(\d{4})/i);
                if (yearMatch) year = yearMatch[1];
            }
        });
        
        // ============ CAST ============
        const cast = [];
        $('.zt-cast-card, .cast-item, .actor-item').each((i, el) => {
            const $card = $(el);
            const name = $card.find('.zt-cast-name, .cast-name, .actor-name').text().trim();
            const role = $card.find('.zt-cast-role, .cast-role, .character-name').text().trim();
            
            if (name) {
                cast.push({
                    name: name,
                    role: role || null
                });
            }
        });
        
        // ============ DOWNLOAD LINKS WITH PRE-FETCHED FINAL URLs ============
        const downloadLinks = [];
        
        // Find all quality-based download sections
        $('.movie-download-button, .link-directandtgdownload .movie-download-link-item, .download-quality-item').each((i, el) => {
            const $item = $(el);
            
            let qualityText = $item.find('.movie-download-type, .quality-badge, .download-quality').text().trim();
            let sizeText = $item.find('.movie-download-meta, .file-size, .size-badge').text().trim();
            let ztLink = $item.find('a').attr('href');
            
            if (!qualityText) {
                qualityText = $item.closest('.download-item').find('.quality').text().trim();
            }
            if (!sizeText) {
                sizeText = $item.closest('.download-item').find('.size').text().trim();
            }
            
            qualityText = qualityText.replace('WEB-DL', '').replace('WEBRip', '').replace('BluRay', '').trim();
            
            if (ztLink && ztLink.includes('/zt-links/')) {
                downloadLinks.push({
                    quality: qualityText || 'Unknown Quality',
                    size: sizeText || 'Unknown Size',
                    original_zt_link: ztLink,
                    final_link: null
                });
            }
        });
        
        // Also check links-table structure
        $('.links-table tbody tr').each((i, el) => {
            const $row = $(el);
            const qualityText = $row.find('td:first-child').text().trim();
            const sizeText = $row.find('td:nth-child(2)').text().trim();
            const ztLink = $row.find('td:last-child a').attr('href');
            
            if (ztLink && ztLink.includes('/zt-links/') && qualityText) {
                const exists = downloadLinks.some(link => link.original_zt_link === ztLink);
                if (!exists) {
                    downloadLinks.push({
                        quality: qualityText,
                        size: sizeText || 'Unknown Size',
                        original_zt_link: ztLink,
                        final_link: null
                    });
                }
            }
        });
        
        // ============ Pre-fetch final download URLs for each quality ============
        console.log(`🔗 Pre-fetching ${downloadLinks.length} download links...`);
        
        for (let i = 0; i < downloadLinks.length; i++) {
            const link = downloadLinks[i];
            console.log(`  ⏳ Fetching final URL for ${link.quality}...`);
            
            const result = await extractDownloadUrl(link.original_zt_link);
            if (result.success) {
                link.final_link = result.url;
                console.log(`  ✅ Got final URL for ${link.quality}`);
            } else {
                console.log(`  ❌ Failed to get final URL for ${link.quality}: ${result.error}`);
                link.final_link = null;
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Filter out links where final_link is null
        const validDownloadLinks = downloadLinks.filter(link => link.final_link !== null);
        
        // ============ RESPONSE FORMAT EXACTLY MATCHING YOUR EXAMPLE ============
        return {
            status: true,
            data: {
                status: true,
                title: cleanTitle,
                imdb_rating: imdbRating || "N/A",
                quality: quality || "WEB-DL",
                year: year || "",
                poster: poster || null,
                description: description || "",
                cast: cast.slice(0, 10),
                download_links: validDownloadLinks
            },
            remainingCoins: 2092
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

// ============ ROUTES ============

router.get('/', (req, res) => {
    res.json({
        status: true,
        message: "🎬 CineSubz Movie API - With Pre-fetched Download Links",
        author: "Mr Thinuzz",
        endpoints: {
            "GET /info?q=URL": "Get movie details with pre-fetched final download links",
            "GET /extract?url=URL": "Extract final download URL from ZT-links page",
            "GET /search?q=QUERY": "Search movies",
            "GET /recent": "Get recent movies"
        },
        examples: {
            info: "/info?q=https://cinesubz.net/movies/guns-blazin-2024-sinhala-subtitles/",
            extract: "/extract?url=https://cinesubz.net/zt-links/tvlajmluno/",
            search: "/search?q=guns%20blazin",
            recent: "/recent"
        }
    });
});

// ============ INFO ENDPOINT (MOVIE DETAILS WITH PRE-FETCHED LINKS) ============
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
    const result = await getMovieDetails(decodedUrl);
    res.json(result);
});

// ============ EXTRACT ENDPOINT (SINGLE ZT-LINK) ============
router.get('/extract', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: "URL parameter required"
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

// ============ SEARCH ENDPOINT ============
router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    
    if (!q) {
        return res.status(400).json({
            success: false,
            error: "Search query parameter 'q' is required"
        });
    }
    
    try {
        const searchUrl = `https://cinesubz.lk/page/${parseInt(page) || 1}/?s=${encodeURIComponent(decodeURIComponent(q))}`;
        const response = await axios.get(searchUrl, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const $ = cheerio.load(response.data);
        const results = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            let title = $item.find('.item-desc-title h3, .item-title').first().text().trim();
            let movieUrl = $item.find('a').first().attr('href');
            let poster = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-original');
            
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
                if (pageMatch && parseInt(pageMatch[1]) > totalPages) totalPages = parseInt(pageMatch[1]);
            }
        });
        
        res.json({
            success: true,
            data: {
                query: decodeURIComponent(q),
                page: parseInt(page) || 1,
                total_pages: totalPages,
                total_results: results.length,
                results: results.slice(0, 50)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ RECENT ENDPOINT ============
router.get('/recent', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const url = page === 1 ? 'https://cinesubz.lk/movies/' : `https://cinesubz.lk/movies/page/${page}/`;
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const $ = cheerio.load(response.data);
        const movies = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            let title = $item.find('.item-desc-title h3, .item-title').first().text().trim();
            let movieUrl = $item.find('a').first().attr('href');
            let poster = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-original');
            
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
                if (pageMatch && parseInt(pageMatch[1]) > totalPages) totalPages = parseInt(pageMatch[1]);
            }
        });
        
        res.json({
            success: true,
            data: {
                page: page,
                total_pages: totalPages,
                total_movies: movies.length,
                movies: movies
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cleanup on process exit
process.on('exit', async () => await closeBrowser());
process.on('SIGINT', async () => { await closeBrowser(); process.exit(); });
process.on('SIGTERM', async () => { await closeBrowser(); process.exit(); });

module.exports = router;
