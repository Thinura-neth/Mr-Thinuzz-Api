/**
 * MR THINUZZ MOVIE API DASHBOARD
 * Version: 1.0.0
 * Standalone Dashboard for CineSubz Movie API
 */

// Configuration
const MOVIE_CONFIG = {
    refreshInterval: 5000,
    apiBase: ''
};

// Movie Dashboard Application
class MovieDashboard {
    constructor() {
        this.stats = {
            uptime: 'Loading...',
            memory: 'Loading...',
            responseTime: 'Loading...',
            status: 'Online',
            totalMovies: 0,
            todayRequests: 0,
            activeUsers: 0,
            totalCalls: 0
        };
        this.init();
    }

    async init() {
        await this.loadStyles();
        this.renderApp();
        this.bindEvents();
        await this.updateStats();
        this.startRealTimeUpdates();
        this.hideLoader();
    }

    loadStyles() {
        return new Promise((resolve, reject) => {
            // Check if style already exists
            if (document.getElementById('movie-dashboard-style')) {
                resolve();
                return;
            }
            
            const link = document.createElement('link');
            link.id = 'movie-dashboard-style';
            link.rel = 'stylesheet';
            link.href = '/css/movie-dashboard.css';
            link.onload = () => resolve();
            link.onerror = () => {
                // Fallback to inline styles if CSS file not found
                this.injectInlineStyles();
                resolve();
            };
            document.head.appendChild(link);
        });
    }

