/**
 * MR THINUZZ ADVANCED API PLATFORM
 * Version: 3.0.0
 * Fully Dynamic - All content loaded via JavaScript
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    apiBase: '',
    endpoints: {
        health: '/health',
        stats: '/server-stats',
        apiInfo: '/api-info'
    },
    refreshInterval: 5000,
    animations: true
};

// ============================================
// MAIN APPLICATION CLASS
// ============================================
class AdvancedAPIPlatform {
    constructor() {
        this.stats = {
            uptime: 'Loading...',
            memory: 'Loading...',
            responseTime: '~50ms',
            status: 'Online'
        };
        this.sections = [];
        this.init();
    }

    async init() {
        await this.loadStyles();
        await this.loadParticleBackground();
        this.renderApp();
        this.bindEvents();
        this.startRealTimeUpdates();
        this.hideLoader();
    }

    async loadStyles() {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/main.css';
            link.onload = () => resolve();
            link.onerror = () => reject();
            document.head.appendChild(link);
        });
    }

    async loadParticleBackground() {
        const canvas = document.createElement('canvas');
        canvas.id = 'bg-canvas';
        document.body.prepend(canvas);
        this.initParticles(canvas);
    }

    initParticles(canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        
        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.5;
                this.speedY = (Math.random() - 0.5) * 0.3;
                this.opacity = Math.random() * 0.3;
            }
            
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                
                if (this.x < 0) this.x = canvas.width;
                if (this.x > canvas.width) this.x = 0;
                if (this.y < 0) this.y = canvas.height;
                if (this.y > canvas.height) this.y = 0;
            }
            
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(139, 92, 246, ${this.opacity})`;
                ctx.fill();
            }
        }
        
        function createParticles() {
            particles = [];
            const count = Math.min(100, Math.floor(window.innerWidth * window.innerHeight / 8000));
            for (let i = 0; i < count; i++) {
                particles.push(new Particle());
            }
        }
        
        function animate() {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            requestAnimationFrame(animate);
        }
        
        window.addEventListener('resize', () => {
            resizeCanvas();
            createParticles();
        });
        
        resizeCanvas();
        createParticles();
        animate();
    }

    renderApp() {
        const appRoot = document.getElementById('app-root');
        if (!appRoot) return;
        
        appRoot.innerHTML = `
            <div class="app-container">
                ${this.renderHeader()}
                ${this.renderStatsGrid()}
                <div class="api-sections">
                    ${this.renderGameSection()}
                    ${this.renderAnimeSection()}
                    ${this.renderMovieSection()}
                </div>
                ${this.renderSystemSection()}
                ${this.renderGuideSection()}
                ${this.renderFooter()}
            </div>
        `;
        
        // Update stats after render
        setTimeout(() => this.updateStats(), 100);
    }

    renderHeader() {
        return `
            <header class="api-header">
                <div class="badge-container">
                    <span class="badge badge-free">🎯 FREE</span>
                    <span class="badge badge-unlimited">∞ UNLIMITED</span>
                    <span class="badge badge-live">● LIVE</span>
                </div>
                <h1 class="api-title">MR THINUZZ API</h1>
                <p class="api-subtitle">
                    No API Key • Unlimited Requests • Real-time Scraping • 
                    <a href="https://github.com" target="_blank">Advanced Platform v3.0</a>
                </p>
            </header>
        `;
    }

    renderStatsGrid() {
        return `
            <div class="stats-grid" id="stats-grid">
                <div class="stat-card" data-stat="uptime">
                    <div class="stat-icon">⏱️</div>
                    <div class="stat-content">
                        <div class="stat-label">Uptime</div>
                        <div class="stat-value" id="stat-uptime">${this.stats.uptime}</div>
                    </div>
                </div>
                <div class="stat-card" data-stat="memory">
                    <div class="stat-icon">💾</div>
                    <div class="stat-content">
                        <div class="stat-label">Memory Usage</div>
                        <div class="stat-value" id="stat-memory">${this.stats.memory}</div>
                    </div>
                </div>
                <div class="stat-card" data-stat="response">
                    <div class="stat-icon">⚡</div>
                    <div class="stat-content">
                        <div class="stat-label">Response Time</div>
                        <div class="stat-value" id="stat-response">${this.stats.responseTime}</div>
                    </div>
                </div>
                <div class="stat-card" data-stat="status">
                    <div class="stat-icon">📡</div>
                    <div class="stat-content">
                        <div class="stat-label">API Status</div>
                        <div class="stat-value" id="stat-status">🟢 ${this.stats.status}</div>
                    </div>
                </div>
                <div class="stat-card" data-stat="apis">
                    <div class="stat-icon">🎯</div>
                    <div class="stat-content">
                        <div class="stat-label">Active APIs</div>
                        <div class="stat-value" id="stat-apis">3</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderGameSection() {
        return `
            <div class="api-section collapsed" data-section="game">
                <div class="section-header">
                    <div class="section-icon">🎮</div>
                    <h2 class="section-title">Games API</h2>
                    <span class="section-status">● Active</span>
                    <div class="section-arrow">▼</div>
                </div>
                <div class="section-content">
                    <p class="section-desc">Complete FitGirl Repacks API - Search, Info & Download endpoints with real-time scraping</p>
                    <div class="endpoints-grid">
                        ${this.renderEndpointCard('GET', '/game/fitgirl-search', 'Search for games on FitGirl Repacks', '/game/fitgirl-search?q=cyberpunk', this.getGameSearchResponse())}
                        ${this.renderEndpointCard('GET', '/game/fitgirl-info', 'Get complete game info with all download links', '/game/fitgirl-info?url=https://fitgirl-repacks.site/cyberpunk-2077/', this.getGameInfoResponse())}
                        ${this.renderEndpointCard('GET', '/game/fitgirl-download', 'Extract direct download link from fuckingfast.co', '/game/fitgirl-download?url=https://fuckingfast.co/...', this.getGameDownloadResponse())}
                    </div>
                </div>
            </div>
        `;
    }

    renderAnimeSection() {
        return `
            <div class="api-section collapsed" data-section="anime">
                <div class="section-header">
                    <div class="section-icon">📺</div>
                    <h2 class="section-title">Anime API</h2>
                    <span class="section-status">● Active</span>
                    <div class="section-arrow">▼</div>
                </div>
                <div class="section-content">
                    <p class="section-desc">Multi-source Anime API - Search, Popular, Info endpoints (Jikan API + AniList + Direct Scraping)</p>
                    <div class="endpoints-grid">
                        ${this.renderEndpointCard('GET', '/anime/search', 'Search for anime by title (Multi-source fallback)', '/anime/search?q=naruto', this.getAnimeSearchResponse())}
                        ${this.renderEndpointCard('GET', '/anime/popular', 'Get top popular anime from MyAnimeList', '/anime/popular', this.getAnimePopularResponse())}
                        ${this.renderEndpointCard('GET', '/anime/info', 'Get complete anime information by ID', '/anime/info?id=21', this.getAnimeInfoResponse())}
                    </div>
                </div>
            </div>
        `;
    }

    renderMovieSection() {
        return `
            <div class="api-section collapsed" data-section="movie">
                <div class="section-header">
                    <div class="section-icon">🎬</div>
                    <h2 class="section-title">Movie API</h2>
                    <span class="section-status coming">Coming Soon</span>
                    <div class="section-arrow">▼</div>
                </div>
                <div class="section-content">
                    <div class="coming-soon">
                        <div class="coming-soon-icon">🚧</div>
                        <h4>Under Development</h4>
                        <p>Movie API is currently being built with advanced features</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderEndpointCard(method, path, description, example, responseExample) {
        return `
            <div class="endpoint-card">
                <div class="endpoint-header">
                    <span class="method-badge method-${method.toLowerCase()}">${method}</span>
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

    // Response examples
    getGameSearchResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "timestamp": "2026-01-18T10:30:00.000Z",
  "data": {
    "query": "cyberpunk",
    "total_results": 5,
    "results": [
      {
        "title": "Cyberpunk 2077 v2.1 + Phantom Liberty",
        "url": "https://fitgirl-repacks.site/cyberpunk-2077/"
      }
    ]
  }
}`;
    }

    getGameInfoResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "data": {
    "title": "Cyberpunk 2077 v2.1 + Phantom Liberty",
    "game_info": {
      "Genres/Tags": "Action, RPG, Open World",
      "Companies": "CD Projekt RED",
      "Repack Size": "64.
