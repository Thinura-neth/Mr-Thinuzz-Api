const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// Helper: Extract filename from URL
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
        return "unknown_file.rar";
    } catch (e) {
        return "unknown_file.rar";
    }
}

// Extract fuckingfast.co direct download link
async function extractFuckingFastDownload(url) {
    try {
        console.log(`🔄 Extracting download from: ${url}`);
        
        let cleanUrl = url.split('#')[0];
        
        const response = await axios.get(cleanUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://fuckingfast.co/'
            }
        });
        
        const html = response.data;
        const $ = cheerio.load(html);
        let downloadUrl = null;
        
        // Method 1: Meta refresh
        const metaRefresh = $('meta[http-equiv="refresh"]').attr('content');
        if (metaRefresh && metaRefresh.includes('url=')) {
            const match = metaRefresh.match(/url=(.+)$/i);
            if (match) downloadUrl = decodeURIComponent(match[1]);
        }
        
        // Method 2: Download button
        if (!downloadUrl) {
            const downloadBtn = $('a[class*="download"], a[id*="download"], .download-btn, .btn-download');
            if (downloadBtn.length) {
                downloadUrl = downloadBtn.first().attr('href');
            }
        }
        
        // Method 3: JavaScript redirects
        if (!downloadUrl) {
            const scripts = $('script').toArray();
            for (const script of scripts) {
                const content = $(script).html();
                if (content) {
                    const match = content.match(/(?:https?:\/\/)?(?:dl\.fuckingfast\.co|cdn\.fuckingfast\.co)\/[^\s'"]+/);
                    if (match) {
                        downloadUrl = match[0];
                        break;
                    }
                }
            }
        }
        
        // Method 4: Direct dl.fuckingfast.co links
        if (!downloadUrl) {
            const dlLink = $('a[href*="dl.fuckingfast.co"]').attr('href');
            if (dlLink) downloadUrl = dlLink;
        }
        
        // Method 5: Pattern matching
        if (!downloadUrl) {
            const patterns = [
                /https?:\/\/dl\.fuckingfast\.co\/[^\s"'<>]+/g,
                /https?:\/\/cdn\.fuckingfast\.co\/[^\s"'<>]+/g
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
                author: "Mr Thinuzz",
                timestamp: new Date().toISOString(),
                data: {
                    original_url: url,
                    download_url: downloadUrl,
                    filename: extractFilenameFromUrl(url)
                }
            };
        }
        
        return {
            status: false,
            error: "Could not extract direct download link. Please visit the URL in browser.",
            timestamp: new Date().toISOString(),
            data: { original_url: url }
        };
        
    } catch (error) {
        console.error(`❌ Extraction error:`, error.message);
        return {
            status: false,
            error: `Failed to extract: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// Search function for FitGirl Repacks
async function searchFitGirl(query) {
    try {
        console.log(`🔍 Searching FitGirl for: ${query}`);
        
        const searchUrl = `https://fitgirl-repacks.site/?s=${encodeURIComponent(query)}`;
        
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
        
        // Extract search results
        $('article, .post, .hentry, .search-result, .entry').each((i, element) => {
            let titleElement = $(element).find('h1 a, h2 a, h3 a, .entry-title a, .post-title a');
            let title = titleElement.first().text().trim();
            let url = titleElement.first().attr('href');
            
            if (!title) {
                titleElement = $(element).find('a[rel="bookmark"]');
                title = titleElement.first().text().trim();
                url = titleElement.first().attr('href');
            }
            
            if (title && url && url.includes('fitgirl-repacks.site')) {
                title = title.replace(/\s+/g, ' ').trim();
                const isDuplicate = results.some(r => r.url === url);
                if (!isDuplicate && title.length > 3 && title.length < 300) {
                    results.push({ title, url });
                }
            }
        });
        
        // Alternative extraction method
        if (results.length === 0) {
            $('.main, #main, .content').find('a').each((i, element) => {
                const href = $(element).attr('href');
                const text = $(element).text().trim();
                
                if (href && text && href.includes('fitgirl-repacks.site') && 
                    !href.includes('/page/') && !href.includes('/category/') &&
                    text.length > 5 && text.length < 300) {
                    
                    const isDuplicate = results.some(r => r.url === href);
                    if (!isDuplicate) {
                        results.push({
                            title: text.replace(/\s+/g, ' ').trim(),
                            url: href
                        });
                    }
                }
            });
        }
        
        // Remove duplicates
        const uniqueResults = [];
        const seenUrls = new Set();
        for (const result of results) {
            if (!seenUrls.has(result.url)) {
                seenUrls.add(result.url);
                uniqueResults.push(result);
            }
        }
        
        const finalResults = uniqueResults.slice(0, 50);
        
        return {
            status: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                query: query,
                total_results: finalResults.length,
                results: finalResults
            }
        };
        
    } catch (error) {
        console.error(`❌ Search error:`, error.message);
        return {
            status: false,
            error: `Search failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            author: "Mr Thinuzz"
        };
    }
}

// Main scraping function for FitGirl
async function scrapeFitGirl(url) {
    try {
        console.log(`🔄 Scraping: ${url}`);
        
        const { data } = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        
        const $ = cheerio.load(data);
        
        // Extract Title
        let title = $('article h1.entry-title').text().trim();
        if (!title) title = $('h1.entry-title').text().trim();
        if (!title) title = $('h1').first().text().trim();
        
        // Extract Image
        let image = $('.entry-content img').first().attr('src');
        if (!image) image = $('img.aligncenter').first().attr('src');
        if (!image) image = $('img').first().attr('src');
        
        // Extract Info Table
        const info = {};
        $('.entry-content table tr, .entry-content tbody tr').each((i, row) => {
            const th = $(row).find('th').text().trim();
            const td = $(row).find('td').text().trim();
            if (th && td) {
                info[th] = td.replace(/\s+/g, ' ').trim();
            }
        });
        
        // Fallback info extraction
        if (Object.keys(info).length === 0) {
            const pageText = $('.entry-content').text();
            const patterns = {
                'Genres/Tags': /Genres\/Tags:\s*([^\n]+)/i,
                'Companies': /Companies:\s*([^\n]+)/i,
                'Languages': /Languages:\s*([^\n]+)/i,
                'Original Size': /Original Size:\s*([^\n]+)/i,
                'Repack Size': /Repack Size:\s*([^\n]+)/i
            };
            for (const [key, regex] of Object.entries(patterns)) {
                const match = pageText.match(regex);
                if (match) info[key] = match[1].trim();
            }
        }
        
        // Extract Repack Features
        const repack = [];
        $('.entry-content ul li, .entry-content ol li').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 5 && text.length < 500) {
                repack.push(text);
            }
        });
        
        if (repack.length === 0) {
            $('.entry-content p').each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 20 && text.length < 800) {
                    repack.push(text);
                }
            });
        }
        
        // Extract Download Links
        const downloadLinks = {
            direct_links: [],
            torrent_links: [],
            multiupload_links: [],
            other_links: []
        };
        
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            
            if (!href) return;
            
            if (href.includes('fuckingfast.co')) {
                downloadLinks.direct_links.push({
                    host: 'fuckingfast.co',
                    url: href,
                    filename: extractFilenameFromUrl(href),
                    type: 'direct'
                });
            }
            else if (href.includes('qiwi.gg')) {
                downloadLinks.direct_links.push({ host: 'qiwi.gg', url: href, type: 'direct' });
            }
            else if (href.includes('pixeldrain.com')) {
                downloadLinks.direct_links.push({ host: 'pixeldrain.com', url: href, type: 'direct' });
            }
            else if (href.includes('gofile.io')) {
                downloadLinks.direct_links.push({ host: 'gofile.io', url: href, type: 'direct' });
            }
            else if (href.includes('1337x.to')) {
                downloadLinks.torrent_links.push({ source: '1337x', url: href, type: 'torrent_page' });
            }
            else if (href.includes('RuTor') || href.includes('rutor')) {
                downloadLinks.torrent_links.push({ source: 'RuTor', url: href, type: 'torrent_page' });
            }
            else if (href.startsWith('magnet:')) {
                downloadLinks.torrent_links.push({ source: 'Magnet', url: href, type: 'magnet_link' });
            }
            else if (href.includes('multiup') || text.includes('MultiUpload')) {
                downloadLinks.multiupload_links.push({ url: href, text: text || 'MultiUpload Link' });
            }
        });
        
        // Remove duplicates
        const uniqueDirect = [];
        const directUrls = new Set();
        for (const link of downloadLinks.direct_links) {
            if (!directUrls.has(link.url)) {
                directUrls.add(link.url);
                uniqueDirect.push(link);
            }
        }
        downloadLinks.direct_links = uniqueDirect;
        
        const uniqueRepack = [...new Set(repack)].filter(r => r && r.length > 10);
        
        return {
            status: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                title: title || "Title not found",
                image: image || "",
                game_info: info,
                repack_features: uniqueRepack.slice(0, 50),
                downloads: downloadLinks,
                page_url: url
            }
        };
        
    } catch (error) {
        console.error(`❌ Scraping error:`, error.message);
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
        message: "🎮 Mr Thinuzz Game API - Real-time",
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString(),
        endpoints: {
            "GET /game/fitgirl-search?q=SEARCH": "Search games on FitGirl",
            "GET /game/fitgirl-info?url=URL": "Get complete game info with download links",
            "GET /game/fitgirl-download?url=URL": "Extract direct download link"
        },
        examples: {
            search: "/game/fitgirl-search?q=cyberpunk",
            info: "/game/fitgirl-info?url=https://fitgirl-repacks.site/cyberpunk-2077/",
            download: "/game/fitgirl-download?url=https://fuckingfast.co/..."
        }
    });
});

router.get('/fitgirl-search', async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({
            status: false,
            error: "Search query parameter 'q' is required",
            timestamp: new Date().toISOString(),
            usage: "/game/fitgirl-search?q=YOUR_SEARCH_TERM",
            example: "/game/fitgirl-search?q=gta%20v"
        });
    }
    
    const searchTerm = decodeURIComponent(q);
    const result = await searchFitGirl(searchTerm);
    res.json(result);
});

router.get('/fitgirl-info', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            timestamp: new Date().toISOString(),
            usage: "/game/fitgirl-info?url=GAME_URL",
            example: "/game/fitgirl-info?url=https://fitgirl-repacks.site/cyberpunk-2077/"
        });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    
    if (!decodedUrl.includes('fitgirl-repacks.site')) {
        return res.status(400).json({
            status: false,
            error: "Only fitgirl-repacks.site URLs are allowed",
            timestamp: new Date().toISOString()
        });
    }
    
    const result = await scrapeFitGirl(decodedUrl);
    res.json(result);
});

router.get('/fitgirl-download', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            timestamp: new Date().toISOString(),
            usage: "/game/fitgirl-download?url=FUCKINGFAST_URL",
            example: "/game/fitgirl-download?url=https://fuckingfast.co/..."
        });
    }
    
    let decodedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
    } catch (e) {
        decodedUrl = url;
    }
    
    if (!decodedUrl.includes('fuckingfast.co')) {
        return res.status(400).json({
            status: false,
            error: "Only fuckingfast.co URLs are supported",
            timestamp: new Date().toISOString()
        });
    }
    
    const result = await extractFuckingFastDownload(decodedUrl);
    res.json(result);
});

module.exports = router;
