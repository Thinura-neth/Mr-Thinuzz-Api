const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// ============ HELPER FUNCTIONS ============

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
        return "download_file.mp4";
    } catch (e) {
        return "download_file.mp4";
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

// ============ SEARCH MOVIES ============

async function searchMovies(query, page = 1) {
    try {
        console.log(`🔍 Searching for: ${query} (Page: ${page})`);
        
        const searchUrl = `https://cinesubz.net/page/${page}/?s=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const results = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            let title = $item.find('.item-desc-title h3, .item-title').text().trim();
            let url = $item.find('a').first().attr('href');
            let poster = $item.find('.thumb').attr('src');
            let quality = $item.find('.badge-quality-corner').text().trim();
            
            if (title && url && url.includes('/movies/')) {
                results.push({
                    title: title,
                    slug: extractMovieId(url),
                    url: url,
                    poster: poster || null,
                    quality: quality || null
                });
            }
        });
        
        return {
            status: true,
            timestamp: new Date().toISOString(),
            data: {
                query: query,
                page: page,
                total_results: results.length,
                results: results
            }
        };
        
    } catch (error) {
        return {
            status: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ GET MOVIE DETAILS (Main Movie Page) ============

async function getMovieDetails(url) {
    try {
        console.log(`🎬 Fetching movie details: ${url}`);
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Title
        let title = $('.details-title h3').first().text().trim();
        if (!title) title = $('title').text().replace(' – CineSubz.lk', '').trim();
        
        // Poster
        let poster = $('.content-poster .poster-img').attr('src');
        if (!poster) poster = $('.poster-img').attr('src');
        
        // IMDb Rating
        let imdbRating = null;
        const imdbElement = $('.data-imdb.v2');
        if (imdbElement.length) {
            const match = imdbElement.text().match(/IMDb:\s*([\d.]+)/i);
            if (match) imdbRating = match[1];
        }
        
        // Quality
        let quality = $('.data-quality').first().text().trim();
        
        // Year
        let year = null;
        $('.info-col p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Year:')) {
                const match = text.match(/Year:\s*(\d{4})/i);
                if (match) year = match[1];
            }
        });
        
        // Genres
        const genres = [];
        $('.details-genre a').each((i, el) => {
            genres.push($(el).text().trim());
        });
        
        // Description
        let description = '';
        $('.details-desc p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 5000) {
                description = text;
                return false;
            }
        });
        
        // ========== EXTRACT DOWNLOAD LINKS ==========
        const downloadLinks = [];
        
        // Method 1: Movie download buttons
        $('.movie-download-button').each((i, el) => {
            const href = $(el).attr('href');
            const type = $(el).find('.movie-download-type').text().trim();
            const meta = $(el).find('.movie-download-meta').text().trim();
            
            if (href && href.startsWith('https://cinesubz.net/zt-links/')) {
                downloadLinks.push({
                    url: href,
                    type: 'Direct Download',
                    quality: meta || null,
                    is_direct_link: false,
                    needs_processing: true
                });
            }
        });
        
        // Method 2: Link tables
        $('.links-table tbody tr td a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('cinesubz.net/zt-links/')) {
                const exists = downloadLinks.some(l => l.url === href);
                if (!exists) {
                    downloadLinks.push({
                        url: href,
                        type: 'Download Link',
                        quality: null,
                        is_direct_link: false,
                        needs_processing: true
                    });
                }
            }
        });
        
        return {
            status: true,
            timestamp: new Date().toISOString(),
            data: {
                title: title,
                slug: extractMovieId(url),
                url: url,
                poster: poster,
                imdb_rating: imdbRating,
                quality: quality,
                year: year,
                genres: genres,
                description: description,
                download_links: downloadLinks
            }
        };
        
    } catch (error) {
        return {
            status: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ PROCESS ZT-LINKS (Download Redirect Page) ============

async function processZtLink(ztUrl) {
    try {
        console.log(`🔄 Processing ZT-Link: ${ztUrl}`);
        
        const response = await axios.get(ztUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const html = response.data;
        const $ = cheerio.load(html);
        
        let finalUrl = null;
        let fileName = null;
        let fileSize = null;
        
        // Find the download link in the redirect page
        const downloadLink = $('#link, .wait-done a:first-child').attr('href');
        
        if (downloadLink) {
            // Apply URL transformations (from the index.html file-0.js logic)
            finalUrl = applyUrlTransformations(downloadLink);
            fileName = extractFilenameFromUrl(finalUrl);
            
            // Try to extract file size from page
            $('.movie-download-meta, .download-meta').each((i, el) => {
                const text = $(el).text();
                if (text.includes('MB') || text.includes('GB')) {
                    fileSize = text.trim();
                }
            });
        }
        
        if (finalUrl) {
            return {
                status: true,
                download_url: finalUrl,
                filename: fileName,
                file_size: fileSize,
                original_link: downloadLink
            };
        }
        
        return {
            status: false,
            error: "No download link found in redirect page"
        };
        
    } catch (error) {
        return {
            status: false,
            error: error.message
        };
    }
}

// ============ APPLY URL TRANSFORMATIONS (From file-0.js) ============

function applyUrlTransformations(url) {
    if (!url) return url;
    
    let modifiedUrl = url;
    let changed = false;
    
    // URL Mappings from the original code
    const urlMappings = [
        { search: ["https://google.com/server11/1:/", "https://google.com/server12/1:/", "https://google.com/server13/1:/"], replace: "https://bot3.sonic-cloud.online/server1/" },
        { search: ["https://google.com/server21/1:/", "https://google.com/server22/1:/", "https://google.com/server23/1:/"], replace: "https://bot3.sonic-cloud.online/server2/" },
        { search: ["https://google.com/server3/1:/"], replace: "https://bot3.sonic-cloud.online/server3/" },
        { search: ["https://google.com/server4/1:/"], replace: "https://bot3.sonic-cloud.online/server4/" },
        { search: ["https://google.com/server5/1:/"], replace: "https://bot3.sonic-cloud.online/server5/" },
        { search: ["https://google.com/server6/"], replace: "https://bot3.sonic-cloud.online/server6/" }
    ];
    
    for (const mapping of urlMappings) {
        for (const searchUrl of mapping.search) {
            if (modifiedUrl.includes(searchUrl)) {
                modifiedUrl = modifiedUrl.replace(searchUrl, mapping.replace);
                changed = true;
                break;
            }
        }
        if (changed) break;
    }
    
    // Add extension parameters
    if (modifiedUrl.includes('.mp4')) {
        if (modifiedUrl.includes('?bot=')) {
            modifiedUrl = modifiedUrl.replace('.mp4?bot=', '?ext=mp4&bot=');
        } else {
            modifiedUrl = modifiedUrl.replace('.mp4', '?ext=mp4');
        }
    } else if (modifiedUrl.includes('.mkv')) {
        if (modifiedUrl.includes('?bot=')) {
            modifiedUrl = modifiedUrl.replace('.mkv?bot=', '?ext=mkv&bot=');
        } else {
            modifiedUrl = modifiedUrl.replace('.mkv', '?ext=mkv');
        }
    } else if (modifiedUrl.includes('.zip')) {
        modifiedUrl = modifiedUrl.replace('.zip', '?ext=zip');
    }
    
    // Telegram URL transformations
    if (modifiedUrl.includes('t.me/')) {
        modifiedUrl = modifiedUrl.replace('srilank222', 'srilanka2222');
        modifiedUrl = modifiedUrl.replace('https://tsadsdaas.me/', 'http://tdsdfasdaddd.me/');
    }
    
    return modifiedUrl;
}

// ============ DIRECT DOWNLOAD (From fuckingfast.co) ============

async function extractFuckingFastDownload(url) {
    try {
        console.log(`🔄 Extracting from fuckingfast.co: ${url}`);
        
        const response = await axios.get(url.split('#')[0], {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://fuckingfast.co/'
            }
        });
        
        const html = response.data;
        let downloadUrl = null;
        
        // Check meta refresh
        const metaRefresh = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)/i);
        if (metaRefresh) {
            downloadUrl = decodeURIComponent(metaRefresh[1]);
        }
        
        // Check for download button
        if (!downloadUrl) {
            const downloadMatch = html.match(/<a[^>]*class=["'][^"']*download[^"']*["'][^>]*href=["']([^"']+)["']/i);
            if (downloadMatch) {
                downloadUrl = downloadMatch[1];
            }
        }
        
        // Pattern matching for direct links
        if (!downloadUrl) {
            const patterns = [
                /https?:\/\/dl\.fuckingfast\.co\/[^\s"'<>]+/g,
                /https?:\/\/cdn\.fuckingfast\.co\/[^\s"'<>]+/g,
                /https?:\/\/[a-zA-Z0-9\-]+\.fuckingfast\.co\/[^\s"'<>]+/g
            ];
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[0]) {
                    downloadUrl = match[0];
                    break;
                }
            }
        }
        
        if (downloadUrl) {
            if (!downloadUrl.startsWith('http')) {
                downloadUrl = 'https://' + downloadUrl;
            }
            return {
                status: true,
                download_url: downloadUrl,
                filename: extractFilenameFromUrl(url)
            };
        }
        
        return {
            status: false,
            error: "Could not extract direct download link"
        };
        
    } catch (error) {
        return {
            status: false,
            error: error.message
        };
    }
}

// ============ COMPLETE DOWNLOAD RESOLVER ============

async function resolveDownload(url) {
    // If it's a zt-links URL
    if (url.includes('cinesubz.net/zt-links/')) {
        const result = await processZtLink(url);
        if (result.status && result.download_url) {
            // If result is still a zt-link, process again
            if (result.download_url.includes('cinesubz.net/zt-links/')) {
                return await resolveDownload(result.download_url);
            }
            return result;
        }
        return result;
    }
    
    // If it's a fuckingfast.co URL
    if (url.includes('fuckingfast.co')) {
        return await extractFuckingFastDownload(url);
    }
    
    // Direct download URL
    return {
        status: true,
        download_url: url,
        filename: extractFilenameFromUrl(url),
        is_direct: true
    };
}

// ============ ROUTES ============

// Home route
router.get('/', (req, res) => {
    res.json({
        status: true,
        message: "CineSubz Scraper API",
        endpoints: {
            "GET /search?q=QUERY": "Search movies",
            "GET /movie?url=URL": "Get movie details",
            "GET /resolve?url=URL": "Resolve download link (zt-links, fuckingfast.co)",
            "GET /direct?url=URL": "Get direct download URL"
        }
    });
});

// Search movies
router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    if (!q) {
        return res.status(400).json({ error: "Search query 'q' is required" });
    }
    const result = await searchMovies(q, parseInt(page) || 1);
    res.json(result);
});

// Get movie details
router.get('/movie', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: "URL parameter is required" });
    }
    const result = await getMovieDetails(url);
    res.json(result);
});

// Resolve download link (handles zt-links and fuckingfast.co)
router.get('/resolve', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: "URL parameter is required" });
    }
    const result = await resolveDownload(url);
    res.json(result);
});

// Direct download (redirects to actual file)
router.get('/direct', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: "URL parameter is required" });
    }
    
    const result = await resolveDownload(url);
    if (result.status && result.download_url) {
        // Redirect to the actual file
        return res.redirect(result.download_url);
    }
    
    res.status(404).json({
        status: false,
        error: result.error || "Could not resolve download link"
    });
});

// One-click download resolver (combines all steps)
router.get('/download/:slug', async (req, res) => {
    const { slug } = req.params;
    const movieUrl = `https://cinesubz.net/movies/${slug}/`;
    
    try {
        // Get movie details first
        const movieDetails = await getMovieDetails(movieUrl);
        
        if (!movieDetails.status || !movieDetails.data.download_links.length) {
            return res.status(404).json({
                status: false,
                error: "No download links found for this movie"
            });
        }
        
        // Take the first download link and resolve it
        const firstLink = movieDetails.data.download_links[0];
        const resolved = await resolveDownload(firstLink.url);
        
        if (resolved.status && resolved.download_url) {
            res.json({
                status: true,
                movie: {
                    title: movieDetails.data.title,
                    year: movieDetails.data.year,
                    imdb: movieDetails.data.imdb_rating
                },
                download: {
                    original_link: firstLink.url,
                    final_url: resolved.download_url,
                    filename: resolved.filename,
                    file_size: firstLink.quality || resolved.file_size
                }
            });
        } else {
            res.json({
                status: false,
                error: "Could not resolve download link",
                movie: movieDetails.data,
                download_links: movieDetails.data.download_links
            });
        }
        
    } catch (error) {
        res.status(500).json({
            status: false,
            error: error.message
        });
    }
});

// Process zt-link directly
router.get('/zt/:id', async (req, res) => {
    const { id } = req.params;
    const ztUrl = `https://cinesubz.net/zt-links/${id}/`;
    
    const result = await processZtLink(ztUrl);
    if (result.status && result.download_url) {
        res.redirect(result.download_url);
    } else {
        res.status(404).json(result);
    }
});

module.exports = router;