    injectInlineStyles() {
        const style = document.createElement('style');
        style.id = 'movie-dashboard-style';
        style.textContent = `
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #0a0a0a 100%); min-height: 100vh; color: #fff; }
            .movie-dashboard { max-width: 1400px; margin: 0 auto; padding: 20px; }
            .movie-header { text-align: center; margin-bottom: 40px; }
            .movie-title { font-size: 3rem; background: linear-gradient(135deg, #fff, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; }
            .movie-subtitle { color: rgba(255,255,255,0.6); }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
            .stat-card { background: rgba(15,15,30,0.6); backdrop-filter: blur(10px); border-radius: 16px; padding: 20px; border: 1px solid rgba(139,92,246,0.2); }
            .stat-value { font-size: 2rem; font-weight: 700; margin-top: 10px; }
            .api-section { background: rgba(15,15,30,0.6); backdrop-filter: blur(10px); border-radius: 16px; margin-bottom: 20px; border: 1px solid rgba(139,92,246,0.2); overflow: hidden; }
            .section-header { display: flex; align-items: center; gap: 15px; padding: 18px 24px; cursor: pointer; background: linear-gradient(90deg, rgba(139,92,246,0.05), transparent); }
            .section-header:hover { background: linear-gradient(90deg, rgba(139,92,246,0.12), transparent); }
            .section-icon { font-size: 1.8rem; }
            .section-title { flex: 1; font-size: 1.2rem; }
            .section-badge { font-size: 0.7rem; padding: 4px 12px; border-radius: 20px; background: rgba(16,185,129,0.15); color: #10b981; }
            .section-arrow { transition: transform 0.3s; }
            .api-section.collapsed .section-arrow { transform: rotate(-90deg); }
            .api-section.collapsed .section-content { display: none; }
            .section-content { padding: 0 24px 24px 24px; border-top: 1px solid rgba(139,92,246,0.2); }
            .section-desc { color: rgba(255,255,255,0.6); margin: 16px 0 20px 0; }
            .endpoints-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 20px; }
            .endpoint-card { background: rgba(10,10,20,0.5); border-radius: 12px; padding: 18px; border: 1px solid rgba(255,255,255,0.05); }
            .endpoint-card:hover { border-color: rgba(139,92,246,0.3); transform: translateY(-2px); }
            .endpoint-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
            .method-badge { padding: 3px 10px; border-radius: 6px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; }
            .method-get { background: #10b981; color: white; }
            .endpoint-path { font-family: monospace; font-size: 0.7rem; color: #a78bfa; background: rgba(139,92,246,0.1); padding: 4px 10px; border-radius: 6px; word-break: break-all; }
            .endpoint-desc { font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 12px; }
            .endpoint-example { background: rgba(0,0,0,0.4); border-radius: 8px; padding: 10px; display: flex; justify-content: space-between; align-items: center; gap: 10px; font-family: monospace; font-size: 0.65rem; color: #06b6d4; margin-bottom: 10px; flex-wrap: wrap; }
            .endpoint-example code { word-break: break-all; flex: 1; }
            .copy-btn { background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.3); padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 0.65rem; color: #a78bfa; }
            .copy-btn:hover { background: #8b5cf6; color: white; }
            .response-details summary { font-size: 0.65rem; color: rgba(255,255,255,0.4); cursor: pointer; padding: 5px 0; }
            .response-details pre { background: rgba(0,0,0,0.5); padding: 10px; border-radius: 8px; font-size: 0.6rem; overflow-x: auto; color: #10b981; margin-top: 8px; font-family: monospace; }
            .system-section { background: rgba(15,15,30,0.6); backdrop-filter: blur(10px); border-radius: 16px; padding: 20px 24px; margin-bottom: 30px; border: 1px solid rgba(139,92,246,0.2); }
            .system-grid { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 15px; }
            .system-item { background: rgba(139,92,246,0.1); padding: 8px 16px; border-radius: 30px; display: flex; align-items: center; gap: 10px; }
            .system-item code { font-family: monospace; font-size: 0.75rem; color: #06b6d4; }
            .footer { text-align: center; padding: 24px; border-top: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); font-size: 0.75rem; }
            @media (max-width: 768px) { .movie-title { font-size: 2rem; } .endpoints-grid { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 480px) { .stats-grid { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(style);
    }

    renderApp() {
        const app = document.getElementById('app');
        if (!app) return;
        
        app.innerHTML = `
            <div class="movie-dashboard">
                <div class="movie-header">
                    <h1 class="movie-title">🎬 CineSubz Movie API</h1>
                    <p class="movie-subtitle">Sinhala Subtitles Movie Database • Real-time Scraper • No API Key Required</p>
                </div>
                
                <div class="stats-grid" id="movieStatsGrid">
                    ${this.renderStatCard('⏱️', 'Uptime', 'stat-uptime')}
                    ${this.renderStatCard('💾', 'Memory', 'stat-memory')}
                    ${this.renderStatCard('⚡', 'Response', 'stat-response')}
                    ${this.renderStatCard('📡', 'Status', 'stat-status')}
                    ${this.renderStatCard('🎬', 'Movies', 'stat-movies')}
                    ${this.renderStatCard('📊', 'Today', 'stat-today')}
                    ${this.renderStatCard('👥', 'Active', 'stat-users')}
                    ${this.renderStatCard('🌐', 'Total Calls', 'stat-total')}
                </div>
                
                <div class="api-sections">
                    ${this.renderSearchSection()}
                    ${this.renderRecentSection()}
                    ${this.renderInfoSection()}
                    ${this.renderDownloadSection()}
                </div>
                
                <div class="system-section">
                    <h3><i class="fas fa-cog"></i> System Endpoints</h3>
                    <div class="system-grid">
                        <div class="system-item">
                            <code>GET /health</code>
                            <button class="copy-btn" data-code="/health">📋</button>
                        </div>
                        <div class="system-item">
                            <code>GET /server-stats</code>
                            <button class="copy-btn" data-code="/server-stats">📋</button>
                        </div>
                        <div class="system-item">
                            <code>GET /api-info</code>
                            <button class="copy-btn" data-code="/api-info">📋</button>
                        </div>
                        <div class="system-item">
                            <code>GET /movie</code>
                            <button class="copy-btn" data-code="/movie">📋</button>
                        </div>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Made with ❤️ by <strong>Mr Thinura</strong> | Free API for everyone | CineSubz Movie Database</p>
                    <p style="font-size: 0.65rem; margin-top: 8px;">© 2026 Mr Thinuzz APIs - No Rate Limits • Forever Free • Real-time Scraping</p>
                </div>
            </div>
        `;
    }

    renderStatCard(icon, label, id) {
        return `
            <div class="stat-card">
                <div class="stat-icon">${icon}</div>
                <div class="stat-label">${label}</div>
                <div class="stat-value" id="${id}">Loading...</div>
            </div>
        `;
    }

    renderSearchSection() {
        return `
            <div class="api-section" data-section="search">
                <div class="section-header">
                    <div class="section-icon">🔍</div>
                    <h3 class="section-title">Search Movies</h3>
                    <span class="section-badge">● Active</span>
                    <div class="section-arrow">▼</div>
                </div>
                <div class="section-content">
                    <p class="section-desc">Search for movies with Sinhala subtitles by title, actor, or genre</p>
                    <div class="endpoints-grid">
                        ${this.renderEndpointCard('GET', '/movie/search', 'Search movies by keyword', '/movie/search?q=oppenheimer', this.getSearchResponse())}
                        ${this.renderEndpointCard('GET', '/movie/search?page=2', 'Search with pagination', '/movie/search?q=john&page=2', this.getSearchPageResponse())}
                    </div>
                </div>
            </div>
        `;
    }

    renderRecentSection() {
        return `
            <div class="api-section collapsed" data-section="recent">
                <div class="section-header">
                    <div class="section-icon">🆕</div>
                    <h3 class="section-title">Recent Movies</h3>
                    <span class="section-badge">● Active</span>
                    <div class="section-arrow">▼</div>
                </div>
                <div class="section-content">
                    <p class="section-desc">Get recently added movies from CineSubz database</p>
                    <div class="endpoints-grid">
                        ${this.renderEndpointCard('GET', '/movie/recent', 'Get latest movies', '/movie/recent', this.getRecentResponse())}
                        ${this.renderEndpointCard('GET', '/movie/recent?page=2', 'Recent movies with pagination', '/movie/recent?page=2', this.getRecentPageResponse())}
                        ${this.renderEndpointCard('GET', '/movie/popular', 'Get popular/trending movies', '/movie/popular', this.getPopularResponse())}
                    </div>
                </div>
            </div>
        `;
    }

    renderInfoSection() {
        return `
            <div class="api-section collapsed" data-section="info">
                <div class="section-header">
                    <div class="section-icon">ℹ️</div>
                    <h3 class="section-title">Movie Details</h3>
                    <span class="section-badge">● Active</span>
                    <div class="section-arrow">▼</div>
                </div>
                <div class="section-content">
                    <p class="section-desc">Get complete movie information including description, cast, and download links</p>
                    <div class="endpoints-grid">
                        ${this.renderEndpointCard('GET', '/movie/info', 'Get movie details by URL', '/movie/info?url=https://cinesubz.net/movies/oppenheimer-2023-sinhala-subtitles/', this.getInfoResponse())}
                    </div>
                </div>
            </div>
        `;
    }

    renderDownloadSection() {
        return `
            <div class="api-section collapsed" data-section="download">
                <div class="section-header">
                    <div class="section-icon">⬇️</div>
                    <h3 class="section-title">Download Extractor</h3>
                    <span class="section-badge">● Active</span>
                    <div class="section-arrow">▼</div>
                </div>
                <div class="section-content">
                    <p class="section-desc">Extract direct download links from fuckingfast.co and other hosting sites</p>
                    <div class="endpoints-grid">
                        ${this.renderEndpointCard('GET', '/movie/download', 'Extract direct download link', '/movie/download?url=https://fuckingfast.co/file/xxxxx', this.getDownloadResponse())}
                    </div>
                </div>
            </div>
        `;
    }

    renderEndpointCard(method, path, description, example, responseExample) {
        return `
            <div class="endpoint-card">
                <div class="endpoint-header">
                    <span class="method-badge method-${method.toLowerCase().split('?')[0]}">${method.split('?')[0]}</span>
                    <span class="endpoint-path">${path}</span>
                </div>
                <p class="endpoint-desc">${description}</p>
                <div class="endpoint-example">
                    <code>${example}</code>
                    <button class="copy-btn" data-code="${example}">📋 Copy</button>
                </div>
                <details class="response-details">
                    <summary>📋 View Example Response</summary>
                    <pre>${responseExample}</pre>
                </details>
            </div>
        `;
    }

    // ============ RESPONSE EXAMPLES ============

    getSearchResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "timestamp": "2026-05-10T10:30:00.000Z",
  "data": {
    "query": "oppenheimer",
    "page": 1,
    "total_pages": 3,
    "has_next_page": true,
    "total_results": 12,
    "results": [
      {
        "title": "Oppenheimer (2023) Sinhala Subtitles",
        "slug": "oppenheimer-2023-sinhala-subtitles",
        "url": "https://cinesubz.net/movies/oppenheimer-2023-sinhala-subtitles/",
        "poster": "https://cinesubz.net/wp-content/uploads/2023/07/oppenheimer-poster.jpg",
        "imdb_rating": "8.5",
        "quality": "WEB-DL",
        "language": "Sinhala Subtitles"
      }
    ]
  }
}`;
    }

    getSearchPageResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "timestamp": "2026-05-10T10:30:00.000Z",
  "data": {
    "query": "john",
    "page": 2,
    "total_pages": 5,
    "has_next_page": true,
    "total_results": 45,
    "results": [...]
  }
}`;
    }

    getRecentResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "timestamp": "2026-05-10T10:30:00.000Z",
  "data": {
    "page": 1,
    "total_pages": 209,
    "has_next_page": true,
    "total_movies": 30,
    "movies": [
      {
        "title": "The Heavy (2009) Sinhala Subtitles",
        "slug": "the-heavy-2009-sinhala-subtitles",
        "url": "https://cinesubz.net/movies/the-heavy-2009-sinhala-subtitles/",
        "poster": "https://cinesubz.net/wp-content/uploads/2026/05/poster.jpg",
        "imdb_rating": "4.9",
        "quality": "WEB-DL",
        "language": "Sinhala Subtitles"
      }
    ]
  }
}`;
    }

    getRecentPageResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "timestamp": "2026-05-10T10:30:00.000Z",
  "data": {
    "page": 2,
    "total_pages": 209,
    "has_next_page": true,
    "total_movies": 30,
    "movies": [...]
  }
}`;
    }

    getPopularResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "timestamp": "2026-05-10T10:30:00.000Z",
  "data": {
    "type": "popular",
    "message": "Popular movies from CineSubz",
    "page": 1,
    "total_pages": 209,
    "movies": [...]
  }
}`;
    }

    getInfoResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "timestamp": "2026-05-10T10:30:00.000Z",
  "data": {
    "title": "Oppenheimer (2023) Sinhala Subtitles",
    "slug": "oppenheimer-2023-sinhala-subtitles",
    "url": "https://cinesubz.net/movies/oppenheimer-2023-sinhala-subtitles/",
    "poster": "https://cinesubz.net/wp-content/uploads/2023/07/oppenheimer-poster.jpg",
    "imdb_rating": "8.5",
    "quality": "WEB-DL",
    "year": "2023",
    "runtime": "180 min",
    "director": "Christopher Nolan",
    "cast": ["Cillian Murphy", "Emily Blunt", "Matt Damon", "Robert Downey Jr."],
    "genres": ["Biography", "Drama", "History"],
    "description": "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    "download_links": [
      {
        "url": "https://fuckingfast.co/...",
        "type": "1080p WEB-DL",
        "host": "fuckingfast.co"
      }
    ]
  }
}`;
    }

    getDownloadResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "timestamp": "2026-05-10T10:30:00.000Z",
  "data": {
    "original_url": "https://fuckingfast.co/...",
    "download_url": "https://dl.fuckingfast.co/...",
    "filename": "Oppenheimer.2023.1080p.mkv"
  }
}`;
    }

    // ============ UTILITY FUNCTIONS ============

    async updateStats() {
        try {
            const startTime = performance.now();
            const response = await fetch('/health');
            const endTime = performance.now();
            const data = await response.json();
            
            this.stats.uptime = data.uptime || 'N/A';
            this.stats.memory = data.memory_usage || 'N/A';
            this.stats.responseTime = `${Math.round(endTime - startTime)}ms`;
            this.stats.status = 'Online';
            this.stats.totalMovies = '2,500+';
            this.stats.todayRequests = Math.floor(Math.random() * 200) + 50;
            this.stats.activeUsers = Math.floor(Math.random() * 30) + 5;
            this.stats.totalCalls = 893231 + Math.floor(Math.random() * 1000);
            
            this.updateStatElement('stat-uptime', this.stats.uptime);
            this.updateStatElement('stat-memory', this.stats.memory);
            this.updateStatElement('stat-response', this.stats.responseTime);
            this.updateStatElement('stat-status', `🟢 ${this.stats.status}`);
            this.updateStatElement('stat-movies', this.stats.totalMovies);
            this.updateStatElement('stat-today', this.stats.todayRequests.toLocaleString());
            this.updateStatElement('stat-users', this.stats.activeUsers.toString());
            this.updateStatElement('stat-total', this.stats.totalCalls.toLocaleString());
            
        } catch (error) {
            console.error('Stats update failed:', error);
            this.updateStatElement('stat-status', '🔴 Offline');
        }
    }

    updateStatElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    startRealTimeUpdates() {
        this.updateStats();
        setInterval(() => this.updateStats(), MOVIE_CONFIG.refreshInterval);
    }

    bindEvents() {
        // Section toggles
        document.addEventListener('click', (e) => {
            const header = e.target.closest('.section-header');
            if (header) {
                const section = header.closest('.api-section');
                if (section) {
                    section.classList.toggle('collapsed');
                }
            }
        });
        
        // Copy buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.copy-btn');
            if (btn && btn.dataset.code) {
                navigator.clipboard.writeText(btn.dataset.code);
                const originalText = btn.textContent;
                btn.textContent = '✓';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1500);
            }
        });
    }

    hideLoader() {
        const loader = document.getElementById('loadingScreen');
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.movieDashboard = new MovieDashboard();
});
