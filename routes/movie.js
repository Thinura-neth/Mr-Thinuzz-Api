// routes/movie.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const router = express.Router();

// Cache (TTL: 1 hour)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// ============ CONSTANTS ============
const CINESUBZ_BASE = "https://cinesubz.lk/";
const CINESUBZ_FAKE_BASE = "https://cinesubz.net/";
const DOWNLOAD_SITE_BASE = "https://bot3.sonic-cloud.online";

// Direct download domains (bypass validation)
const DIRECT_DOWNLOAD_DOMAINS = [
    'bot3.sonic-cloud.online',
    'bot3.sonic-cloud.com',
    'google.com',
    'drive.google.com',
    'fuckingfast.co',
    'gdtot.com',
    'linkvertise.com',
    'mediafire.com',
    'mega.nz',
    'terabox.com',
    'anonfiles.com',
    'pixeldrain.com'
];

// Helper: clean text
function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

// Helper: extract movie slug from URL
function extractMovieId(url) {
    const match = url.match(/\/movies\/([^\/?#]+)/);
    return match ? match[1] : null;
}

// Helper: check if URL is direct download
function isDirectDownloadUrl(url) {
    return DIRECT_DOWNLOAD_DOMAINS.some(domain => url.toLowerCase().includes(domain));
}

// ============ SEARCH MOVIES ============
async function searchMovies(query, pageNum = 1) {
    const cacheKey = `search_${query}_${pageNum}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const searchUrl = `https://cinesubz.lk/page/${pageNum}/?s=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        $(".display-item").each((i, el) => {
            const title = $(el).find(".item-box > a").attr("title");
            const movieUrl = $(el).find(".item-box > a").attr("href");
            const poster = $(el).find("img").attr("src");
            const imdb = $(el).find(".rating:nth-child(1)").text().replace("IMDB ", "").trim();
            const year = movieUrl?.match(/\d{4}/)?.[0];
            
            if (title && movieUrl && movieUrl.includes('/movies/')) {
                results.push({
                    title: cleanText(title),
                    slug: extractMovieId(movieUrl),
                    url: movieUrl,
                    poster: poster || null,
                    imdb: imdb || null,
                    year: year || null
                });
            }
        });
        
        const result = { success: true, data: { query, page: pageNum, results, total: results.length } };
        cache.set(cacheKey, result);
        return result;
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============ RECENT MOVIES ============
async function getRecentMovies(pageNum = 1) {
    const cacheKey = `recent_${pageNum}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const url = pageNum === 1 ? 'https://cinesubz.lk/movies/' : `https://cinesubz.lk/movies/page/${pageNum}/`;
        const { data } = await axios.get(url, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const $ = cheerio.load(data);
        const movies = [];
        
        $(".display-item").each((i, el) => {
            const title = $(el).find(".item-box > a").attr("title");
            const movieUrl = $(el).find(".item-box > a").attr("href");
            const poster = $(el).find("img").attr("src");
            
            if (title && movieUrl && movieUrl.includes('/movies/')) {
                movies.push({
                    title: cleanText(title),
                    slug: extractMovieId(movieUrl),
                    url: movieUrl,
                    poster: poster || null
                });
            }
        });
        
        const result = { success: true, data: { page: pageNum, movies, total: movies.length } };
        cache.set(cacheKey, result);
        return result;
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============ POPULAR MOVIES ============
async function getPopularMovies() {
    const cacheKey = 'popular_movies';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const { data } = await axios.get('https://cinesubz.lk/movies/', {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const $ = cheerio.load(data);
        const movies = [];
        
        $(".display-item").each((i, el) => {
            const title = $(el).find(".item-box > a").attr("title");
            const movieUrl = $(el).find(".item-box > a").attr("href");
            const poster = $(el).find("img").attr("src");
            const rating = $(el).find(".rating").first().text().trim();
            
            if (title && movieUrl && movieUrl.includes('/movies/')) {
                movies.push({
                    title: cleanText(title),
                    slug: extractMovieId(movieUrl),
                    url: movieUrl,
                    poster: poster || null,
                    rating: rating || null
                });
            }
        });
        
        movies.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        
        const result = { success: true, data: { movies: movies.slice(0, 20), total: Math.min(movies.length, 20) } };
        cache.set(cacheKey, result);
        return result;
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============ REPLACE URL FUNCTION ============
async function replaceUrl(originalUrl) {
    try {
        if (!originalUrl) return originalUrl;

        const urlMappings = [
            {
                search: ["https://google.com/server11/1:/", "https://google.com/server12/1:/", "https://google.com/server13/1:/"],
                replace: `${DOWNLOAD_SITE_BASE}/server1/`
            },
            {
                search: ["https://google.com/server21/1:/", "https://google.com/server22/1:/", "https://google.com/server23/1:/"],
                replace: `${DOWNLOAD_SITE_BASE}/server2/`
            },
            { search: ["https://google.com/server3/1:/"], replace: `${DOWNLOAD_SITE_BASE}/server3/` },
            { search: ["https://google.com/server4/1:/"], replace: `${DOWNLOAD_SITE_BASE}/server4/` },
            { search: ["https://google.com/server5/1:/"], replace: `${DOWNLOAD_SITE_BASE}/server5/` },
            { search: ["https://google.com/server6/"], replace: `${DOWNLOAD_SITE_BASE}/server6/` }
        ];

        let modifiedUrl = originalUrl;
        let urlChanged = false;

        for (const mapping of urlMappings) {
            for (const searchUrl of mapping.search) {
                if (originalUrl.includes(searchUrl)) {
                    modifiedUrl = originalUrl.replace(searchUrl, mapping.replace);
                    urlChanged = true;
                    break;
                }
            }
            if (urlChanged) break;
        }

        // Extension fixes
        if (modifiedUrl.includes(".mp4?bot=cscloud2bot&code=")) {
            modifiedUrl = modifiedUrl.replace(".mp4?bot=cscloud2bot&code=", "?ext=mp4&bot=cscloud2bot&code=");
        } else if (modifiedUrl.includes(".mp4")) {
            modifiedUrl = modifiedUrl.replace(".mp4", "?ext=mp4");
        } else if (modifiedUrl.includes(".mkv?bot=cscloud2bot&code=")) {
            modifiedUrl = modifiedUrl.replace(".mkv?bot=cscloud2bot&code=", "?ext=mkv&bot=cscloud2bot&code=");
        } else if (modifiedUrl.includes(".mkv")) {
            modifiedUrl = modifiedUrl.replace(".mkv", "?ext=mkv");
        } else if (modifiedUrl.includes(".zip")) {
            modifiedUrl = modifiedUrl.replace(".zip", "?ext=zip");
        }

        return modifiedUrl;
    } catch (error) {
        console.error("Replace URL error:", error.message);
        return originalUrl;
    }
}

// ============ GET DOWNLOAD LINKS ============
async function getDownloadUrls($) {
    const rows = [];

    $(".link-wrapper div div").each((index, element) => {
        let metaText = $(element).find(".movie-download-meta").text().trim();
        if (!metaText) {
            metaText = $(element).find(".download-meta").text().trim();
        }

        const meta = metaText.split("•");
        const quality = meta[0]?.trim();
        const size = meta[1]?.trim();
        const language = meta[2]?.trim();

        let link = $(element).find("a").attr("href");
        if (link) {
            link = link.replace("cinesubz.net", "cinesubz.lk");
            rows.push({ quality, size, language, link });
        }
    });

    const detailedUrls = await Promise.all(
        rows.map(async (item) => {
            try {
                const detailResponse = await axios.get(item.link, {
                    timeout: 30000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                const $detail = cheerio.load(detailResponse.data);
                
                let finalLink = $detail("#link").attr("href")?.trim();
                
                if (finalLink && finalLink.includes("google.com")) {
                    finalLink = await replaceUrl(finalLink);
                }
                
                return {
                    quality: item.quality,
                    size: item.size,
                    language: item.language,
                    url: finalLink || item.link
                };
            } catch (err) {
                console.error(`Error loading ${item.link}: ${err.message}`);
                return {
                    quality: item.quality,
                    size: item.size,
                    language: item.language,
                    url: item.link
                };
            }
        })
    );

    return detailedUrls;
}

// ============ SCRAPE MOVIE INFO ============
async function scrapeMovieInfo(movieUrl) {
    const cacheKey = `movie_${movieUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        console.log(`🎬 Scraping: ${movieUrl}`);
        const { data: html } = await axios.get(movieUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(html);

        let title = $(".details-title h3").text().trim();
        
        let maintitle = title.replace(
            /(Sinhala Subtitles?\s*\|\s*සිංහල උපසිරැසි සමඟ|Sinhala Subtitles?|with Sinhala Subtitles?|සිංහල උපසිරැසි\s*සමඟ|\|\s*සිංහල උපසිරැසි(?:\s*සමඟ)?)/gi,
            ""
        ).trim();

        const yearMatch = movieUrl.match(/\d{4}/);
        const releaseYear = yearMatch ? yearMatch[0] : null;

        const country = $(".details-info div:nth-child(2) p:nth-child(3) span").text().trim();
        const runtime = $(".content-col.right div div.details-data span:nth-child(3)").text().trim();

        let mainImage = $(".poster-img").attr("src");
        if (mainImage) {
            mainImage = mainImage.replace("fit=", "fit")
                .replace(/-\d+x\d+\.jpg$/, ".jpg")
                .replace(CINESUBZ_FAKE_BASE, CINESUBZ_BASE);
        }

        const categorydata = $(".details-genre a").text().trim();
        const genres = categorydata.match(/([A-Z][a-z]+|\d+\+?)/g) || [];

        const directorName = $("#cast div:nth-child(3) div div.data div.name a").text().trim();
        const directorUrl = $("#cast div:nth-child(3) div div.data div.name a").attr("href");

        const ratingValue = $(".sheader .starstruck-rating .dt_rating_vgs").text().trim() || "0";
        const ratingCount = $(".sheader .starstruck-rating .rating-count").text().trim() || "0";

        const imdbrating = $(".data-imdb.v2").text().replace("IMDb:", "").trim() || "0";
        const imdbratingCount = $(".votes-count").text().replace("votes", "").trim() || "0";

        const description = $('#info div[itemprop="description"]')
            .clone()
            .find("script")
            .remove()
            .end()
            .text()
            .trim();

        const cast = [];
        $(".zt-cast-card").each((i, el) => {
            const actorName = $(el).find(".zt-cast-name").text().trim();
            const actorUrl = $(el).find(".zt-cast-link").attr("href");
            const characterName = $(el).find(".zt-cast-role").text().trim();
            
            if (actorName) {
                cast.push({
                    actor: { name: actorName, url: actorUrl || null },
                    character: characterName || null
                });
            }
        });

        const imageUrls = [];
        $('meta[property="og:image"]').each((i, el) => {
            const content = $(el).attr("content");
            if (content) imageUrls.push(content.trim());
        });

        const downloadLinks = await getDownloadUrls($);

        const result = {
            status: true,
            data: {
                url: movieUrl,
                title: maintitle || title,
                full_title: title,
                release_year: releaseYear,
                country: country || null,
                runtime: runtime || null,
                poster: mainImage || null,
                images: imageUrls,
                description: cleanText(description),
                genres: genres,
                rating: {
                    value: ratingValue,
                    count: ratingCount
                },
                imdb: {
                    value: imdbrating,
                    count: imdbratingCount
                },
                director: {
                    name: directorName || null,
                    url: directorUrl || null
                },
                cast: cast,
                download_links: downloadLinks,
                scraped_at: new Date().toISOString()
            }
        };

        cache.set(cacheKey, result);
        return result;
        
    } catch (error) {
        console.error(`❌ Scrape error: ${error.message}`);
        return {
            status: false,
            error: `Failed to scrape: ${error.message}`,
            url: movieUrl
        };
    }
}

// ============ EXTRACT DOWNLOAD (UPDATED - Supports all URLs) ============
async function extractDownload(downloadUrl) {
    const cacheKey = `download_${downloadUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        let finalUrl = downloadUrl;
        let isDirect = isDirectDownloadUrl(downloadUrl);
        
        console.log(`📥 Processing URL: ${downloadUrl}`);
        console.log(`📥 Is direct download: ${isDirect}`);
        
        // If it's already a direct download URL
        if (isDirect) {
            console.log(`✅ Already direct download URL`);
            
            // Apply replacement for Google URLs
            if (downloadUrl.includes("google.com")) {
                finalUrl = await replaceUrl(downloadUrl);
            }
            
            // Clean bot3 URLs
            if (downloadUrl.includes('bot3.sonic-cloud.online')) {
                if (!downloadUrl.includes('?ext=')) {
                    const extMatch = downloadUrl.match(/\.(mp4|mkv|zip)/i);
                    if (extMatch) {
                        const ext = extMatch[1].toLowerCase();
                        finalUrl = downloadUrl + (downloadUrl.includes('?') ? `&ext=${ext}` : `?ext=${ext}`);
                    }
                }
            }
            
            const result = {
                status: true,
                data: {
                    original_url: downloadUrl,
                    download_url: finalUrl,
                    is_direct: true,
                    message: "This is a direct download URL. You can use it immediately."
                }
            };
            
            cache.set(cacheKey, result);
            return result;
        }
        
        // For cinesubz URLs, extract the link
        if (downloadUrl.includes('cinesubz.lk') || downloadUrl.includes('cinesubz.net')) {
            console.log(`📥 Extracting from CineSubz page`);
            
            const { data: html } = await axios.get(downloadUrl, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            
            const $ = cheerio.load(html);
            const directLink = $("#link").attr("href")?.trim();
            
            if (directLink) {
                finalUrl = directLink;
                console.log(`📥 Found direct link: ${finalUrl}`);
                
                if (finalUrl.includes("google.com")) {
                    finalUrl = await replaceUrl(finalUrl);
                    console.log(`📥 After replacement: ${finalUrl}`);
                }
            }
        }
        
        const result = {
            status: true,
            data: {
                original_url: downloadUrl,
                download_url: finalUrl,
                is_direct: isDirect,
                processed_at: new Date().toISOString()
            }
        };
        
        cache.set(cacheKey, result);
        return result;
        
    } catch (error) {
        console.error(`❌ Extract error: ${error.message}`);
        return {
            status: false,
            error: `Failed to process: ${error.message}`,
            original_url: downloadUrl,
            suggestion: "If this is a direct download URL, try using it directly in your browser."
        };
    }
}

// ============ VALIDATE/CHECK URL ============
async function checkUrl(url) {
    try {
        const response = await axios.head(url, {
            timeout: 10000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://cinesubz.lk/'
            }
        });
        
        return {
            accessible: true,
            status_code: response.status,
            content_type: response.headers['content-type'],
            content_length: response.headers['content-length']
        };
    } catch (error) {
        return {
            accessible: false,
            error: error.message,
            note: "URL format is valid but may require specific headers or referer"
        };
    }
}

// ============ ROUTES ============

// Root - API info
router.get('/', (req, res) => {
    res.json({
        status: true,
        name: "Movies API",
        name_si: "චිත්‍රපට API",
        description: "Scrape movie data from CineSubz with Sinhala subtitles",
        author: "Mr Thinuzz",
        version: "2.0.0",
        endpoints: {
            "/search": "Search movies - ?q=query&page=1",
            "/recent": "Recent movies - ?page=1",
            "/popular": "Popular movies",
            "/info": "Movie info with download links - ?url=movie_url",
            "/extract": "Extract direct download (supports any URL) - ?url=any_url",
            "/check": "Check if URL is accessible - ?url=any_url"
        },
        examples: {
            search: "/movie/search?q=oppenheimer",
            recent: "/movie/recent",
            popular: "/movie/popular",
            info: "/movie/info?url=https://cinesubz.lk/movies/example/",
            extract: "/movie/extract?url=https://bot3.sonic-cloud.online/server5/video.mp4",
            check: "/movie/check?url=https://bot3.sonic-cloud.online/server5/video.mp4"
        }
    });
});

// Search endpoint
router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    if (!q) {
        return res.status(400).json({ success: false, error: "Missing 'q' parameter" });
    }
    const result = await searchMovies(q, parseInt(page) || 1);
    res.json(result);
});

// Recent movies endpoint
router.get('/recent', async (req, res) => {
    const result = await getRecentMovies(parseInt(req.query.page) || 1);
    res.json(result);
});

// Popular movies endpoint
router.get('/popular', async (req, res) => {
    const result = await getPopularMovies();
    res.json(result);
});

// Movie info endpoint (CineSubz only)
router.get('/info', async (req, res) => {
    const { url, q } = req.query;
    const targetUrl = q || url;
    
    if (!targetUrl) {
        return res.status(400).json({ 
            status: false, 
            error: "Missing 'url' or 'q' parameter",
            usage: "/movie/info?url=https://cinesubz.lk/movies/example/"
        });
    }
    
    let decoded = decodeURIComponent(targetUrl);
    
    if (!decoded.includes('cinesubz.lk') && !decoded.includes('cinesubz.net')) {
        return res.status(400).json({ 
            status: false, 
            error: "Only cinesubz.lk or cinesubz.net URLs allowed for /info endpoint",
            suggestion: "Use /movie/extract for direct download URLs"
        });
    }
    
    if (!decoded.includes('/movies/')) {
        return res.status(400).json({ 
            status: false, 
            error: "URL must contain /movies/ for /info endpoint" 
        });
    }
    
    const result = await scrapeMovieInfo(decoded);
    res.json(result);
});

// Extract download endpoint (SUPPORTS ALL URLs - No validation)
router.get('/extract', async (req, res) => {
    const { url, q } = req.query;
    const targetUrl = q || url;
    
    if (!targetUrl) {
        return res.status(400).json({ 
            status: false, 
            error: "Missing 'url' or 'q' parameter",
            usage: "/movie/extract?url=https://any-url.com/file.mp4"
        });
    }
    
    let decoded = decodeURIComponent(targetUrl);
    
    // NO VALIDATION - Accept any URL
    const result = await extractDownload(decoded);
    res.json(result);
});

// Check URL endpoint - Check if download link is accessible
router.get('/check', async (req, res) => {
    const { url, q } = req.query;
    const targetUrl = q || url;
    
    if (!targetUrl) {
        return res.status(400).json({ 
            status: false, 
            error: "Missing 'url' or 'q' parameter",
            usage: "/movie/check?url=https://bot3.sonic-cloud.online/video.mp4"
        });
    }
    
    let decoded = decodeURIComponent(targetUrl);
    const result = await checkUrl(decoded);
    
    res.json({
        status: true,
        data: {
            url: decoded,
            is_direct: isDirectDownloadUrl(decoded),
            ...result
        }
    });
});

// Direct download proxy (optional - for CORS issues)
router.get('/proxy', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: "Missing 'url' parameter" });
    }
    
    try {
        const decoded = decodeURIComponent(url);
        const response = await axios({
            method: 'get',
            url: decoded,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://cinesubz.lk/'
            }
        });
        
        res.setHeader('Content-Disposition', response.headers['content-disposition'] || 'attachment');
        res.setHeader('Content-Type', response.headers['content-type']);
        response.data.pipe(res);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
