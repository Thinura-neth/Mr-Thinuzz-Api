// routes/aone.js - Mr Thinuzz API (AoneRoom Downloader Plugin)
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Cache (TTL: 30 minutes)
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });

// ============ CONSTANTS ============
// Inspect එකෙන් ගත්ත අලුත්ම x-user එක අනිවාර්යයෙන්ම මෙතනට දාන්න
const X_USER = '{"appType":3}';

const commonHeaders = {
    'authority': 'h5-api.aoneroom.com',
    'accept': 'application/json, text/plain, */*',
    'origin': 'https://videodownloader.site',
    'referer': 'https://videodownloader.site/',
    'x-client-info': '{"version":"1.0.0","platform":"web"}',
    'x-user': X_USER,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

// Helper: clean text
function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

// Helper: format file size
function formatSize(bytes) {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

// ============ SEARCH MOVIES ============
async function searchAoneMovies(query, pageNum = 1) {
    const cacheKey = `aone_search_${query}_${pageNum}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.post('https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/search', {
            keyword: query,
            page: pageNum,
            pageSize: 24
        }, { headers: commonHeaders, timeout: 30000 });

        const items = response.data?.data?.items || [];
        
        const results = items.map(item => ({
            title: cleanText(item.title),
            path: item.detailPath,
            poster: item.url || null,
            year: item.releasedDate || null,
            type: item.type || 'movie'
        }));

        const result = {
            success: true,
            data: {
                query: query,
                page: pageNum,
                total: results.length,
                results: results
            },
            source: "AoneRoom",
            scraped_at: new Date().toISOString()
        };

        cache.set(cacheKey, result);
        return result;

    } catch (error) {
        console.error(`Aone Search Error: ${error.message}`);
        return {
            success: false,
            error: error.message,
            source: "AoneRoom"
        };
    }
}

// ============ GET MOVIE INFO WITH DOWNLOAD LINKS ============
async function getAoneMovieInfo(detailPath) {
    const cacheKey = `aone_info_${detailPath}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        // Step 1: Get Movie Details
        const detailUrl = `https://h5-api.aoneroom.com/wefeed-h5api-bff/detail?detailPath=${detailPath}`;
        const detailRes = await axios.get(detailUrl, { headers: commonHeaders, timeout: 30000 });
        
        const movieData = detailRes.data?.data?.subject;

        if (!movieData || !movieData.subjectId) {
            return {
                success: false,
                error: "Movie ID not found",
                debug: detailRes.data
            };
        }

        // Step 2: Get Download Links
        const dlUrl = `https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/download`;
        const dlRes = await axios.get(dlUrl, {
            params: {
                subjectId: movieData.subjectId,
                se: 0,
                ep: 0,
                detailPath: detailPath
            },
            headers: {
                ...commonHeaders,
                'referer': `https://videodownloader.site/detail/${detailPath}`
            },
            timeout: 30000
        });

        const links = dlRes.data?.data?.list || [];

        // Process genres
        let genres = [];
        if (movieData.genre) {
            if (Array.isArray(movieData.genre)) {
                genres = movieData.genre;
            } else if (typeof movieData.genre === 'string') {
                genres = movieData.genre.split(/[,|/]/).map(g => g.trim());
            }
        }

        // Process download links
        const downloadLinks = links.map(link => ({
            quality: link.name || "Unknown",
            size: link.size ? formatSize(parseInt(link.size)) : "Unknown",
            raw_size: link.size || null,
            url: link.url || null,
            format: link.format || "mp4"
        }));

        const result = {
            success: true,
            data: {
                title: cleanText(movieData.title),
                original_title: movieData.originalTitle || null,
                path: detailPath,
                poster: movieData.cover?.url || null,
                backdrop: movieData.backdrop?.url || null,
                description: cleanText(movieData.description || movieData.storyline || ''),
                rating: {
                    value: movieData.imdbRatingValue || movieData.doubanRatingValue || null,
                    count: movieData.imdbRatingCount || null
                },
                genres: genres.length > 0 ? genres : null,
                release_year: movieData.releasedDate || movieData.year || null,
                country: movieData.country || null,
                runtime: movieData.duration ? `${movieData.duration} min` : null,
                language: movieData.language || null,
                director: movieData.director || null,
                cast: movieData.cast || null,
                download_links: downloadLinks,
                total_links: downloadLinks.length
            },
            source: "AoneRoom",
            scraped_at: new Date().toISOString()
        };

        cache.set(cacheKey, result);
        return result;

    } catch (error) {
        console.error(`Aone Info Error: ${error.message}`);
        return {
            success: false,
            error: error.message,
            source: "AoneRoom"
        };
    }
}

// ============ YOUTUBE DOWNLOADER ============
async function downloadYouTube(url) {
    const cacheKey = `ytdl_${Buffer.from(url).toString('base64')}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const apiUrl = `https://mcsave.up.railway.app/api/download-all?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'accept': '*/*',
                'referer': 'https://mcsave.up.railway.app/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
            },
            timeout: 60000
        });

        const data = response.data;

        const medias = (data.medias || []).map(m => ({
            quality: m.quality || "Unknown",
            size: m.formattedSize || formatSize(m.size),
            extension: m.extension || "mp4",
            type: m.type || "video",
            url: m.url
        }));

        // Separate video and audio
        const videos = medias.filter(m => m.type === 'video');
        const audios = medias.filter(m => m.type === 'audio');

        const result = {
            success: true,
            data: {
                title: cleanText(data.title),
                thumbnail: data.thumbnail,
                duration: data.duration,
                source_url: url,
                videos: videos,
                audios: audios,
                all_medias: medias
            },
            source: "MCSave",
            scraped_at: new Date().toISOString()
        };

        cache.set(cacheKey, result);
        return result;

    } catch (error) {
        console.error(`YouTube Download Error: ${error.message}`);
        return {
            success: false,
            error: error.message,
            source: "MCSave"
        };
    }
}

