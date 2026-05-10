const express = require('express');
const axios = require('axios');
const router = express.Router();

// Base URLs for internal APIs
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ============ HELPER FUNCTIONS ============

async function fetchAPI(endpoint, params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const url = `${BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mr-Thinuzz-API/1.0'
            }
        });
        
        return response.data;
    } catch (error) {
        return {
            status: false,
            error: error.message,
            endpoint: endpoint
        };
    }
}

// ============ MAIN AGGREGATOR ============

router.get('/', async (req, res) => {
    const { section } = req.query;
    
    // If specific section requested
    if (section) {
        const sectionMap = {
            'game': { endpoint: '/game', method: 'GET' },
            'movie': { endpoint: '/movie', method: 'GET' },
            'anime': { endpoint: '/anime', method: 'GET' },
            'game-search': { endpoint: '/game/fitgirl-search', params: { q: req.query.q } },
            'movie-search': { endpoint: '/movie/search', params: { q: req.query.q } },
            'movie-recent': { endpoint: '/movie/recent' },
            'movie-popular': { endpoint: '/movie/popular' },
            'anime-search': { endpoint: '/anime/search', params: { q: req.query.q } },
            'anime-popular': { endpoint: '/anime/popular' }
        };
        
        const target = sectionMap[section];
        if (target) {
            const result = await fetchAPI(target.endpoint, target.params || {});
            return res.json({
                status: true,
                section: section,
                author: "Mr Thinuzz",
                timestamp: new Date().toISOString(),
                data: result
            });
        } else {
            return res.status(400).json({
                status: false,
                error: `Invalid section: ${section}`,
                available_sections: Object.keys(sectionMap),
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // Fetch all sections
    const [
        gameInfo,
        movieInfo,
        animeInfo,
        gamePopular,
        recentMovies,
        popularAnime
    ] = await Promise.all([
        fetchAPI('/game'),
        fetchAPI('/movie'),
        fetchAPI('/anime'),
        fetchAPI('/game/fitgirl-search', { q: 'gta' }),
        fetchAPI('/movie/recent'),
        fetchAPI('/anime/popular')
    ]);
    
    res.json({
        status: true,
        message: "🎬 Mr Thinuzz - Complete API Aggregator",
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString(),
        data: {
            game_section: {
                info: gameInfo,
                sample_search: gamePopular
            },
            movie_section: {
                info: movieInfo,
                recent_movies: recentMovies
            },
            anime_section: {
                info: animeInfo,
                popular_anime: popularAnime
            }
        },
        usage: {
            get_all: "/all-apis",
            get_specific: "/all-apis?section=game",
            search_game: "/all-apis?section=game-search&q=cyberpunk",
            search_movie: "/all-apis?section=movie-search&q=inception",
            search_anime: "/all-apis?section=anime-search&q=naruto",
            recent_movies: "/all-apis?section=movie-recent",
            popular_anime: "/all-apis?section=anime-popular"
        }
    });
});

// ============ MOVIE SECTION ============

router.get('/movie', async (req, res) => {
    const { action, q, url, page } = req.query;
    
    let endpoint = '';
    let params = {};
    
    switch(action) {
        case 'search':
            endpoint = '/movie/search';
            params = { q };
            break;
        case 'recent':
            endpoint = '/movie/recent';
            params = { page };
            break;
        case 'info':
            endpoint = '/movie/info';
            params = { url };
            break;
        case 'popular':
            endpoint = '/movie/popular';
            break;
        default:
            const movieInfo = await fetchAPI('/movie');
            return res.json({
                status: true,
                section: 'movie',
                info: movieInfo,
                available_actions: ['search', 'recent', 'info', 'popular'],
                examples: {
                    search: "/all-apis/movie?action=search&q=oppenheimer",
                    recent: "/all-apis/movie?action=recent",
                    info: "/all-apis/movie?action=info&url=https://cinesubz.net/movies/...",
                    popular: "/all-apis/movie?action=popular"
                }
            });
    }
    
    const result = await fetchAPI(endpoint, params);
    res.json(result);
});

// ============ GAME SECTION ============

router.get('/game', async (req, res) => {
    const { action, q, url } = req.query;
    
    let endpoint = '';
    let params = {};
    
    switch(action) {
        case 'search':
            endpoint = '/game/fitgirl-search';
            params = { q };
            break;
        case 'info':
            endpoint = '/game/fitgirl-info';
            params = { url };
            break;
        case 'download':
            endpoint = '/game/fitgirl-download';
            params = { url };
            break;
        default:
            const gameInfo = await fetchAPI('/game');
            return res.json({
                status: true,
                section: 'game',
                info: gameInfo,
                available_actions: ['search', 'info', 'download'],
                examples: {
                    search: "/all-apis/game?action=search&q=cyberpunk",
                    info: "/all-apis/game?action=info&url=https://fitgirl-repacks.site/...",
                    download: "/all-apis/game?action=download&url=https://fuckingfast.co/..."
                }
            });
    }
    
    const result = await fetchAPI(endpoint, params);
    res.json(result);
});

// ============ ANIME SECTION ============

router.get('/anime', async (req, res) => {
    const { action, q, id } = req.query;
    
    let endpoint = '';
    let params = {};
    
    switch(action) {
        case 'search':
            endpoint = '/anime/search';
            params = { q };
            break;
        case 'popular':
            endpoint = '/anime/popular';
            break;
        case 'info':
            endpoint = '/anime/info';
            params = { id };
            break;
        default:
            const animeInfo = await fetchAPI('/anime');
            return res.json({
                status: true,
                section: 'anime',
                info: animeInfo,
                available_actions: ['search', 'popular', 'info'],
                examples: {
                    search: "/all-apis/anime?action=search&q=naruto",
                    popular: "/all-apis/anime?action=popular",
                    info: "/all-apis/anime?action=info&id=21"
                }
            });
    }
    
    const result = await fetchAPI(endpoint, params);
    res.json(result);
});

// ============ INSTAGRAM SECTION (Bonus) ============

router.get('/instagram', async (req, res) => {
    const { username, url } = req.query;
    
    // Note: Instagram API requires official access
    // This is a placeholder structure
    
    res.json({
        status: true,
        section: 'instagram',
        message: "Instagram API - Requires Official Access",
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString(),
        note: "For production Instagram API, you need to use Meta's Graph API with an access token",
        endpoints: {
            user_info: "/all-apis/instagram?username=USERNAME",
            media_info: "/all-apis/instagram?url=MEDIA_URL"
        },
        alternative: "Use /movie, /game, or /anime endpoints instead"
    });
});

// ============ MOVE / ANIMATION SECTION ============

router.get('/move', async (req, res) => {
    res.json({
        status: true,
        section: 'move_animation',
        message: "Move & Animation API",
        author: "Mr Thinuzz",
        timestamp: new Date().toISOString(),
        related_apis: {
            anime: "/all-apis/anime",
            movie: "/all-apis/movie"
        }
    });
});

module.exports = router;
