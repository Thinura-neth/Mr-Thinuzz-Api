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

// ============ EXTRACT CINESUBZ ZT-LINKS PAGE ============
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
        const $ = cheerio.load(html);
        
        let finalUrl = null;
        let finalType = null;
        let isTelegram = false;
        
        // Check for meta refresh redirect
        const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
        if (metaRefresh && metaRefresh.includes('url=')) {
            const match = metaRefresh.match(/url=(.+)$/i);
            if (match) {
                finalUrl = decodeURIComponent(match[1]);
                console.log(`📌 Found meta refresh URL: ${finalUrl}`);
            }
        }
        
        // Extract direct "Click Here" button link
        const clickHereLink = $('.wait-done a').first().attr('href');
        if (clickHereLink && clickHereLink !== '#') {
            finalUrl = clickHereLink;
            finalType = 'direct_click';
            console.log(`📌 Found Click Here link: ${finalUrl}`);
        }
        
        // Check for countdown timer
        const hasCountdown = $('#countdown').length > 0;
        
        // Apply URL replacement logic (based on HTML analysis)
        if (finalUrl && finalUrl.includes('google.com')) {
            const urlMappings = [
                { search: ["https://google.com/server11/1:/", "https://google.com/server12/1:/", "https://google.com/server13/1:/"], replace: "https://bot3.sonic-cloud.online/server1/" },
                { search: ["https://google.com/server21/1:/", "https://google.com/server22/1:/", "https://google.com/server23/1:/"], replace: "https://bot3.sonic-cloud.online/server2/" },
                { search: ["https://google.com/server3/1:/"], replace: "https://bot3.sonic-cloud.online/server3/" },
                { search: ["https://google.com/server4/1:/"], replace: "https://bot3.sonic-cloud.online/server4/" },
                { search: ["https://google.com/server5/1:/"], replace: "https://bot3.sonic-cloud.online/server5/" },
                { search: ["https://google.com/server6/"], replace: "https://bot3.sonic-cloud.online/server6/" }
            ];
            
            let modifiedUrl = finalUrl;
            for (const mapping of urlMappings) {
                for (const searchUrl of mapping.search) {
                    if (modifiedUrl.includes(searchUrl)) {
                        modifiedUrl = modifiedUrl.replace(searchUrl, mapping.replace);
                        // Add extension parameter
                        if (modifiedUrl.includes('.mp4') && !modifiedUrl.includes('?ext=')) {
                            modifiedUrl = modifiedUrl.replace('.mp4', '?ext=mp4');
                        } else if (modifiedUrl.includes('.mkv') && !modifiedUrl.includes('?ext=')) {
                            modifiedUrl = modifiedUrl.replace('.mkv', '?ext=mkv');
                        } else if (modifiedUrl.includes('.zip') && !modifiedUrl.includes('?ext=')) {
                            modifiedUrl = modifiedUrl.replace('.zip', '?ext=zip');
                        }
                        finalUrl = modifiedUrl;
                        finalType = 'replaced_download';
                        console.log(`🔄 URL replaced: ${finalUrl}`);
                        break;
                    }
                }
                if (finalType === 'replaced_download') break;
            }
        }
        
        // Check for Telegram links
        if (finalUrl && finalUrl.includes('t.me')) {
            isTelegram = true;
            finalType = 'telegram';
            // Apply Telegram URL replacements
            let tempUrl = finalUrl;
            tempUrl = tempUrl.replace('srilank222', 'srilanka2222');
            tempUrl = tempUrl.replace('https://tsadsdaas.me/', 'http://tdsdfasdaddd.me/');
            finalUrl = tempUrl;
            console.log(`📌 Telegram link: ${finalUrl}`);
        }
        
        // Extract countdown time from meta refresh
        let redirectTime = 70;
        if (metaRefresh) {
            const timeMatch = metaRefresh.match(/content="(\d+);/i);
            if (timeMatch) {
                redirectTime = parseInt(timeMatch[1]);
            }
        }
        
        // Extract filename from URL
        let filename = null;
        if (finalUrl) {
            filename = extractFilenameFromUrl(finalUrl);
        }
        
        return {
            status: true,
            data: {
                original_url: ztUrl,
                download_url: finalUrl,
                filename: filename,
                is_telegram: isTelegram,
                has_countdown: hasCountdown,
                redirect_time_seconds: redirectTime,
                download_type: finalType || 'extracted'
            }
        };
        
    } catch (error) {
        console.error(`❌ ZT-links extraction error:`, error.message);
        return {
            status: false,
            error: `Failed to extract: ${error.message}`
        };
    }
}

