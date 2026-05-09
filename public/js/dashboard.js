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
                        ${this.renderEndpointCard('GET', '/anime/search', 'Search for anime by title (Multi-source fallback)',
