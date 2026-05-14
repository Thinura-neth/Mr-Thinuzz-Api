// routes/movie.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const crypto = require('crypto-js');
const protobuf = require('protobufjs');
const router = express.Router();

// Cache
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Constants
const CINESUBZ_BASE = "https://cinesubz.lk/";
const CINESUBZ_FAKE_BASE = "https://cinesubz.net/";
const DOWNLOAD_SITE_BASE = "https://bot3.sonic-cloud.online";

// ============ DOWNLOAD.JS FUNCTIONS (Original logic) ============

// Base64 to UTF8
function base64ToUtf8(base64) {
    return Buffer.from(base64, "base64").toString("utf8");
}

// AES Decrypt
function decrypt(encryptedText, secretKey) {
    try {
        const bytes = crypto.AES.decrypt(encryptedText, secretKey);
        const decryptedText = bytes.toString(crypto.enc.Utf8);
        if (!decryptedText) {
            throw new Error("Decryption failed");
        }
        return decryptedText;
    } catch (err) {
        console.error(`Decryption failed: ${err.message}`);
        return null;
    }
}

// Hex to Bytes
function hexToBytes(hexString) {
    if (hexString.length % 2 !== 0) throw new Error("Hex string must have even length");
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
    }
    return bytes;
}

// Get last body script from HTML
function getLastBodyScript(html) {
    const $ = cheerio.load(html);
    const scripts = $("body script");
    if (scripts.length === 0) return null;
    return $(scripts[scripts.length - 2]).html()?.trim() || null;
}

// Extract download array from JS
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

// Extract decrypt key and payload
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
            
            const specificKeyMatch = jsCode.match(/\.url\s*=\s*base64ToUtf8\(decrypt\([^,]+,\s*['"]([^'"]+)['"]\)\)/);
            if (specificKeyMatch && specificKeyMatch.length >= 2) {
                result.decryptKey = specificKeyMatch[1];
            }
        }

        return result;
    } catch (err) {
        console.error("Extraction failed:", err);
        return { payload: null, decryptKey: null };
    }
}

// Get DownloadEnc Proto
function getDownloadEnc(decryptKey) {
    const protoText = base64ToUtf8(decrypt(decryptKey, 'kasun'));
    const root = protobuf.parse(protoText, { keepCase: true }).root;
    return root.lookupType("responceEnc.DownloadData");
}

// Extract cookie
async function extractCookie() {
    const res = await fetch(`${DOWNLOAD_SITE_BASE}/server2/`, {
        headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9"
        }
    });
    const cookies = res.headers.get("set-cookie");
    if (!cookies) throw new Error("Cookie not found");
    return cookies.split(";")[0].trim();
}

// ============ MAIN DOWNLOAD FUNCTION (From your download.js) ============
async function getDirectDownloadUrl(pageUrl) {
    const cacheKey = `download_${pageUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        console.log(`🔐 Processing protected download: ${pageUrl}`);
        
        // Extract cookie
        const cookie = await extractCookie();
        
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": cookie
        };

        // Get page HTML
        let html, script;
        for (let i = 0; i < 3; i++) {
            const res = await fetch(pageUrl, { headers: { ...headers, "Upgrade-Insecure-Requests": "1" } });
            if (!res.ok) throw new Error(`GET failed: ${res.status}`);
            html = await res.text();
            script = getLastBodyScript(html);
            if (script) break;
        }

        if (!script) throw new Error("Script tag not found");

        // Extract title and size
        const $ = cheerio.load(html);
        const title = $(".file-info:nth-child(1)").text().replace("File Name:", "").trim();
        const size = $(".file-info:nth-child(2)").text().replace("File Size:", "").trim();

        // Simple deobfuscation (since we don't have synchrony, use regex)
        let deobfuscated = script;
        
        // Extract crypto data
        const cryptoData = extractDecryptKey(deobfuscated);
        const downloadArray = extractDownloadArray(deobfuscated);

        if (!downloadArray || !cryptoData?.decryptKey) {
            throw new Error("Failed to extract data or key");
        }

        const downloadEncType = getDownloadEnc(cryptoData.payload);

        const downloadUrls = await Promise.all(
            downloadArray.map(async (item) => {
                try {
                    const postRes = await fetch(pageUrl, {
                        method: "POST",
                        headers: { ...headers, "Content-Type": "application/octet-stream" },
                        body: hexToBytes(item.data)
                    });

                    if (!postRes.ok) return null;

                    let decoded = downloadEncType.toObject(
                        downloadEncType.decode(new Uint8Array(await postRes.arrayBuffer()))
                    );

                    if (decoded.url) {
                        decoded.url = base64ToUtf8(decrypt(decoded.url, cryptoData.decryptKey));
                    }
                    return decoded;
                } catch (err) {
                    console.error("Item failed:", err.message);
                    return null;
                }
            })
        );

        const validUrls = downloadUrls.filter(Boolean);
        
        const result = {
            status: true,
            data: {
                title: title,
                size: size,
                download_urls: validUrls,
                original_page: pageUrl
            }
        };

        cache.set(cacheKey, result);
        return result;

    } catch (error) {
        console.error(`Download extraction failed: ${error.message}`);
        return {
            status: false,
            error: error.message,
            original_page: pageUrl
        };
    }
}

// ============ REGULAR EXTRACT (For already direct URLs) ============
async function extractDirectUrl(url) {
    const cacheKey = `direct_${url}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // Check if it's a CineSubz protected page
    if (url.includes('/zt-links/') || (url.includes('cinesubz') && !url.includes('/movies/'))) {
        console.log(`🔐 Protected page detected, using full extraction: ${url}`);
        const result = await getDirectDownloadUrl(url);
        cache.set(cacheKey, result);
        return result;
    }
    
    // For already direct URLs
    const result = {
        status: true,
        data: {
            url: url,
            is_direct: true,
            message: "This appears to be a direct download URL"
        }
    };
    cache.set(cacheKey, result);
    return result;
}

