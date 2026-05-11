const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ EXTRACT FINAL DOWNLOAD URL FROM ZT-LINKS (NO PUPPETEER) ============
async function extractDownloadUrl(ztUrl, retryCount = 0) {
    const cachedUrl = cache.get(ztUrl);
    if (cachedUrl) {
        console.log(`📦 Cache hit for: ${ztUrl}`);
        return { success: true, url: cachedUrl };
    }
    
    const maxRetries = 2;
    
    try {
        console.log(`🔗 Extracting from: ${ztUrl} (attempt ${retryCount + 1})`);
        
        // First request to get the page
        let response = await axios.get(ztUrl, {
            timeout: 30000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        let currentUrl = response.request.res.responseUrl || ztUrl;
        let html = response.data;
        
        console.log(`📍 Current URL: ${currentUrl}`);
        
        // Check if we already have a final URL
        if (currentUrl.includes('sonic-cloud.online') || 
            currentUrl.includes('.mp4') || 
            currentUrl.includes('.mkv')) {
            cache.set(ztUrl, currentUrl);
            return { success: true, url: currentUrl };
        }
        
        // Try multiple methods to extract download URL
        let finalUrl = null;
        
        // Method 1: Meta refresh
        const metaRefresh = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["']\d+;\s*url=([^"']+)/i);
        if (metaRefresh && metaRefresh[1]) {
            let redirectUrl = decodeURIComponent(metaRefresh[1]);
            if (redirectUrl.startsWith('/')) {
                redirectUrl = 'https://cinesubz.lk' + redirectUrl;
            }
            console.log(`📌 Found meta refresh: ${redirectUrl}`);
            
            try {
                const redirectResponse = await axios.get(redirectUrl, {
                    maxRedirects: 10,
                    timeout: 20000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                finalUrl = redirectResponse.request.res.responseUrl || redirectUrl;
            } catch (e) {
                finalUrl = redirectUrl;
            }
        }
        
        // Method 2: Extract from JavaScript variables
        if (!finalUrl) {
            const patterns = [
                /window\.location\.href\s*=\s*["']([^"']+)["']/i,
                /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
                /var\s+link\s*=\s*["']([^"']+)["']/i,
                /var\s+downloadUrl\s*=\s*["']([^"']+)["']/i,
                /data-url=["']([^"']+)["']/i,
                /data-href=["']([^"']+)["']/i
            ];
            
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    let url = match[1];
                    if (url.startsWith('/')) url = 'https://cinesubz.lk' + url;
                    if (url.startsWith('http')) {
                        finalUrl = url;
                        console.log(`📌 Found in JS: ${finalUrl}`);
                        break;
                    }
                }
            }
        }
        
        // Method 3: Extract from anchor tags
        if (!finalUrl) {
            const $ = cheerio.load(html);
            const links = [];
            
            $('a[href]').each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.startsWith('http') && 
                    !href.includes('cinesubz') && 
                    !href.includes('adstudio') &&
                    !href.includes('google.com') &&
                    href.length > 10) {
                    links.push(href);
                }
            });
            
            // Look for sonic-cloud or download links
            for (const link of links) {
                if (link.includes('sonic-cloud') || 
                    link.includes('.mp4') || 
                    link.includes('.mkv') ||
                    link.includes('download')) {
                    finalUrl = link;
                    console.log(`📌 Found in anchor: ${finalUrl}`);
                    break;
                }
            }
            
            if (!finalUrl && links.length > 0) {
                finalUrl = links[0];
                console.log(`📌 Using first external link: ${finalUrl}`);
            }
        }
        
        // Method 4: Direct regex for sonic-cloud URLs
        if (!finalUrl) {
            const sonicMatch = html.match(/https?:\/\/[^\s"'<>]*sonic-cloud[^\s"'<>]+/i);
            if (sonicMatch) {
                finalUrl = sonicMatch[0];
                console.log(`📌 Found sonic-cloud URL: ${finalUrl}`);
            }
        }
        
        // Method 5: Check for crn77.com redirect
        if (!finalUrl && currentUrl.includes('crn77.com')) {
            const $ = cheerio.load(html);
            const clickLink = $('a').first().attr('href');
            if (clickLink && clickLink.startsWith('http')) {
                try {
                    const clickResponse = await axios.get(clickLink, {
                        maxRedirects: 5,
                        timeout: 15000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                    finalUrl = clickResponse.request.res.responseUrl || clickLink;
                    console.log(`📌 Followed crn77.com link: ${finalUrl}`);
                } catch (e) {
                    finalUrl = clickLink;
                }
            }
        }
        
        if (finalUrl && (finalUrl.includes('sonic-cloud') || 
                         finalUrl.includes('.mp4') || 
                         finalUrl.includes('.mkv'))) {
            cache.set(ztUrl, finalUrl);
            return { success: true, url: finalUrl };
        } else if (retryCount < maxRetries) {
            console.log(`🔄 Retrying... (${retryCount + 1}/${maxRetries})`);
            await delay(2000);
            return await extractDownloadUrl(ztUrl, retryCount + 1);
        } else {
            return { success: false, error: 'Could not extract download URL' };
        }
        
    } catch (error) {
        console.error(`❌ Extraction error:`, error.message);
        
        if (retryCount < maxRetries) {
            console.log(`🔄 Retry due to error...`);
            await delay(3000);
            return await extractDownloadUrl(ztUrl, retryCount + 1);
        }
        
        return { success: false, error: error.message };
    }
}

// ============ MOVIE DETAILS FUNCTION ============
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
        
        const html = response.data;
        
        if (!html || typeof html !== 'string') {
            return {
                status: false,
                error: 'Invalid response from server',
                url: url
            };
        }
        
        const $ = cheerio.load(html);
        
        // TITLE
        let title = $('.details-title h3').first().text().trim();
        if (!title) title = $('title').text().trim();
        if (!title) title = $('h1').first().text().trim();
        
        const cleanTitle = title
            .replace(' – CineSubz.lk - Sinhala Subtitles', '')
            .replace(' | සිංහල උපසිරැසි සමඟ', '')
            .replace(' Sinhala Subtitles', '')
            .trim();
        
        if (!cleanTitle) {
            return {
                status: false,
                error: 'Could not extract movie title',
                url: url
            };
        }
        
        // POSTER
        let poster = $('.content-poster .poster-img').attr('src');
        if (!poster) poster = $('.poster-img').attr('src');
        if (!poster) poster = $('img[class*="poster"]').first().attr('src');
        if (poster && !poster.startsWith('http')) poster = 'https://cinesubz.net' + poster;
        
        // DESCRIPTION
        let description = '';
        $('.details-desc p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 5000 && !text.includes('Button එක ඔබලා')) {
                description = text;
                return false;
            }
        });
        
        if (!description) {
            description = $('meta[name="description"]').attr('content') || '';
        }
        
        // IMDB RATING
        let imdbRating = null;
        const imdbText = $('.data-imdb.v2, .data-imdb').first().text();
        const ratingMatch = imdbText.match(/(\d+\.?\d*)/);
        if (ratingMatch) imdbRating = ratingMatch[1];
        
        if (!imdbRating) {
            const starRating = $('.imdb-rating-badge .imdb-score').text().trim();
            if (starRating) imdbRating = starRating;
        }
        
        // QUALITY
        let quality = $('.data-quality').first().text().trim();
        if (!quality) quality = $('.badge-quality-corner').first().text().trim();
        if (!quality) quality = "WEB-DL";
        
        // YEAR
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
        
        // CAST
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
        
        // DOWNLOAD LINKS
        const downloadLinks = [];
        
        $('.movie-download-button').each((i, el) => {
            const $item = $(el);
            let qualityText = $item.find('.movie-download-type').text().trim();
            let sizeText = $item.find('.movie-download-meta').text().trim();
            let ztLink = $item.attr('href');
            
            if (!ztLink) ztLink = $item.find('a').first().attr('href');
            
            if (ztLink && ztLink.includes('/zt-links/')) {
                if (!qualityText) qualityText = 'Unknown Quality';
                if (!sizeText) sizeText = 'Unknown Size';
                
                const exists = downloadLinks.some(l => l.original_zt_link === ztLink);
                if (!exists) {
                    downloadLinks.push({
                        quality: qualityText,
                        size: sizeText,
                        original_zt_link: ztLink,
                        final_link: null
                    });
                }
            }
        });
        
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
        
        // PRE-FETCH FINAL URLs (without puppeteer)
        console.log(`🔗 Pre-fetching ${downloadLinks.length} download links...`);
        
        for (let i = 0; i < downloadLinks.length; i++) {
            const link = downloadLinks[i];
            console.log(`  ⏳ (${i + 1}/${downloadLinks.length}) Fetching final URL for ${link.quality}...`);
            
            try {
                const result = await extractDownloadUrl(link.original_zt_link);
                if (result && result.success) {
                    link.final_link = result.url;
                    console.log(`  ✅ Success for ${link.quality}`);
                } else {
                    console.log(`  ❌ Failed for ${link.quality}: ${result?.error || 'Unknown'}`);
                    link.final_link = null;
                }
            } catch (err) {
                console.log(`  ❌ Error for ${link.quality}: ${err.message}`);
                link.final_link = null;
            }
            
            if (i < downloadLinks.length - 1) {
                await delay(1500);
            }
        }
        
        const validDownloadLinks = downloadLinks.filter(link => link.final_link !== null);
        
        return {
            status: true,
            data: {
                status: true,
                title: cleanTitle,
                imdb_rating: imdbRating || "N/A",
                quality: quality,
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
            error: `Failed to fetch movie details: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ SEARCH FUNCTION ============
async function searchMovies(query, pageNum = 1) {
    try {
        const searchUrl = `https://cinesubz.lk/page/${pageNum}/?s=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
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
        return {
            success: false,
            error: `Search failed: ${error.message}`
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
        message: "🎬 CineSubz Movie API - Vercel Compatible (No Puppeteer)",
        author: "Mr Thinuzz",
        version: "4.0.0",
        endpoints: {
            "GET /info?q=URL": "Get movie details with pre-fetched final download links",
            "GET /extract?url=URL": "Extract final download URL from ZT-links page",
            "GET /search?q=QUERY&page=1": "Search movies on CineSubz",
            "GET /recent?page=1": "Get recently added movies"
        },
        examples: {
            info: "/info?q=https://cinesubz.net/movies/example/",
            extract: "/extract?url=https://cinesubz.net/zt-links/example/",
            search: "/search?q=example",
            recent: "/recent"
        }
    });
});

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
    
    console.log(`📥 Extract request: ${decodedUrl}`);
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

router.get('/recent', async (req, res) => {
    const pageNum = parseInt(req.query.page) || 1;
    const result = await getRecentMovies(pageNum);
    res.json(result);
});

module.exports = router;
