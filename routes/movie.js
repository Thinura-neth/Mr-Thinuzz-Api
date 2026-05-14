// routes/movie.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const protobuf = require('protobufjs');
const CryptoJS = require('crypto-js');
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

// ============ CRYPTO & DOWNLOAD FUNCTIONS (from original download.js) ============

function hexToBytes(hexString) {
    if (hexString.length % 2 !== 0) throw new Error("Hex string must have even length");
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
    }
    return bytes;
}

function base64ToUtf8(base64) {
    return Buffer.from(base64, "base64").toString("utf8");
}

function decrypt(encryptedText, secretKey) {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedText, secretKey);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedText) {
            throw new Error("Decryption failed");
        }
        return decryptedText;
    } catch (err) {
        console.error(`Decryption failed: ${err.message}`);
        return null;
    }
}

function getLastBodyScript(html) {
    const $ = cheerio.load(html);
    const scripts = $("body script");
    return scripts.length === 0 ? null : $(scripts[scripts.length - 2]).html()?.trim() || null;
}

function extractDownloadArray(jsCode) {
    try {
        const match = jsCode.match(/\[\s*\{[\s\S]*?id['"]?\s*:[\s\S]*?\}\s*\]/);
        if (!match) return null;
        return JSON.parse(match[0].replace(/'/g, '"').replace(/,\s*}/g, "}"));
    } catch (err) {
        console.error("Extraction failed:", err);
        return null;
    }
}

function extractDecryptKey(jsCode) {
    try {
        let result = { payload: null, decryptKey: null };
        const payloadMatch = jsCode.match(/decrypt\(\s*['"](U2FsdGVkX[^'"]+)['"]/);
        if (payloadMatch && payloadMatch.length >= 2) {
            result.payload = payloadMatch[1];
        }
        const keyMatch = jsCode.match(/decrypt\([^,]+,\s*['"]([^'"]+)['"]\)/g);
        if (keyMatch && keyMatch.length > 0) {
            for (let match of keyMatch) {
                const innerMatch = match.match(/['"]([^'"]+)['"]\)$/);
                if (innerMatch && innerMatch[1] !== 'kasun' && innerMatch[1] !== 'base64') {
                    result.decryptKey = innerMatch[1];
                    break;
                }
            }
        }
        const specificKeyMatch = jsCode.match(/\.url\s*=\s*base64ToUtf8\(decrypt\([^,]+,\s*['"]([^'"]+)['"]\)\)/);
        if (specificKeyMatch && specificKeyMatch.length >= 2) {
            result.decryptKey = specificKeyMatch[1];
        }
        return result;
    } catch (err) {
        console.error("Extraction failed:", err);
        return { payload: null, decryptKey: null };
    }
}

function getDownloadEnc(decryptKey) {
    const protoText = base64ToUtf8(decrypt(decryptKey, 'kasun'));
    const root = protobuf.parse(protoText, { keepCase: true }).root;
    return root.lookupType("responceEnc.DownloadData");
}

async function extractCookie() {
    const res = await axios.get(`${DOWNLOAD_SITE_BASE}/server2/`, {
        timeout: 30000,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9"
        }
    });
    const cookies = res.headers["set-cookie"];
    if (!cookies) throw new Error("Cookie not found");
    return cookies.split(";")[0].trim();
}

// Main download function (from original download.js)
async function cineSubzDownload(downloadPageUrl) {
    const cacheKey = `cinesubz_download_${downloadPageUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        console.log(`🔐 Processing CineSubz download page: ${downloadPageUrl}`);
        
        const cookie = await extractCookie();
        
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": cookie
        };

        let html, script;
        for (let i = 0; i < 3; i++) {
            const res = await axios.get(downloadPageUrl, { 
                headers: { ...headers, "Upgrade-Insecure-Requests": "1" },
                timeout: 30000
            });
            html = res.data;
            script = getLastBodyScript(html);
            if (script) break;
        }

        if (!script) throw new Error("Script tag not found");

        const downloadArray = extractDownloadArray(script);
        const cryptoData = extractDecryptKey(script);

        if (!downloadArray || !cryptoData?.decryptKey) {
            throw new Error("Failed to extract data or key");
        }

        const downloadEncType = getDownloadEnc(cryptoData.payload);

        const downloadUrls = await Promise.all(
            downloadArray.map(async (item) => {
                try {
                    const postRes = await axios.post(downloadPageUrl, hexToBytes(item.data), {
                        headers: { ...headers, "Content-Type": "application/octet-stream" },
                        responseType: 'arraybuffer',
                        timeout: 30000
                    });

                    let decoded = downloadEncType.toObject(
                        downloadEncType.decode(new Uint8Array(postRes.data))
                    );

                    if (decoded.url) {
                        decoded.url = base64ToUtf8(decrypt(decoded.url, cryptoData.decryptKey));
                    }
                    return decoded;
                } catch (err) {
                    console.error(`Item failed: ${err.message}`);
                    return null;
                }
            })
        );

        const validUrls = downloadUrls.filter(Boolean);
        
        const processedUrls = await Promise.all(
            validUrls.map(async (item) => {
                if (item.url && item.url.includes("google.com")) {
                    item.url = await replaceUrl(item.url);
                }
                return item;
            })
        );

        const result = {
            status: true,
            data: {
                original_page: downloadPageUrl,
                download_urls: processedUrls,
                total_links: processedUrls.length
            }
        };

        cache.set(cacheKey, result);
        return result;

    } catch (error) {
        console.error(`Download failed: ${error.message}`);
        return {
            status: false,
            error: error.message,
            original_page: downloadPageUrl
        };
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

// ============ ROUTES ============

router.get('/', (req, res) => {
    res.json({
        status: true,
        name: "Movies API",
        name_si: "චිත්‍රපට API",
        description: "Scrape movie data from CineSubz with Sinhala subtitles",
        author: "Mr Thinuzz",
        version: "3.0.0",
        endpoints: {
            "/search": "Search movies - ?q=query&page=1",
            "/recent": "Recent movies - ?page=1",
            "/popular": "Popular movies",
            "/info": "Movie info with download links - ?url=movie_url",
            "/download": "Extract direct download from CineSubz page - ?url=download_page_url",
            "/extract": "Process any URL (direct or CineSubz) - ?url=any_url"
        },
        examples: {
            search: "/movie/search?q=oppenheimer",
            recent: "/movie/recent",
            popular: "/movie/popular",
            info: "/movie/info?url=https://cinesubz.lk/movies/example/",
            download: "/movie/download?url=https://cinesubz.lk/zt-links/example/",
            extract: "/movie/extract?url=https://bot3.sonic-cloud.online/server5/video.mp4"
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

// Movie info endpoint
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
            error: "Only cinesubz.lk or cinesubz.net URLs allowed for /info endpoint" 
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

// Download endpoint - for CineSubz download pages (zt-links)
router.get('/download', async (req, res) => {
    const { url, q } = req.query;
    const targetUrl = q || url;
    
    if (!targetUrl) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' or 'q' parameter",
            usage: "/movie/download?url=https://cinesubz.lk/zt-links/..."
        });
    }
    
    let decoded = decodeURIComponent(targetUrl);
    
    if (!decoded.includes('cinesubz.lk') && !decoded.includes('cinesubz.net')) {
        return res.status(400).json({
            status: false,
            error: "Only cinesubz.lk or cinesubz.net URLs allowed for /download endpoint",
            suggestion: "Use /movie/extract for direct download URLs"
        });
    }
    
    const result = await cineSubzDownload(decoded);
    res.json(result);
});

// Extract endpoint - accepts ANY URL (direct or CineSubz)
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
    
    // Check if it's a CineSubz download page
    if ((decoded.includes('cinesubz.lk') || decoded.includes('cinesubz.net')) && 
        (decoded.includes('/zt-links/') || decoded.includes('/download/'))) {
        const result = await cineSubzDownload(decoded);
        return res.json(result);
    }
    
    // For direct URLs or any other URL
    let finalUrl = decoded;
    
    if (decoded.includes("google.com")) {
        finalUrl = await replaceUrl(decoded);
    }
    
    // Clean bot3 URLs
    if (decoded.includes('bot3.sonic-cloud.online')) {
        if (!decoded.includes('?ext=')) {
            const extMatch = decoded.match(/\.(mp4|mkv|zip)/i);
            if (extMatch) {
                const ext = extMatch[1].toLowerCase();
                finalUrl = decoded + (decoded.includes('?') ? `&ext=${ext}` : `?ext=${ext}`);
            }
        }
    }
    
    res.json({
        status: true,
        data: {
            original_url: decoded,
            download_url: finalUrl,
            is_direct: true,
            message: "Direct download URL (no processing needed)"
        }
    });
});

module.exports = router;
