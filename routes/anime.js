const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// ============ PROXY & BYPASS METHODS ============

// Method 1: Use multiple user agents and rotate
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Method 2: Try multiple mirror sites
const mirrorSites = [
    'https://animepahe.com',
    'https://animepahe.ru',
    'https://pahe.ph',
    'https://animepahe.org'
];

// Method 3: Use alternative anime database (AniList GraphQL - free, no API key)
async function searchAnimeAlternative(query) {
    try {
        console.log(`🔍 Using alternative search for: ${query}`);
        
        // Use AniList's public GraphQL API (no API key needed)
        const graphqlQuery = {
            query: `
                query ($search: String) {
                    Page(page: 1, perPage: 20) {
                        media(search: $search, type: ANIME) {
                            id
                            title {
                                romaji
                                english
                                native
                            }
                            format
                            episodes
                            status
                            season
                            seasonYear
                            averageScore
                            coverImage {
                                large
                                medium
                            }
                            description
                            genres
                        }
                    }
                }
            `,
            variables: { search: query }
        };
        
        const response = await axios.post('https://graphql.anilist.co', graphqlQuery, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': getRandomUserAgent()
            }
        });
        
        const media = response.data.data.Page.media;
        
        if (media && media.length > 0) {
            const results = media.map(anime => ({
                id: anime.id,
                title: anime.title.romaji || anime.title.english || anime.title.native,
                title_english: anime.title.english,
                type: anime.format,
                episodes: anime.episodes,
                status: anime.status,
                year: anime.seasonYear,
                score: anime.averageScore ? (anime.averageScore / 10).toFixed(2) : null,
                poster: anime.coverImage?.large || anime.coverImage?.medium,
                genres: anime.genres || [],
                description: anime.description ? anime.description.replace(/<[^>]*>/g, '').substring(0, 500) : null
            }));
            
            return {
                status: true,
                source: "AniList (Alternative)",
                author: "Mr Thinuzz",
                timestamp: new Date().toISOString(),
                data: {
                    query: query,
                    total_results: results.length,
                    results: results
                }
            };
        }
        
        return {
            status: false,
            error: "No results found",
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`❌ Alternative search error:`, error.message);
        return {
            status: false,
            error: `Search failed: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// Method 4: Use Jikan API (MyAnimeList unofficial API - free, no key)
async function searchAnimeJikan(query) {
    try {
        console.log(`🔍 Using Jikan API for: ${query}`);
        
        const response = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=20`, {
            timeout: 15000,
            headers: {
                'User-Agent': getRandomUserAgent()
            }
        });
        
        const data = response.data.data;
        
        if (data && data.length > 0) {
            const results = data.map(anime => ({
                id: anime.mal_id,
                title: anime.title,
                title_english: anime.title_english,
                title_japanese: anime.title_japanese,
                type: anime.type,
                episodes: anime.episodes,
                status: anime.status,
                year: anime.year,
                score: anime.score,
                poster: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
                synopsis: anime.synopsis?.substring(0, 500),
                genres: anime.genres?.map(g => g.name) || []
            }));
            
            return {
                status: true,
                source: "Jikan API (MyAnimeList)",
                author: "Mr Thinuzz",
                timestamp: new Date().toISOString(),
                data: {
                    query: query,
                    total_results: results.length,
                    results: results
                }
            };
        }
        
        return null;
        
    } catch (error) {
        console.error(`❌ Jikan API error:`, error.message);
        return null;
    }
}

