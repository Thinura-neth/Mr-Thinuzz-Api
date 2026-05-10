const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// User agents for rotation
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Search using Jikan API (MyAnimeList)
async function searchAnimeJikan(query) {
    try {
        console.log(`🔍 Using Jikan API for: ${query}`);
        
        const response = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=20`, {
            timeout: 15000,
            headers: { 'User-Agent': getRandomUserAgent() }
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

// Search using AniList GraphQL
async function searchAnimeAniList(query) {
    try {
        console.log(`🔍 Using AniList for: ${query}`);
        
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
                source: "AniList (GraphQL)",
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
        console.error(`❌ AniList error:`, error.message);
        return null;
    }
}

// Main search function with fallbacks
async function searchAnimeWithFallback(query) {
    console.log(`📡 Searching anime: ${query}`);
    
    // Try 1: Jikan API
    const jikanResult = await searchAnimeJikan(query);
    if (jikanResult && jikanResult.status) return jikanResult;
    
    // Try 2: AniList GraphQL
    const anilistResult = await searchAnimeAniList(query);
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

// Get popular anime
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

// Get anime info by ID
async function getAnimeInfo(id) {
    try {
        const response = await axios.get(`https://api.jikan.moe/v4/anime/${id}`, {
            timeout: 15000,
            headers: { 'User-Agent': getRandomUserAgent() }
        });
        
        const anime = response.data.data;
        
        return {
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
        };
        
    } catch (error) {
        return {
            status: false,
            error: `Failed to get info: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
}

// ============ ROUTES ============

router.get('/', (req, res) => {
    res.json({
        status: true,
        message: "📺 Mr Thinuzz Anime API - Multi-Source Scraper",
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString(),
        methods: ["Jikan API (MyAnimeList)", "AniList GraphQL"],
        endpoints: {
            "GET /anime/search?q=TITLE": "Search anime (Multi-source)",
            "GET /anime/popular": "Get popular anime",
            "GET /anime/info?id=ID": "Get anime details"
        },
        examples: {
            search: "/anime/search?q=naruto",
            popular: "/anime/popular",
            info: "/anime/info?id=21"
        }
    });
});

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

router.get('/popular', async (req, res) => {
    const result = await getPopularAnime();
    res.json(result);
});

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
    
    const result = await getAnimeInfo(id);
    res.json(result);
});

module.exports = router;
