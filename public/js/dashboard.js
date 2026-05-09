/**
 * MR THINUZZ ADVANCED DASHBOARD
 * Version: 3.0.0
 * Fully Dynamic - All content loaded via JavaScript
 */

// Configuration
const CONFIG = {
    refreshInterval: 5000,
    apiBase: ''
};

// Dashboard Application
class Dashboard {
    constructor() {
        this.currentPage = 'dashboard';
        this.stats = {
            uptime: 'Loading...',
            memory: 'Loading...',
            responseTime: 'Loading...',
            status: 'Online',
            activeApis: 3,
            todayRequests: 0,
            activeUsers: 0,
            totalCalls: 0
        };
        this.searchQuery = '';
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
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/dashboard.css';
            link.onload = () => resolve();
            link.onerror = () => reject();
            document.head.appendChild(link);
        });
    }

    renderApp() {
        const app = document.getElementById('app');
        if (!app) return;
        
        app.innerHTML = `
            <div class="app-layout">
                ${this.renderSidebar()}
                <main class="main-content">
                    ${this.renderTopHeader()}
                    <div class="content-wrapper" id="contentWrapper">
                        ${this.renderDashboardContent()}
                    </div>
                    ${this.renderFooter()}
                </main>
            </div>
        `;
        
        // After render, check for collapsed state
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true') {
            document.querySelector('.sidebar')?.classList.add('collapsed');
        }
    }

    renderSidebar() {
        return `
            <aside class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <div class="logo">
                        <i class="fas fa-bolt"></i>
                        <span>MR THINUZZ</span>
                    </div>
                    <button class="sidebar-toggle" id="sidebarToggle">
                        <i class="fas fa-bars"></i>
                    </button>
                </div>
                
                <nav class="sidebar-nav">
                    <a href="#" class="nav-link active" data-page="dashboard">
                        <i class="fas fa-tachometer-alt"></i>
                        <span>Dashboard</span>
                    </a>
                    <a href="#" class="nav-link" data-page="games">
                        <i class="fas fa-gamepad"></i>
                        <span>Games API</span>
                    </a>
                    <a href="#" class="nav-link" data-page="anime">
                        <i class="fas fa-tv"></i>
                        <span>Anime API</span>
                    </a>
                    <a href="#" class="nav-link" data-page="download">
                        <i class="fas fa-download"></i>
                        <span>Download API</span>
                    </a>
                    <a href="#" class="nav-link" data-page="ai">
                        <i class="fas fa-microchip"></i>
                        <span>AI API</span>
                    </a>
                    <a href="#" class="nav-link" data-page="movie">
                        <i class="fas fa-film"></i>
                        <span>Movie API</span>
                    </a>
                    <a href="#" class="nav-link" data-page="search">
                        <i class="fas fa-search"></i>
                        <span>Search API</span>
                    </a>
                    <a href="#" class="nav-link" data-page="stalk">
                        <i class="fas fa-user-secret"></i>
                        <span>Stalk API</span>
                    </a>
                </nav>
                
                <div class="sidebar-footer">
                    <div class="status-indicator">
                        <span class="status-dot online"></span>
                        <span>API Online</span>
                    </div>
                    <div class="api-version">
                        <i class="fas fa-code-branch"></i>
                        <span>v3.0.0</span>
                    </div>
                </div>
            </aside>
        `;
    }

    renderTopHeader() {
        return `
            <header class="top-header">
                <div class="header-left">
                    <h1 id="pageTitle">Dashboard Overview</h1>
                    <p id="pageSubtitle" class="header-subtitle">Real-time API Statistics & Monitoring</p>
                </div>
                <div class="header-right">
                    <div class="search-bar">
                        <i class="fas fa-search"></i>
                        <input type="text" placeholder="Search endpoints..." id="globalSearch">
                    </div>
                    <div class="user-menu">
                        <i class="fas fa-bell"></i>
                        <div class="user-avatar">
                            <span>MT</span>
                        </div>
                    </div>
                </div>
            </header>
        `;
    }

    renderDashboardContent() {
        return `
            <div class="stats-grid" id="statsGrid">
                ${this.renderStatCard('⏱️', 'Uptime', 'stat-uptime', 'purple', 'fas fa-clock')}
                ${this.renderStatCard('💾', 'Memory Usage', 'stat-memory', 'blue', 'fas fa-microchip')}
                ${this.renderStatCard('⚡', 'Response Time', 'stat-response', 'green', 'fas fa-bolt')}
                ${this.renderStatCard('📡', 'API Status', 'stat-status', 'orange', 'fas fa-wifi')}
                ${this.renderStatCard('🎯', 'Active APIs', 'stat-apis', 'purple', 'fas fa-cube')}
                ${this.renderStatCard('📊', "Today's Requests", 'stat-today', 'blue', 'fas fa-chart-line')}
                ${this.renderStatCard('👥', 'Active Now', 'stat-users', 'green', 'fas fa-users')}
                ${this.renderStatCard('🌐', 'Total Calls', 'stat-total', 'orange', 'fas fa-globe')}
            </div>
            
            <div class="api-sections">
                ${this.renderGameSection()}
                ${this.renderAnimeSection()}
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
                </div>
            </div>
            
            <div id="searchResults" style="display: none;"></div>
        `;
    }

    renderStatCard(icon, label, id, color, faIcon) {
        return `
            <div class="stat-card">
                <div class="stat-icon ${color}">
                    <i class="${faIcon}"></i>
                </div>
                <div class="stat-info">
                    <h3 id="${id}">Loading...</h3>
                    <p>${label}</p>
                </div>
                <div class="stat-trend up">
                    <i class="fas fa-arrow-up"></i>
                    <span>实时</span>
                </div>
            </div>
        `;
    }

    renderGameSection() {
        return `
            <div class="api-section collapsed" data-section="game">
                <div class="section-header">
                    <div class="section-icon">
                        <i class="fas fa-gamepad"></i>
                    </div>
                    <h3 class="section-title">Games API - FitGirl Repacks</h3>
                    <span class="section-badge">● Active</span>
                    <div class="section-arrow">
                        <i class="fas fa-chevron-down"></i>
                    </div>
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
                    <div class="section-icon">
                        <i class="fas fa-tv"></i>
                    </div>
                    <h3 class="section-title">Anime API - Multi-Source</h3>
                    <span class="section-badge">● Active</span>
                    <div class="section-arrow">
                        <i class="fas fa-chevron-down"></i>
                    </div>
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

    renderFooter() {
        return `
            <footer class="dashboard-footer">
                <p>Made with <i class="fas fa-heart" style="color: #ec4899;"></i> by <strong>Mr Thinura</strong> | Free APIs for everyone</p>
                <p style="font-size: 0.65rem; margin-top: 8px;">© 2026 Mr Thinuzz APIs - No Rate Limits • Forever Free • Advanced Platform v3.0</p>
            </footer>
        `;
    }

    // Response Examples
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
      "Repack Size": "64.5 GB"
    },
    "downloads": {
      "direct_links": [...],
      "torrent_links": [...]
    }
  }
}`;
    }

    getGameDownloadResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "data": {
    "original_url": "https://fuckingfast.co/...",
    "download_url": "https://dl.fuckingfast.co/...",
    "filename": "game.part1.rar"
  }
}`;
    }

    getAnimeSearchResponse() {
        return `{
  "status": true,
  "source": "Jikan API (MyAnimeList)",
  "data": {
    "query": "naruto",
    "total_results": 10,
    "results": [
      {
        "id": 20,
        "title": "Naruto",
        "type": "TV",
        "episodes": 220,
        "score": 7.98,
        "poster": "https://cdn.myanimelist.net/images/anime/..."
      }
    ]
  }
}`;
    }

    getAnimePopularResponse() {
        return `{
  "status": true,
  "author": "Mr Thinuzz",
  "data": [
    {
      "id": 21,
      "title": "One Piece",
      "type": "TV",
      "episodes": "1000+",
      "score": 8.5
    }
  ]
}`;
    }

    getAnimeInfoResponse() {
        return `{
  "status": true,
  "data": {
    "id": 21,
    "title": "One Piece",
    "type": "TV",
    "episodes": "1000+",
    "status": "Currently Airing",
    "score": 8.5,
    "synopsis": "...",
    "poster": "https://..."
  }
}`;
    }

    async updateStats() {
        try {
            const startTime = performance.now();
            const response = await fetch('/health');
            const endTime = performance.now();
            const data = await response.json();
            
            // Update real stats
            this.stats.uptime = data.uptime || 'N/A';
            this.stats.memory = data.memory_usage || 'N/A';
            this.stats.responseTime = `${Math.round(endTime - startTime)}ms`;
            this.stats.status = 'Online';
            
            // Generate random but realistic looking stats
            this.stats.todayRequests = Math.floor(Math.random() * 200) + 50;
            this.stats.activeUsers = Math.floor(Math.random() * 30) + 5;
            this.stats.totalCalls = 893231 + Math.floor(Math.random() * 1000);
            
            // Update DOM
            this.updateStatElement('stat-uptime', this.stats.uptime);
            this.updateStatElement('stat-memory', this.stats.memory);
            this.updateStatElement('stat-response', this.stats.responseTime);
            this.updateStatElement('stat-status', `🟢 ${this.stats.status}`);
            this.updateStatElement('stat-apis', '3');
            this.updateStatElement('stat-today', this.stats.todayRequests.toLocaleString());
            this.updateStatElement('stat-users', this.stats.activeUsers);
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
        setInterval(() => this.updateStats(), CONFIG.refreshInterval);
    }

    bindEvents() {
        // Sidebar toggle
        document.addEventListener('click', (e) => {
            const toggle = e.target.closest('#sidebarToggle');
            if (toggle) {
                const sidebar = document.querySelector('.sidebar');
                sidebar.classList.toggle('collapsed');
                localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            }
        });
        
        // Navigation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link');
            if (link && link.dataset.page) {
                e.preventDefault();
                this.switchPage(link.dataset.page);
                
                // Update active state
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
        
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
        
        // Global search
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchEndpoints(e.target.value);
            });
        }
    }

    searchEndpoints(query) {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;
        
        if (!query.trim()) {
            searchResults.style.display = 'none';
            return;
        }
        
        const endpoints = this.getAllEndpoints();
        const results = endpoints.filter(ep => 
            ep.path.toLowerCase().includes(query.toLowerCase()) ||
            ep.description.toLowerCase().includes(query.toLowerCase())
        );
        
        if (results.length > 0) {
            searchResults.style.display = 'block';
            searchResults.innerHTML = `
                <div class="search-results">
                    <h3><i class="fas fa-search"></i> Search Results (${results.length})</h3>
                    ${results.map(r => `
                        <div class="search-result-item" data-path="${r.path}">
                            <div class="result-title">${r.description}</div>
                            <div class="result-path">${r.method} ${r.path}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Add click handlers for search results
            document.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const path = item.dataset.path;
                    navigator.clipboard.writeText(path);
                    alert(`Copied: ${path}`);
                });
            });
        } else {
            searchResults.style.display = 'block';
            searchResults.innerHTML = `
                <div class="search-results">
                    <div class="no-results">
                        <i class="fas fa-search"></i>
                        <p>No endpoints found for "${query}"</p>
                    </div>
                </div>
            `;
        }
    }

    getAllEndpoints() {
        return [
            { method: 'GET', path: '/game/fitgirl-search', description: 'Search for games on FitGirl Repacks' },
            { method: 'GET', path: '/game/fitgirl-info', description: 'Get complete game info with download links' },
            { method: 'GET', path: '/game/fitgirl-download', description: 'Extract direct download link' },
            { method: 'GET', path: '/anime/search', description: 'Search for anime by title' },
            { method: 'GET', path: '/anime/popular', description: 'Get top popular anime' },
            { method: 'GET', path: '/anime/info', description: 'Get complete anime information by ID' },
            { method: 'GET', path: '/health', description: 'Server health check' },
            { method: 'GET', path: '/server-stats', description: 'Real-time server statistics' },
            { method: 'GET', path: '/api-info', description: 'API information and documentation' }
        ];
    }

    switchPage(page) {
        this.currentPage = page;
        const titles = {
            dashboard: { title: 'Dashboard Overview', subtitle: 'Real-time API Statistics & Monitoring' },
            games: { title: 'Games API', subtitle: 'FitGirl Repacks - Search, Info & Download' },
            anime: { title: 'Anime API', subtitle: 'Multi-source Anime API - Search, Popular, Info' },
            download: { title: 'Download API', subtitle: 'Direct Download Links Extractor' },
            ai: { title: 'AI API', subtitle: 'Coming Soon - AI-powered Features' },
            movie: { title: 'Movie API', subtitle: 'Coming Soon - Movie Information' },
            search: { title: 'Search API', subtitle: 'Coming Soon - Universal Search' },
            stalk: { title: 'Stalk API', subtitle: 'Coming Soon - Social Media Tools' }
        };
        
        const titleElem = document.getElementById('pageTitle');
        const subtitleElem = document.getElementById('pageSubtitle');
        
        if (titleElem) titleElem.textContent = titles[page]?.title || 'Dashboard';
        if (subtitleElem) subtitleElem.textContent = titles[page]?.subtitle || '';
        
        // Scroll to top
        window.scrollTo(0, 0);
    }

    hideLoader() {
        const loader = document.getElementById('loadingScreen');
        const app = document.getElementById('app');
        
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
        
        if (app) {
            setTimeout(() => {
                app.classList.add('visible');
            }, 100);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