// ============ ROUTES ============

// Main endpoint info
router.get('/', (req, res) => {
    res.json({
        status: true,
        name: "AoneRoom & YouTube Downloader API",
        name_si: "AoneRoom සහ යූටියුබ් ඩවුන්ලෝඩ් API",
        author: "Mr Thinuzz",
        version: "1.0.0",
        endpoints: {
            "/aone/search": "Search movies - ?q=query&page=1",
            "/aone/info": "Get movie info & download links - ?path=detailPath",
            "/aone/ytdl": "Download YouTube videos - ?url=youtube_url"
        },
        examples: {
            search: "/aone/search?q=oppenheimer",
            info: "/aone/info?path=/subject/12345",
            ytdl: "/aone/ytdl?url=https://youtu.be/example"
        },
        note: "X-user header may need to be updated if API stops working. Check via browser inspect."
    });
});

// Search endpoint
router.get('/search', async (req, res) => {
    const { q, page } = req.query;
    
    if (!q) {
        return res.status(400).json({
            status: false,
            error: "Missing 'q' parameter",
            author: "Mr Thinuzz",
            usage: "/aone/search?q=movie_name"
        });
    }

    const result = await searchAoneMovies(q, parseInt(page) || 1);
    
    res.json({
        ...result,
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString()
    });
});

// Info & Download endpoint
router.get('/info', async (req, res) => {
    const { path } = req.query;
    
    if (!path) {
        return res.status(400).json({
            status: false,
            error: "Missing 'path' parameter",
            author: "Mr Thinuzz",
            usage: "/aone/info?path=/subject/12345"
        });
    }

    const result = await getAoneMovieInfo(path);
    
    res.json({
        ...result,
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString()
    });
});

// YouTube Downloader endpoint
router.get('/ytdl', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' parameter",
            author: "Mr Thinuzz",
            usage: "/aone/ytdl?url=https://youtu.be/VIDEO_ID or https://www.youtube.com/watch?v=VIDEO_ID"
        });
    }

    // Validate YouTube URL
    const youtubeRegex = /(youtube\.com|youtu\.be)/i;
    if (!youtubeRegex.test(url)) {
        return res.status(400).json({
            status: false,
            error: "Invalid YouTube URL",
            author: "Mr Thinuzz"
        });
    }

    const result = await downloadYouTube(url);
    
    res.json({
        ...result,
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString()
    });
});

// Direct download link extract (for aone download links that need processing)
router.get('/direct', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' parameter",
            author: "Mr Thinuzz"
        });
    }

    try {
        const decodedUrl = decodeURIComponent(url);
        
        // Try to get file info using head request
        let fileSize = "Unknown";
        let fileName = decodedUrl.split('/').pop().split('?')[0];
        
        try {
            const headRes = await axios.head(decodedUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (headRes.headers['content-length']) {
                const bytes = parseInt(headRes.headers['content-length']);
                if (bytes > 1073741824) fileSize = (bytes / 1073741824).toFixed(2) + ' GB';
                else if (bytes > 1048576) fileSize = (bytes / 1048576).toFixed(2) + ' MB';
                else if (bytes > 1024) fileSize = (bytes / 1024).toFixed(2) + ' KB';
                else fileSize = bytes + ' B';
            }
        } catch (e) {
            // Ignore head request errors
        }

        res.json({
            status: true,
            author: "Mr Thinuzz",
            data: {
                url: decodedUrl,
                filename: fileName,
                size: fileSize,
                is_direct: true
            }
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            error: error.message,
            author: "Mr Thinuzz"
        });
    }
});

module.exports = router;
