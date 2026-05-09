/**
 * MR THINUZZ ADVANCED DASHBOARD
 * Version: 3.0.0
 * Fully Dynamic - Fixed Version
 */

class Dashboard {
    constructor() {
        this.currentPage = 'dashboard';
        this.stats = {
            uptime: 'Loading...',
            memory: 'Loading...',
            responseTime: 'Loading...',
            status: 'Online',
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
        return new Promise((resolve) => {
            // Check if styles already loaded
            if (document.querySelector('link[href="/css/dashboard.css"]')) {
                resolve();
                return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/dashboard.css';
            link.onload = () => resolve();
            link.onerror = () => resolve(); // Continue even if CSS fails
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
        
        // Add search results container after content wrapper
        const contentWrapper = document.getElementById('contentWrapper');
        if (contentWrapper && !document.getElementById('searchResultsContainer')) {
            const searchContainer = document.createElement('div');
            searchContainer.id = 'searchResultsContainer';
            contentWrapper.parentNode.insertBefore(searchContainer, contentWrapper.nextSibling);
        }
        
        // Check for collapsed state
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
                        <i class="fas fa
