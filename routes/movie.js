const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const cheerio = require('cheerio');
const router = express.Router();

// Cache (TTL: 1 hour)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// ============ CONSTANTS ============
const CINESUBZ_BASE = "https://cinesubz.lk/";
const CINESUBZ_FAKE_BASE = "https://cinesubz.net/";
const DOWNLOAD_SITE_BASE = "https://bot3.sonic-cloud.online";

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

// ============ REPLACE URL FUNCTION ============
async function replaceUrl(originalUrl) {
    try {
        if (!originalUrl) throw new Error("URL is empty!");

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

        // Telegram fixes
        if (!urlChanged) {
            let tempUrl = originalUrl;
            tempUrl = tempUrl.replace("srilank222", "srilanka2222");
            tempUrl = tempUrl.replace("https://tsadsdaas.me/", "http://tdsdfasdaddd.me/");
            if (tempUrl !== originalUrl) {
                modifiedUrl = tempUrl;
            }
        }

        return modifiedUrl;
    } catch (error) {
        console.error("Replace URL error:", error.message);
        return originalUrl;
    }
}

// ============ GET DOWNLOAD LINKS ============
async function getDownloadUrls($, html) {
    const rows = [];

    // Extract download links from the page
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

    // Process each link to get final download URL
    const detailedUrls = await Promise.all(
        rows.map(async (item) => {
            try {
                // Fetch the detail page
                const detailResponse = await axios.get(item.link, {
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
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

        // ----- Title -----
        let title = $(".details-title h3").text().trim();
        
        // ----- Main Title (without subtitle text) -----
        let maintitle = title.replace(
            /(Sinhala Subtitles?\s*\|\s*සිංහල උපසිරැසි සමඟ|Sinhala Subtitles?|with Sinhala Subtitles?|සිංහල උපසිරැසි\s*සමඟ|\|\s*සිංහල උපසිරැසි(?:\s*සමඟ)?)/gi,
            ""
        ).trim();

        // ----- Release Year -----
        const yearMatch = movieUrl.match(/\d{4}/);
        const releaseYear = yearMatch ? yearMatch[0] : null;

        // ----- Country -----
        const country = $(".details-info div:nth-child(2) p:nth-child(3) span").text().trim();

        // ----- Runtime -----
        const runtime = $(".content-col.right div div.details-data span:nth-child(3)").text().trim();

        // ----- Main Image -----
        let mainImage = $(".poster-img").attr("src");
        if (mainImage) {
            mainImage = mainImage.replace("fit=", "fit")
                .replace(/-\d+x\d+\.jpg$/, ".jpg")
                .replace(CINESUBZ_FAKE_BASE, CINESUBZ_BASE);
        }

        // ----- Category / Genres -----
        const categorydata = $(".details-genre a").text().trim();
        const genres = categorydata.match(/([A-Z][a-z]+|\d+\+?)/g) || [];

        // ----- Director -----
        const directorName = $("#cast div:nth-child(3) div div.data div.name a").text().trim();
        const directorUrl = $("#cast div:nth-child(3) div div.data div.name a").attr("href");

        // ----- Rating -----
        const ratingValue = $(".sheader .starstruck-rating .dt_rating_vgs").text().trim() || "0";
        const ratingCount = $(".sheader .starstruck-rating .rating-count").text().trim() || "0";

        // ----- IMDb Rating -----
        const imdbrating = $(".data-imdb.v2").text().replace("IMDb:", "").trim() || "0";
        const imdbratingCount = $(".votes-count").text().replace("votes", "").trim() || "0";

        // ----- Description -----
        const description = $('#info div[itemprop="description"]')
            .clone()
            .find("script")
            .remove()
            .end()
            .text()
            .trim();

        // ----- Cast -----
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

        // ----- Images -----
        const imageUrls = [];
        $('meta[property="og:image"]').each((i, el) => {
            const content = $(el).attr("content");
            if (content) imageUrls.push(content.trim());
        });

        // ----- Download Links -----
        const downloadLinks = await getDownloadUrls($, html);

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

// ============ DIRECT DOWNLOAD ENDPOINT FUNCTION ============
async function getDirectDownload(downloadUrl) {
    const cacheKey = `download_${downloadUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        console.log(`📥 Fetching download: ${downloadUrl}`);
        
        // First, try to get the direct link if it's a page
        let finalUrl = downloadUrl;
        
        // If it's a cinesubz link (not already a direct download)
        if (downloadUrl.includes('cinesubz.lk') || downloadUrl.includes('cinesubz.net')) {
            const { data: html } = await axios.get(downloadUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            const $ = cheerio.load(html);
            const directLink = $("#link").attr("href")?.trim();
            
            if (directLink) {
                finalUrl = directLink;
            }
        }
        
        // Apply URL replacement if needed
        if (finalUrl.includes("google.com")) {
            finalUrl = await replaceUrl(finalUrl);
        }
        
        const result = {
            status: true,
            data: {
                original_url: downloadUrl,
                download_url: finalUrl,
                expires: null,
                quality: null,
                size: null
            }
        };
        
        cache.set(cacheKey, result);
        return result;
        
    } catch (error) {
        console.error(`❌ Download fetch error: ${error.message}`);
        return {
            status: false,
            error: `Failed to get download link: ${error.message}`,
            original_url: downloadUrl
        };
    }
}

// ============ SEARCH FUNCTION ============
async function searchMovies(query, pageNum = 1) {
    try {
        const searchUrl = `https://cinesubz.lk/page/${pageNum}/?s=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        const results = [];
        
        $(".display-item").each((i, el) => {
            const title = $(el).find(".item-box > a").attr("title");
            const movieUrl = $(el).find(".item-box > a").attr("href");
            const poster = $(el).find("img").attr("src");
            const imdb = $(el).find(".rating:nth-child(1)").text().replace("IMDB ", "").trim();
            const year = movieUrl?.match(/\d{4}/)?.[0];
            
            if (title && movieUrl) {
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
        
        return { success: true, data: { query, page: pageNum, results } };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getRecentMovies(pageNum = 1) {
    try {
        const url = pageNum === 1 ? 'https://cinesubz.lk/movies/' : `https://cinesubz.lk/movies/page/${pageNum}/`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
        
        return { success: true, data: { page: pageNum, movies } };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============ ROUTES ============
router.get('/', (req, res) => {
    res.json({
        status: true,
        message: "🎬 CineSubz Movie API - Web Scraping",
        author: "@Mr Thinuzz",
        version: "6.0.0",
        endpoints: {
            "GET /info?q=URL": "Get movie details with download links",
            "GET /download?url=URL": "Get direct download link from movie page or download URL",
            "GET /search?q=QUERY&page=1": "Search movies",
            "GET /recent?page=1": "Recently added movies"
        },
        examples: {
            info: "/info?q=https://cinesubz.lk/movies/example-movie/",
            download: "/download?url=https://cinesubz.lk/movies/example-movie/",
            search: "/search?q=spider",
            recent: "/recent"
        }
    });
});

// MAIN ENDPOINT - Movie Info with Download Links
router.get('/info', async (req, res) => {
    const { q, url } = req.query;
    const targetUrl = q || url;
    
    if (!targetUrl) {
        return res.status(400).json({ status: false, error: "Missing 'q' or 'url' parameter" });
    }
    
    let decoded = decodeURIComponent(targetUrl);
    
    if (!decoded.includes('cinesubz.lk') && !decoded.includes('cinesubz.net')) {
        return res.status(400).json({ status: false, error: "Only cinesubz.lk or cinesubz.net URLs allowed" });
    }
    
    if (!decoded.includes('/movies/')) {
        return res.status(400).json({ status: false, error: "URL must contain /movies/" });
    }
    
    const result = await scrapeMovieInfo(decoded);
    res.json(result);
});

// NEW DOWNLOAD ENDPOINT - Get direct download link
router.get('/download', async (req, res) => {
    const { url, q } = req.query;
    const targetUrl = q || url;
    
    if (!targetUrl) {
        return res.status(400).json({ 
            status: false, 
            error: "Missing 'url' or 'q' parameter",
            usage: "/download?url=https://cinesubz.lk/movies/example-movie/ or /download?url=https://cinesubz.lk/download-link/"
        });
    }
    
    let decoded = decodeURIComponent(targetUrl);
    
    // Validate URL (allow both movie pages and direct download pages)
    if (!decoded.includes('cinesubz.lk') && !decoded.includes('cinesubz.net')) {
        return res.status(400).json({ 
            status: false, 
            error: "Only cinesubz.lk or cinesubz.net URLs allowed" 
        });
    }
    
    const result = await getDirectDownload(decoded);
    res.json(result);
});

// Search endpoint
router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    if (!q) return res.status(400).json({ success: false, error: "Missing 'q' parameter" });
    const result = await searchMovies(q, parseInt(page) || 1);
    res.json(result);
});

// Recent endpoint
router.get('/recent', async (req, res) => {
    const result = await getRecentMovies(parseInt(req.query.page) || 1);
    res.json(result);
});

module.exports = router;