// Method 5: Direct HTML scraping with bypass headers
async function searchAnimeDirectBypass(query) {
    for (const mirror of mirrorSites) {
        try {
            console.log(`🔄 Trying mirror: ${mirror}`);
            
            const searchUrl = `${mirror}/anime?q=${encodeURIComponent(query)}`;
            
            const response = await axios.get(searchUrl, {
                timeout: 20000,
                headers: {
                    'User-Agent': getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': mirror,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                // Important for Vercel
                httpAgent: null,
                httpsAgent: null,
                decompress: true
            });
            
            const html = response.data;
            const $ = cheerio.load(html);
            const results = [];
            
            // Extract results
            $('a[href*="/anime/"]').each((i, element) => {
                const href = $(element).attr('href');
                const text = $(element).text().trim();
                
                if (href && href.includes('/anime/') && !href.includes('/anime?') && text && text.length > 3 && text.length < 150) {
                    const idMatch = href.match(/\/anime\/(\d+)/);
                    if (idMatch && text.toLowerCase().includes(query.toLowerCase())) {
                        const isDuplicate = results.some(r => r.url === href);
                        if (!isDuplicate && results.length < 20) {
                            results.push({
                                id: parseInt(idMatch[1]),
                                title: text.replace(/\s+/g, ' ').trim(),
                                url: href
                            });
                        }
                    }
                }
            });
            
            if (results.length > 0) {
                return {
                    status: true,
                    source: mirror,
                    author: "Mr Thinuzz",
                    timestamp: new Date().toISOString(),
                    data: {
                        query: query,
                        total_results: results.length,
                        results: results.slice(0, 20)
                    }
                };
            }
            
        } catch (error) {
            console.log(`Mirror ${mirror} failed:`, error.message);
            continue;
        }
    }
    
    return null;
}

// Main search function with fallbacks
async function searchAnimeWithFallback(query) {
    // Try 1: Direct bypass scraping
    console.log(`📡 Attempt 1: Direct bypass scraping`);
    const directResult = await searchAnimeDirectBypass(query);
    if (directResult && directResult.status) return directResult;
    
    // Try 2: Jikan API (MyAnimeList)
    console.log(`📡 Attempt 2: Jikan API`);
    const jikanResult = await searchAnimeJikan(query);
    if (jikanResult && jikanResult.status) return jikanResult;
    
    // Try 3: AniList GraphQL
    console.log(`📡 Attempt 3: AniList Alternative`);
    const anilistResult = await searchAnimeAlternative(query);
    if (anilistResult && anilistResult.status) return anilistResult;
    
    // All methods failed
    return {
        status: false,
        error: "All scraping methods failed. Please try again later.",
        timestamp: new Date().toISOString(),
        author: "Mr Thinuzz",
        note: "Try different search terms or use /anime/popular endpoint"
    };
}

// Popular anime endpoint (no search needed)
async function getPopularAnime() {
    try {
        const response = await axios.get('https://api.jikan.moe/v4/top/anime?limit=20', {
            timeout: 15000,
            headers: { 'User-Agent': getRandomUserAgent() }
        });
        
        const data = response.data.data;
        
        const results = data.map(anime => ({
            id: anime.mal_id,
            title: anime.title,
            type: anime.type,
            episodes: anime.episodes,
            score: anime.score,
                            poster: anime.images?.jpg?.image_url,
            year: anime.year
        }));
        
        return {
            status: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: results
        };
        
    } catch (error) {
        return {
            status: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ ROUTES ============

// GET /anime - Root info
router.get('/', (req, res) => {
    res.json({
        status: true,
        message: "📺 Mr Thinuzz Anime API - Multi-Source Scraper",
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString(),
        methods: [
            "Direct Bypass Scraping",
            "Jikan API (MyAnimeList)",
            "AniList GraphQL"
        ],
        endpoints: {
            "GET /anime/search?q=TITLE": "搜索动漫 (Multi-source)",
            "GET /anime/popular": "获取热门动漫",
            "GET /anime/info?id=ID": "获取动漫详情 (使用Jikan)"
        },
        examples: {
            search: "/anime/search?q=naruto",
            popular: "/anime/popular",
            info: "/anime/info?id=21"
        }
    });
});

// GET /anime/search - Main search endpoint
router.get('/search', async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({
            status: false,
            error: "Search query parameter 'q' is required",
            timestamp: new Date().toISOString(),
            usage: "/anime/search?q=YOUR_SEARCH_TERM",
            example: "/anime/search?q=naruto"
        });
    }
    
    const searchTerm = decodeURIComponent(q);
    const result = await searchAnimeWithFallback(searchTerm);
    res.json(result);
});

// GET /anime/popular - Popular anime endpoint
router.get('/popular', async (req, res) => {
    const result = await getPopularAnime();
    res.json(result);
});

// GET /anime/info - Anime info by ID (using Jikan)
router.get('/info', async (req, res) => {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({
            status: false,
            error: "ID parameter is required",
            timestamp: new Date().toISOString(),
            usage: "/anime/info?id=ANIME_ID",
            example: "/anime/info?id=21"
        });
    }
    
    try {
        const response = await axios.get(`https://api.jikan.moe/v4/anime/${id}`, {
            timeout: 15000,
            headers: { 'User-Agent': getRandomUserAgent() }
        });
        
        const anime = response.data.data;
        
        res.json({
            status: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                id: anime.mal_id,
                title: anime.title,
                title_english: anime.title_english,
                title_japanese: anime.title_japanese,
                type: anime.type,
                episodes: anime.episodes,
                status: anime.status,
                duration: anime.duration,
                score: anime.score,
                scored_by: anime.scored_by,
                rank: anime.rank,
                popularity: anime.popularity,
                synopsis: anime.synopsis,
                poster: anime.images?.jpg?.large_image_url,
                trailer: anime.trailer?.url,
                genres: anime.genres?.map(g => g.name),
                studios: anime.studios?.map(s => s.name),
                year: anime.year,
                season: anime.season
            }
        });
        
    } catch (error) {
        res.json({
            status: false,
            error: `Failed to get info: ${error.message}`,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
