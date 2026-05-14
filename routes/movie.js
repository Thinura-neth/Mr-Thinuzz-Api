const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const cheerio = require('cheerio');
const router = express.Router();

// Cache (TTL: 1 hour)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

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

// ============ SCRAPE MOVIE INFO (Corrected) ============
async function scrapeMovieInfo(movieUrl) {
    const cacheKey = `info_${movieUrl}`;
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
        let title = $('h1.entry-title, .movie-title, .title').first().text().trim();
        if (!title) title = $('title').text().replace(' - CineSubz', '').trim();

        // ----- Poster -----
        let poster = $('.movie-poster img, .featured-image img, .poster img').first().attr('src');
        if (!poster) poster = $('img.wp-post-image').first().attr('src');

        // ----- Description -----
        let description = $('.movie-description, .entry-content p, .description').first().text().trim();
        // If too short, try the content div
        if (description.length < 50) {
            description = $('.entry-content').first().text().trim();
        }

        // ----- Release Year (from the table) -----
        let releaseYear = null;
        $('table, .release-year').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Release year') || text.includes('Year')) {
                // Look for a year (4 digits) in the next cell/row
                const yearMatch = text.match(/\b(19|20)\d{2}\b/);
                if (yearMatch) releaseYear = yearMatch[0];
            }
        });
        // Alternative: find "Release year" heading and get adjacent value
        if (!releaseYear) {
            $('th, strong, b').each((i, el) => {
                if ($(el).text().includes('Release year')) {
                    const parent = $(el).closest('tr, div');
                    releaseYear = parent.find('td, span').first().text().match(/\b(19|20)\d{2}\b/)?.[0] || null;
                }
            });
        }

        // ----- Download Links (Direct & Telegram) -----
        const downloadLinks = [];
        // Look for sections containing "Direct & Telegram Download Links"
        $('h2, h3, strong, b').each((i, el) => {
            const heading = $(el).text();
            if (heading.includes('Direct & Telegram Download Links')) {
                // Get sibling or parent container that holds the links
                let container = $(el).nextUntil('h2, h3, hr');
                if (container.length === 0) container = $(el).closest('div').find('ul, p');
                
                container.each((j, elem) => {
                    const text = $(elem).text();
                    // Extract quality (480p, 720p, 1080p) and size
                    const qualityMatch = text.match(/(\d{3,4}p)/i);
                    const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
                    let linkUrl = null;
                    // Find actual anchor tag inside this element
                    const anchor = $(elem).find('a').first();
                    if (anchor.length) linkUrl = anchor.attr('href');
                    
                    if (qualityMatch) {
                        downloadLinks.push({
                            quality: qualityMatch[1].toLowerCase(),
                            size: sizeMatch ? sizeMatch[0] : null,
                            url: linkUrl,
                            source: heading.includes('Telegram') ? 'Telegram' : 'Direct'
                        });
                    }
                });
            }
        });

        // Fallback: scan entire page for any links with quality text
        if (downloadLinks.length === 0) {
            $('a').each((i, el) => {
                const linkText = $(el).text();
                const href = $(el).attr('href');
                if (href && (linkText.match(/\d{3,4}p/i) || linkText.match(/480p|720p|1080p/i))) {
                    const qualityMatch = linkText.match(/(\d{3,4}p)/i);
                    const sizeMatch = linkText.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
                    downloadLinks.push({
                        quality: qualityMatch ? qualityMatch[1].toLowerCase() : 'unknown',
                        size: sizeMatch ? sizeMatch[0] : null,
                        url: href,
                        source: href.includes('t.me') ? 'Telegram' : 'Direct'
                    });
                }
            });
        }

        // Remove duplicates by quality
        const uniqueLinks = [];
        const seenQualities = new Set();
        for (const link of downloadLinks) {
            if (!seenQualities.has(link.quality)) {
                seenQualities.add(link.quality);
                uniqueLinks.push(link);
            }
        }

        // ----- Genres & Cast (if available) -----
        const genres = [];
        $('.genres a, .genre-list a').each((i, el) => {
            const g = $(el).text().trim();
            if (g) genres.push(g);
        });
        const cast = [];
        $('.cast a, .actors-list a').each((i, el) => {
            const a = $(el).text().trim();
            if (a) cast.push(a);
        });

        const result = {
            status: true,
            data: {
                url: movieUrl,
                title: cleanText(title),
                poster: poster || null,
                description: cleanText(description),
                release_year: releaseYear,
                genres,
                cast,
                download_links: uniqueLinks,
                embed_links: [], // No embed links in this page
                source: "Scraped from CineSubz (corrected)",
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

// ============ SEARCH & RECENT (unchanged, but included for completeness) ============
async function searchMovies(query, pageNum = 1) {
    try {
        const searchUrl = `https://cinesubz.lk/page/${pageNum}/?s=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        const results = [];
        $('.display-item, .module-item, .item-box').each((i, el) => {
            const title = $(el).find('.item-desc-title h3, .item-title').first().text().trim();
            const movieUrl = $(el).find('a').first().attr('href');
            const poster = $(el).find('img').first().attr('src');
            if (title && movieUrl && movieUrl.includes('/movies/')) {
                results.push({
                    title: cleanText(title),
                    slug: extractMovieId(movieUrl),
                    url: movieUrl,
                    poster: poster || null
                });
            }
        });
        return { success: true, data: { query, page: pageNum, results: results.slice(0, 50) } };
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
        $('.display-item, .module-item, .item-box').each((i, el) => {
            const title = $(el).find('.item-desc-title h3, .item-title').first().text().trim();
            const movieUrl = $(el).find('a').first().attr('href');
            const poster = $(el).find('img').first().attr('src');
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
        message: "🎬 CineSubz Movie API - Web Scraping (No API Key)",
        author: "Mr Thinuzz",
        version: "6.0.0",
        endpoints: {
            "GET /info?q=URL": "Get movie details (scraped)",
            "GET /search?q=QUERY&page=1": "Search movies",
            "GET /recent?page=1": "Recently added movies"
        },
        examples: {
            info: "/info?q=https://cinesubz.lk/movies/kiss-of-the-spider-woman-2025-sinhala-subtitles/",
            search: "/search?q=spider",
            recent: "/recent"
        }
    });
});

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

router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    if (!q) return res.status(400).json({ success: false, error: "Missing 'q' parameter" });
    const result = await searchMovies(q, parseInt(page) || 1);
    res.json(result);
});

router.get('/recent', async (req, res) => {
    const result = await getRecentMovies(parseInt(req.query.page) || 1);
    res.json(result);
});

module.exports = router;