// ============ SEARCH FUNCTIONS ============
async function searchMovies(query, pageNum = 1) {
    const cacheKey = `search_${query}_${pageNum}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const searchUrl = `https://cinesubz.lk/page/${pageNum}/?s=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        $(".display-item").each((i, el) => {
            const title = $(el).find(".item-box > a").attr("title");
            const movieUrl = $(el).find(".item-box > a").attr("href");
            const poster = $(el).find("img").attr("src");
            const year = movieUrl?.match(/\d{4}/)?.[0];
            
            if (title && movieUrl && movieUrl.includes('/movies/')) {
                results.push({
                    title: cleanText(title),
                    url: movieUrl,
                    poster: poster || null,
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

async function getRecentMovies(pageNum = 1) {
    const cacheKey = `recent_${pageNum}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

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

async function getMovieInfo(movieUrl) {
    const cacheKey = `info_${movieUrl}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const { data: html } = await axios.get(movieUrl, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(html);

        const title = $(".details-title h3").text().trim();
        const poster = $(".poster-img").attr("src");
        const description = $('#info div[itemprop="description"]').text().trim();
        
        // Extract download links from movie page
        const downloadLinks = [];
        $(".link-wrapper div div").each((i, el) => {
            const link = $(el).find("a").attr("href");
            if (link && link.includes('/zt-links/')) {
                downloadLinks.push({
                    url: link,
                    text: $(el).text().trim()
                });
            }
        });

        const result = {
            status: true,
            data: {
                url: movieUrl,
                title: cleanText(title),
                poster: poster || null,
                description: cleanText(description),
                download_pages: downloadLinks,
                note: "Use /movie/extract?url={download_page_url} to get actual download links"
            }
        };
        
        cache.set(cacheKey, result);
        return result;
    } catch (error) {
        return { status: false, error: error.message };
    }
}

function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

// ============ ROUTES ============

router.get('/', (req, res) => {
    res.json({
        status: true,
        name: "Movies API with Download Extraction",
        author: "Mr Thinuzz",
        endpoints: {
            "/search?q=query": "Search movies",
            "/recent": "Recent movies",
            "/info?url=movie_url": "Get movie info with download page links",
            "/extract?url=page_url": "Extract actual download URL from protected page"
        },
        examples: {
            search: "/movie/search?q=spider",
            recent: "/movie/recent",
            info: "/movie/info?url=https://cinesubz.lk/movies/example/",
            extract: "/movie/extract?url=https://cinesubz.lk/zt-links/example/"
        }
    });
});

router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    if (!q) return res.status(400).json({ error: "Missing 'q' parameter" });
    const result = await searchMovies(q, parseInt(page) || 1);
    res.json(result);
});

router.get('/recent', async (req, res) => {
    const result = await getRecentMovies(parseInt(req.query.page) || 1);
    res.json(result);
});

router.get('/info', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "Missing 'url' parameter" });
    const result = await getMovieInfo(decodeURIComponent(url));
    res.json(result);
});

// MAIN DOWNLOAD ENDPOINT - Uses your original download.js logic
router.get('/extract', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ 
            status: false, 
            error: "Missing 'url' parameter",
            usage: "/movie/extract?url=https://cinesubz.lk/zt-links/xxxxx/"
        });
    }
    
    const targetUrl = decodeURIComponent(url);
    console.log(`📥 Extract request for: ${targetUrl}`);
    
    const result = await extractDirectUrl(targetUrl);
    res.json(result);
});

module.exports = router;
