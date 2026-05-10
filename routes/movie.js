const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// Helper functions
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

// ============ IMPROVED: EXTRACT CINESUBZ ZT-LINKS PAGE ============
async function extractZtLinks(ztUrl) {
    try {
        console.log(`🔗 Extracting ZT-links from: ${ztUrl}`);
        
        const response = await axios.get(ztUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': 'https://cinesubz.net/'
            }
        });
        
        const html = response.data;
        
        // ============ METHOD 1: Extract direct button link ============
        let finalUrl = null;
        
        // Pattern for "Go to Download Page" button
        const buttonPattern = /<a[^>]*id="link"[^>]*href="([^"]+)"/i;
        const buttonMatch = html.match(buttonPattern);
        if (buttonMatch && buttonMatch[1]) {
            finalUrl = buttonMatch[1];
            console.log(`📌 Found button link: ${finalUrl}`);
        }
        
        // Pattern for any .wait-done a
        if (!finalUrl) {
            const waitDonePattern = /<div[^>]*class="[^"]*wait-done[^"]*"[^>]*>.*?<a[^>]*href="([^"]+)"/si;
            const waitMatch = html.match(waitDonePattern);
            if (waitMatch && waitMatch[1]) {
                finalUrl = waitMatch[1];
                console.log(`📌 Found wait-done link: ${finalUrl}`);
            }
        }
        
        // ============ METHOD 2: Meta refresh URL ============
        let redirectTime = 70;
        const metaPattern = /<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'](\d+);\s*url=([^"']+)/i;
        const metaMatch = html.match(metaPattern);
        if (metaMatch) {
            redirectTime = parseInt(metaMatch[1]) || 70;
            const metaUrl = decodeURIComponent(metaMatch[2]);
            if (!finalUrl) {
                finalUrl = metaUrl;
                console.log(`📌 Found meta refresh URL: ${finalUrl}`);
            }
        }
        
        // ============ METHOD 3: Extract from JavaScript ============
        if (!finalUrl) {
            // Look for Link object (from the HTML)
            const linkVarPattern = /var\s+Link\s*=\s*\{[^}]*"time":"(\d+)"[^}]*"exit":"([^"]*)"[^}]*\}/i;
            const linkMatch = html.match(linkVarPattern);
            if (linkMatch) {
                console.log(`📌 Found Link object with time: ${linkMatch[1]}`);
            }
            
            // Look for any google.com/server links in JavaScript
            const serverPattern = /https:\/\/google\.com\/server\d+[^\s"'<>]*/gi;
            const serverMatches = html.match(serverPattern);
            if (serverMatches && serverMatches.length > 0 && !finalUrl) {
                finalUrl = serverMatches[0];
                console.log(`📌 Found server URL in script: ${finalUrl}`);
            }
        }
        
        // ============ APPLY URL REPLACEMENTS ============
        let isTelegram = false;
        let finalType = 'extracted';
        
        if (finalUrl) {
            // Check for Telegram
            if (finalUrl.includes('t.me')) {
                isTelegram = true;
                finalType = 'telegram';
                // Apply Telegram replacements
                finalUrl = finalUrl.replace('srilank222', 'srilanka2222');
                finalUrl = finalUrl.replace('https://tsadsdaas.me/', 'http://tdsdfasdaddd.me/');
                console.log(`📌 Telegram link processed: ${finalUrl}`);
            }
            
           const urlMappings = [
    { search: "https://google.com/server1/", replace: "https://bot3.sonic-cloud.online/server1/" },
    { search: "https://google.com/server2/", replace: "https://bot3.sonic-cloud.online/server2/" },
    { search: "https://google.com/server3/", replace: "https://bot3.sonic-cloud.online/server3/" },
    { search: "https://google.com/server4/", replace: "https://bot3.sonic-cloud.online/server4/" },
    { search: "https://google.com/server5/", replace: "https://bot3.sonic-cloud.online/server5/" },
    { search: "https://google.com/server6/", replace: "https://bot3.sonic-cloud.online/server6/" }
];
                let modifiedUrl = finalUrl;
                for (const mapping of urlMappings) {
                    if (modifiedUrl.includes(mapping.search)) {
                        modifiedUrl = modifiedUrl.replace(mapping.search, mapping.replace);
                        // Add extension parameter if needed
                        if (modifiedUrl.includes('.mp4') && !modifiedUrl.includes('?ext=')) {
                            modifiedUrl = modifiedUrl.replace('.mp4', '?ext=mp4');
                        } else if (modifiedUrl.includes('.mkv') && !modifiedUrl.includes('?ext=')) {
                            modifiedUrl = modifiedUrl.replace('.mkv', '?ext=mkv');
                        }
                        finalUrl = modifiedUrl;
                        finalType = 'replaced_download';
                        console.log(`🔄 URL replaced: ${finalUrl}`);
                        break;
                    }
                }
            }
            
            // Extract filename
            let filename = null;
            const filenameMatch = finalUrl.match(/\/([^\/?#]+\.(?:mp4|mkv|zip|rar|avi|mov))(?:\?|$)/i);
            if (filenameMatch) {
                filename = decodeURIComponent(filenameMatch[1]);
            } else {
                // Try to get from page title
                const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
                if (titleMatch) {
                    filename = titleMatch[1].replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100) + '.mp4';
                }
            }
            
            return {
                status: true,
                data: {
                    original_url: ztUrl,
                    download_url: finalUrl,
                    filename: filename,
                    is_telegram: isTelegram,
                    has_countdown: true,
                    redirect_time_seconds: redirectTime,
                    download_type: finalType,
                    raw_html_length: html.length
                }
            };
        }
        
        // If we still don't have a URL, try to extract from page content
        const allLinks = html.match(/https?:\/\/[^\s"'<>]+/gi) || [];
        const validLinks = allLinks.filter(link => 
            link.includes('google.com/server') || 
            link.includes('bot3.sonic-cloud.online') ||
            link.includes('t.me')
        );
        
        if (validLinks.length > 0) {
            finalUrl = validLinks[0];
            console.log(`📌 Found link from page scan: ${finalUrl}`);
            
            return {
                status: true,
                data: {
                    original_url: ztUrl,
                    download_url: finalUrl,
                    filename: null,
                    is_telegram: finalUrl.includes('t.me'),
                    has_countdown: true,
                    redirect_time_seconds: redirectTime,
                    download_type: 'page_scan'
                }
            };
        }
        
        return {
            status: false,
            error: "Could not extract download link from ZT-links page",
            raw_html_sample: html.substring(0, 500)
        };
        
    } catch (error) {
        console.error(`❌ ZT-links extraction error:`, error.message);
        return {
            status: false,
            error: `Failed to extract: ${error.message}`
        };
    }
}

// ============ SIMPLIFIED MAIN DOWNLOAD FUNCTION ============
async function extractDownloadUrl(inputUrl) {
    console.log(`🎯 Starting download extraction for: ${inputUrl}`);
    
    const hostname = extractHostFromUrl(inputUrl);
    
    // Only handle CineSubz ZT-links pages
    if (hostname.includes('cinesubz.net') && inputUrl.includes('/zt-links/')) {
        return await extractZtLinks(inputUrl);
    }
    
    return {
        status: false,
        error: `Only CineSubz ZT-links URLs are supported. Received: ${hostname}`
    };
}

// Search movies on CineSubz
async function searchMovies(query, page = 1) {
    try {
        console.log(`🔍 Searching CineSubz for: ${query} (Page: ${page})`);
        
        const searchUrl = `https://cinesubz.net/page/${page}/?s=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        
        const $ = cheerio.load(response.data);
        const results = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            
            let title = $item.find('.item-desc-title h3, .item-title, .item-data h3').text().trim();
            let url = $item.find('a').first().attr('href');
            let poster = $item.find('.thumb').attr('data-original') || $item.find('.thumb').attr('src');
            let imdbRating = $item.find('.imdb-rating-badge .imdb-score').text().trim();
            let quality = $item.find('.badge-quality-corner').text().trim();
            
            if (!title) title = $item.find('a[title]').attr('title');
            
            if (title && url && url.includes('/movies/')) {
                results.push({
                    title: cleanText(title),
                    slug: extractMovieId(url),
                    url: url,
                    poster: poster || null,
                    imdb_rating: imdbRating || null,
                    quality: quality || null,
                    language: 'Sinhala Subtitles'
                });
            }
        });
        
        // Get pagination info
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
        
        const hasNextPage = page < totalPages;
        
        const uniqueResults = [];
        const seenUrls = new Set();
        for (const result of results) {
            if (!seenUrls.has(result.url)) {
                seenUrls.add(result.url);
                uniqueResults.push(result);
            }
        }
        
        return {
            status: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                query: query,
                page: page,
                total_pages: totalPages,
                has_next_page: hasNextPage,
                total_results: uniqueResults.length,
                results: uniqueResults.slice(0, 50)
            }
        };
        
    } catch (error) {
        console.error(`❌ Search error:`, error.message);
        return {
            status: false,
            error: `Search failed: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// Get recent movies
async function getRecentMovies(page = 1) {
    try {
        console.log(`📺 Fetching recent movies from CineSubz (Page: ${page})`);
        
        const url = page === 1 
            ? 'https://cinesubz.net/movies/'
            : `https://cinesubz.net/movies/page/${page}/`;
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        
        const $ = cheerio.load(response.data);
        const movies = [];
        
        $('.display-item, .module-item, .item-box').each((i, element) => {
            const $item = $(element);
            
            let title = $item.find('.item-desc-title h3, .item-title').text().trim();
            let url = $item.find('a').first().attr('href');
            let poster = $item.find('.thumb').attr('data-original') || $item.find('.thumb').attr('src');
            let imdbRating = $item.find('.imdb-rating-badge .imdb-score').text().trim();
            let quality = $item.find('.badge-quality-corner').text().trim();
            
            if (!title) title = $item.find('a[title]').attr('title');
            
            if (title && url && url.includes('/movies/')) {
                movies.push({
                    title: cleanText(title),
                    slug: extractMovieId(url),
                    url: url,
                    poster: poster || null,
                    imdb_rating: imdbRating || null,
                    quality: quality || null,
                    language: 'Sinhala Subtitles'
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
            status: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                page: page,
                total_pages: totalPages,
                has_next_page: page < totalPages,
                total_movies: movies.length,
                movies: movies
            }
        };
        
    } catch (error) {
        console.error(`❌ Error fetching recent movies:`, error.message);
        return {
            status: false,
            error: `Failed to fetch: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// Get movie details
async function getMovieDetails(url) {
    try {
        console.log(`🎬 Fetching movie details: ${url}`);
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Title
        let title = $('.details-title h3').first().text().trim();
        if (!title) title = $('title').text().replace(' – CineSubz.lk - Sinhala Subtitles', '').replace(' | සිංහල උපසිරැසි සමඟ', '').trim();
        
        // Poster
        let poster = $('.content-poster .poster-img').attr('src');
        if (!poster) poster = $('.poster-img').attr('src');
        if (poster && !poster.startsWith('http')) poster = 'https://cinesubz.net' + poster;
        
        // Backdrop images
        const backdropImages = [];
        $('.content-gall .gall-item a').each((i, el) => {
            const imgUrl = $(el).attr('href');
            if (imgUrl && imgUrl.startsWith('http')) {
                backdropImages.push(imgUrl);
            }
        });
        
        // IMDb Rating
        let imdbRating = null;
        let imdbVotes = null;
        const imdbElement = $('.data-imdb.v2');
        if (imdbElement.length) {
            const imdbText = imdbElement.text().trim();
            const ratingMatch = imdbText.match(/IMDb:\s*([\d.]+)/i);
            const votesMatch = imdbText.match(/\(([\d.]+K?)\)/i);
            if (ratingMatch) imdbRating = ratingMatch[1];
            if (votesMatch) imdbVotes = votesMatch[1];
        }
        
        // Quality
        let quality = $('.data-quality').first().text().trim();
        if (!quality) quality = $('.badge-quality-corner').first().text().trim();
        
        // Runtime
        let runtime = null;
        const durationElement = $('.data-views[itemprop="duration"]');
        if (durationElement.length) {
            runtime = durationElement.text().trim();
        }
        
        // Year
        let year = null;
        $('.info-col p, .details-info p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Year:')) {
                const yearMatch = text.match(/Year:\s*(\d{4})/i);
                if (yearMatch) year = yearMatch[1];
            }
        });
        
        // Country
        let country = null;
        $('.info-col p, .details-info p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Country:')) {
                country = text.replace('Country:', '').trim();
            }
        });
        
        // Directors
        const directors = [];
        $('.info-col p strong:contains("Director:")').each((i, el) => {
            $(el).parent().find('a').each((j, a) => {
                directors.push($(a).text().trim());
            });
        });
        
        // Subtitle By
        let subtitleBy = null;
        $('.info-col p').each((i, el) => {
            const text = $(el).text();
            if (text.includes('Subtitle By:')) {
                subtitleBy = text.replace('Subtitle By:', '').trim();
            }
        });
        
        // Genres
        const genres = [];
        $('.details-genre a').each((i, el) => {
            const genre = $(el).text().trim();
            if (genre && genre.length < 50 && !genres.includes(genre)) {
                genres.push(genre);
            }
        });
        
        // Cast
        const cast = [];
        $('.zt-cast-card').each((i, el) => {
            const $card = $(el);
            const name = $card.find('.zt-cast-name').text().trim();
            const role = $card.find('.zt-cast-role').text().trim();
            const image = $card.find('.zt-cast-image img').attr('src');
            const castUrl = $card.find('.zt-cast-link').attr('href');
            
            if (name) {
                cast.push({
                    name: name,
                    role: role || null,
                    image: image || null,
                    url: castUrl ? 'https://cinesubz.net' + castUrl : null
                });
            }
        });
        
        // Description
        let description = '';
        $('.details-desc p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 5000 && !text.includes('Button එක ඔබලා')) {
                description = text;
                return false;
            }
        });
        
        // Tagline
        let tagline = null;
        const taglineElement = $('.movie-tagline-box .tagline-text');
        if (taglineElement.length) {
            tagline = taglineElement.text().trim();
        }
        
        // Download Links
        const downloadLinks = [];
        
        $('.movie-download-button').each((i, el) => {
            const href = $(el).attr('href');
            const type = $(el).find('.movie-download-type').text().trim();
            const meta = $(el).find('.movie-download-meta').text().trim();
            
            if (href && href.startsWith('https://cinesubz.net/zt-links/')) {
                downloadLinks.push({
                    url: href,
                    type: type || 'Direct & Telegram Download',
                    meta: meta || null,
                    host: 'cinesubz.net'
                });
            }
        });
        
        $('.link-directandtgdownload .movie-download-link-item a').each((i, el) => {
            const href = $(el).attr('href');
            const meta = $(el).find('.movie-download-meta').text().trim();
            
            if (href && href.startsWith('https://cinesubz.net/zt-links/')) {
                const exists = downloadLinks.some(link => link.url === href);
                if (!exists) {
                    downloadLinks.push({
                        url: href,
                        type: 'Direct & Telegram Download',
                        meta: meta || null,
                        host: 'cinesubz.net'
                    });
                }
            }
        });
        
        $('.links-table tbody tr td a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && (href.includes('http') || href.includes('magnet')) && !href.includes('cinesubz.net/zt-links/')) {
                const text = $(el).text().trim();
                downloadLinks.push({
                    url: href,
                    type: text || 'Download Link',
                    meta: null,
                    host: extractHostFromUrl(href)
                });
            }
        });
        
        // Players
        const players = [];
        $('.play-lists li.zetaflix_player_option').each((i, el) => {
            const serverName = $(el).find('.opt-name').text().trim();
            const serverTitle = $(el).find('.opt-titl').text().trim();
            const isTrailer = $(el).attr('id') === 'player-option-trailer';
            
            players.push({
                name: serverName || 'Server',
                title: serverTitle || null,
                is_trailer: isTrailer
            });
        });
        
        // Similar Movies
        const similarMovies = [];
        $('.similar-item, .related-item').each((i, el) => {
            const $item = $(el);
            const similarTitle = $item.find('.item-data h3, .data-title').text().trim();
            const movieUrl = $item.find('.item-url, a').first().attr('href');
            const similarPoster = $item.find('img').first().attr('src');
            
            if (similarTitle && movieUrl && movieUrl.includes('/movies/')) {
                similarMovies.push({
                    title: similarTitle,
                    slug: extractMovieId(movieUrl),
                    url: movieUrl,
                    poster: similarPoster || null
                });
            }
        });
        
        // SEO
        const seo = {
            canonical: $('link[rel="canonical"]').attr('href') || url,
            og_image: $('meta[property="og:image"]').attr('content') || poster,
            meta_description: $('meta[name="description"]').attr('content') || (description ? description.substring(0, 200) : null)
        };
        
        // Keywords
        const keywords = [];
        $('.data-keywords-inline a, .content-keywords a').each((i, el) => {
            const keyword = $(el).text().trim();
            if (keyword && !keywords.includes(keyword)) {
                keywords.push(keyword);
            }
        });
        
        // Clean title
        const cleanTitle = title.replace(' Sinhala Subtitles | සිංහල උපසිරැසි සමඟ', '').trim();
        
        // Remove duplicate download links
        const uniqueDownloads = [];
        const seenUrls = new Set();
        for (const link of downloadLinks) {
            if (!seenUrls.has(link.url)) {
                seenUrls.add(link.url);
                uniqueDownloads.push(link);
            }
        }
        
        return {
            status: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                title: cleanTitle,
                original_title: title,
                slug: extractMovieId(url),
                url: url,
                poster: poster,
                backdrop_images: backdropImages,
                tagline: tagline,
                description: description,
                imdb_rating: imdbRating,
                imdb_votes: imdbVotes,
                quality: quality,
                runtime: runtime,
                year: year,
                country: country,
                directors: directors,
                subtitle_by: subtitleBy,
                genres: genres,
                cast: cast,
                keywords: keywords,
                download_links: uniqueDownloads,
                players: players,
                similar_movies: similarMovies,
                seo: seo
            }
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
        message: "🎬 CineSubz Movie Search API - Real-time Scraper",
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString(),
        endpoints: {
            "GET /movie/search?q=SEARCH": "Search movies on CineSubz",
            "GET /movie/recent": "Get recently added movies",
            "GET /movie/info?url=URL": "Get movie details with download links",
            "GET /movie/extract?url=URL": "Extract direct download link from ZT-links",
            "GET /movie/popular": "Get popular movies"
        },
        examples: {
            search: "/movie/search?q=oppenheimer",
            recent: "/movie/recent",
            info: "/movie/info?url=https://cinesubz.net/movies/oppenheimer-2023-sinhala-subtitles/",
            extract: "/movie/extract?url=https://cinesubz.net/zt-links/12345/"
        }
    });
});

router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    if (!q) {
        return res.status(400).json({
            status: false,
            error: "Search query parameter 'q' is required",
            timestamp: new Date().toISOString()
        });
    }
    const searchTerm = decodeURIComponent(q);
    const pageNum = parseInt(page) || 1;
    const result = await searchMovies(searchTerm, pageNum);
    res.json(result);
});

router.get('/recent', async (req, res) => {
    const { page } = req.query;
    const pageNum = parseInt(page) || 1;
    const result = await getRecentMovies(pageNum);
    res.json(result);
});

router.get('/info', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            timestamp: new Date().toISOString()
        });
    }
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    if (!decodedUrl.includes('cinesubz.net') && !decodedUrl.includes('cinesubz.lk')) {
        return res.status(400).json({
            status: false,
            error: "Only cinesubz.net or cinesubz.lk URLs are allowed",
            timestamp: new Date().toISOString()
        });
    }
    const result = await getMovieDetails(decodedUrl);
    res.json(result);
});

// ============ EXTRACT DOWNLOAD ENDPOINT (FIXED) ============
router.get('/extract', async (req, res) => {
    const { url } = req.query;
    
    // Check if URL parameter exists
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            usage: "/movie/extract?url=https://cinesubz.net/zt-links/xxxxx/",
            example: "https://mr-thinuzz-api.vercel.app/movie/extract?url=https://cinesubz.net/zt-links/niavvuv2re/",
            timestamp: new Date().toISOString()
        });
    }
    
    // Decode URL
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    
    // Validate URL format
    if (!decodedUrl.startsWith('http')) {
        return res.status(400).json({
            status: false,
            error: "Invalid URL format. Must start with http:// or https://",
            provided: decodedUrl,
            timestamp: new Date().toISOString()
        });
    }
    
    // Validate it's a CineSubz ZT-links page
    if (!decodedUrl.includes('cinesubz.net') || !decodedUrl.includes('/zt-links/')) {
        return res.status(400).json({
            status: false,
            error: "URL must be a CineSubz ZT-links page",
            required_format: "https://cinesubz.net/zt-links/[id]/",
            provided: decodedUrl,
            timestamp: new Date().toISOString()
        });
    }
    
    console.log(`📥 Download extraction request: ${decodedUrl}`);
    
    // Call the extraction function
    const result = await extractDownloadUrl(decodedUrl);
    
    if (result.status) {
        res.json({
            status: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: result.data
        });
    } else {
        res.status(404).json({
            status: false,
            error: result.error,
            original_url: decodedUrl,
            debug_info: result.raw_html_sample || null,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/popular', async (req, res) => {
    const result = await getRecentMovies(1);
    if (result.status) {
        result.data.type = "popular";
        result.data.message = "Popular movies from CineSubz";
    }
    res.json(result);
});

module.exports = router;