// ============ EXTRACT GOOGLE DRIVE LINK ============
async function extractGoogleDrive(url) {
    try {
        console.log(`📁 Extracting Google Drive link: ${url}`);
        
        // Extract file ID from various Google Drive URL formats
        let fileId = null;
        
        // Pattern 1: /d/{fileId}
        let match = url.match(/\/d\/([^\/?#]+)/);
        if (match) fileId = match[1];
        
        // Pattern 2: id={fileId}
        if (!fileId) {
            match = url.match(/id=([^&?#]+)/);
            if (match) fileId = match[1];
        }
        
        // Pattern 3: /file/d/{fileId}
        if (!fileId) {
            match = url.match(/\/file\/d\/([^\/?#]+)/);
            if (match) fileId = match[1];
        }
        
        if (fileId) {
            const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            return {
                status: true,
                data: {
                    original_url: url,
                    download_url: downloadUrl,
                    file_id: fileId,
                    host: 'drive.google.com',
                    extraction_method: 'google_drive'
                }
            };
        }
        
        return {
            status: false,
            error: "Could not extract Google Drive file ID"
        };
        
    } catch (error) {
        return {
            status: false,
            error: `Google Drive extraction failed: ${error.message}`
        };
    }
}

// ============ EXTRACT TELEGRAM LINK ============
async function extractTelegramLink(url) {
    try {
        console.log(`📱 Processing Telegram link: ${url}`);
        
        // Apply the same replacements as in the HTML
        let processedUrl = url;
        processedUrl = processedUrl.replace('srilank222', 'srilanka2222');
        processedUrl = processedUrl.replace('https://tsadsdaas.me/', 'http://tdsdfasdaddd.me/');
        
        return {
            status: true,
            data: {
                original_url: url,
                telegram_url: processedUrl,
                is_telegram: true,
                note: "Telegram links require manual access or bot interaction"
            }
        };
        
    } catch (error) {
        return {
            status: false,
            error: `Telegram link processing failed: ${error.message}`
        };
    }
}

// ============ CHECK FOR DIRECT FILE LINK ============
function isDirectFileLink(url) {
    const fileExtensions = /\.(mp4|mkv|avi|mov|webm|flv|3gp|m4v|mpg|mpeg|wmv|zip|rar|7z|tar|gz)(\?|$)/i;
    return fileExtensions.test(url);
}

// ============ MAIN DOWNLOAD FUNCTION ============
async function extractDownloadUrl(inputUrl, recursive = true) {
    console.log(`🎯 Starting download extraction for: ${inputUrl}`);
    
    let currentUrl = inputUrl;
    let depth = 0;
    const maxDepth = 3;
    
    while (depth < maxDepth) {
        const hostname = extractHostFromUrl(currentUrl);
        
        // Case 1: Direct file link
        if (isDirectFileLink(currentUrl)) {
            return {
                status: true,
                data: {
                    original_url: inputUrl,
                    download_url: currentUrl,
                    filename: extractFilenameFromUrl(currentUrl),
                    host: hostname,
                    extraction_method: 'direct_file',
                    depth: depth
                }
            };
        }
        
        // Case 2: CineSubz ZT-links page
        if (hostname.includes('cinesubz.net') && currentUrl.includes('/zt-links/')) {
            const result = await extractZtLinks(currentUrl);
            if (result.status && result.data.download_url) {
                // Check if we need to follow another redirect
                const nextHost = extractHostFromUrl(result.data.download_url);
                if (recursive && depth < maxDepth - 1 && 
                    (nextHost.includes('cinesubz.net') || isDirectFileLink(result.data.download_url) === false)) {
                    currentUrl = result.data.download_url;
                    depth++;
                    console.log(`🔁 Following redirect to: ${currentUrl}`);
                    continue;
                }
                return result;
            }
            return result;
        }
        
        // Case 3: Google Drive
        else if (hostname.includes('drive.google.com')) {
            const result = await extractGoogleDrive(currentUrl);
            return result;
        }
        
        // Case 4: Telegram links
        else if (hostname.includes('t.me') || currentUrl.includes('telegram')) {
            const result = await extractTelegramLink(currentUrl);
            return result;
        }
        
        // Case 5: Try to get any download link from the page
        else {
            try {
                const response = await axios.get(currentUrl, {
                    timeout: 30000,
                    maxRedirects: 5,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                const html = response.data;
                const $ = cheerio.load(html);
                
                // Look for downloadable file links
                let foundUrl = null;
                $('a[href*=".mp4"], a[href*=".mkv"], a[href*=".zip"], a[href*=".rar"]').each((i, el) => {
                    const href = $(el).attr('href');
                    if (href && !foundUrl && href.startsWith('http')) {
                        foundUrl = href;
                    }
                });
                
                if (foundUrl && isDirectFileLink(foundUrl)) {
                    return {
                        status: true,
                        data: {
                            original_url: inputUrl,
                            download_url: foundUrl,
                            filename: extractFilenameFromUrl(foundUrl),
                            host: hostname,
                            extraction_method: 'page_scan',
                            depth: depth
                        }
                    };
                }
                
                // Check meta refresh
                const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
                if (metaRefresh && metaRefresh.includes('url=')) {
                    const match = metaRefresh.match(/url=(.+)$/i);
                    if (match && recursive && depth < maxDepth - 1) {
                        currentUrl = decodeURIComponent(match[1]);
                        depth++;
                        console.log(`🔁 Following meta refresh to: ${currentUrl}`);
                        continue;
                    }
                }
            } catch (e) {
                console.log(`Page fetch error: ${e.message}`);
            }
            
            return {
                status: false,
                error: `No download link found for ${hostname}`,
                last_url: currentUrl
            };
        }
    }
    
    return {
        status: false,
        error: `Maximum recursion depth (${maxDepth}) reached`,
        last_url: currentUrl
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

// ============ NEW: EXTRACT DOWNLOAD ENDPOINT ============
router.get('/extract', async (req, res) => {
    const { url, raw } = req.query;
    
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            usage: "/movie/extract?url=https://cinesubz.net/zt-links/...",
            timestamp: new Date().toISOString()
        });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    
    // Validate URL
    if (!decodedUrl.startsWith('http')) {
        return res.status(400).json({
            status: false,
            error: "Invalid URL. Must start with http:// or https://",
            timestamp: new Date().toISOString()
        });
    }
    
    console.log(`📥 Download extraction request: ${decodedUrl}`);
    
    const result = await extractDownloadUrl(decodedUrl, raw !== 'true');
    
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
