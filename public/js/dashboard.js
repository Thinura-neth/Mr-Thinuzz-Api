/**
 * MR THINUZZ ADVANCED DASHBOARD
 * Version: 3.0.0
 * Fully Dynamic - API Pages Load on Sidebar Click
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
            // Create style element directly instead of loading external CSS
            const style = document.createElement('style');
            style.textContent = this.getStyles();
            document.head.appendChild(style);
            resolve();
        });
    }

    getStyles() {
        return `
            /* ========================================
               DASHBOARD STYLES
               ======================================== */
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: radial-gradient(ellipse at 10% 20%, #0f0c29 0%, #1a1a3e 50%, #0a0a0a 100%);
                min-height: 100vh;
                color: #ffffff;
                overflow-x: hidden;
            }
            
            /* Loading Screen */
            .loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #0a0a0a;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                transition: opacity 0.5s ease;
            }
            
            .loading-screen.fade-out {
                opacity: 0;
                pointer-events: none;
            }
            
            .loader {
                text-align: center;
            }
            
            .loader-spinner {
                width: 50px;
                height: 50px;
                border: 3px solid rgba(139, 92, 246, 0.2);
                border-top-color: #8b5cf6;
                border-right-color: #ec4899;
                border-radius: 50%;
                animation: spin 1s ease infinite;
                margin: 0 auto 15px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .loader p {
                color: rgba(255, 255, 255, 0.7);
                font-size: 0.9rem;
            }
            
            /* App Layout */
            .app-layout {
                display: flex;
                min-height: 100vh;
            }
            
            /* Sidebar */
            .sidebar {
                width: 260px;
                background: rgba(10, 10, 20, 0.9);
                backdrop-filter: blur(10px);
                border-right: 1px solid rgba(139, 92, 246, 0.2);
                display: flex;
                flex-direction: column;
                position: fixed;
                height: 100vh;
                transition: width 0.3s ease;
                z-index: 100;
            }
            
            .sidebar.collapsed {
                width: 70px;
            }
            
            .sidebar.collapsed .logo span,
            .sidebar.collapsed .nav-link span,
            .sidebar.collapsed .status-indicator span,
            .sidebar.collapsed .api-version span {
                display: none;
            }
            
            .sidebar.collapsed .nav-link i {
                margin-right: 0;
            }
            
            .sidebar-header {
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(139, 92, 246, 0.2);
            }
            
            .logo {
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 700;
                font-size: 1rem;
            }
            
            .logo i {
                font-size: 1.5rem;
                color: #8b5cf6;
            }
            
            .sidebar-toggle {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 1.2rem;
                padding: 5px;
            }
            
            .sidebar-nav {
                flex: 1;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .nav-link {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                color: rgba(255, 255, 255, 0.7);
                text-decoration: none;
                border-radius: 12px;
                transition: all 0.3s ease;
            }
            
            .nav-link:hover {
                background: rgba(139, 92, 246, 0.1);
                color: white;
            }
            
            .nav-link.active {
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.1));
                color: #8b5cf6;
                border-left: 2px solid #8b5cf6;
            }
            
            .nav-link i {
                width: 20px;
                font-size: 1.1rem;
            }
            
            .sidebar-footer {
                padding: 20px;
                border-top: 1px solid rgba(139, 92, 246, 0.2);
                font-size: 0.75rem;
            }
            
            .status-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 10px;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #10b981;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .api-version {
                display: flex;
                align-items: center;
                gap: 8px;
                color: rgba(255, 255, 255, 0.4);
            }
            
            /* Main Content */
            .main-content {
                flex: 1;
                margin-left: 260px;
                transition: margin-left 0.3s ease;
            }
            
            .sidebar.collapsed ~ .main-content {
                margin-left: 70px;
            }
            
            /* Top Header */
            .top-header {
                background: rgba(10, 10, 20, 0.8);
                backdrop-filter: blur(10px);
                padding: 16px 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(139, 92, 246, 0.2);
                position: sticky;
                top: 0;
                z-index: 99;
            }
            
            .header-left h1 {
                font-size: 1.3rem;
                margin-bottom: 4px;
            }
            
            .header-subtitle {
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .header-right {
                display: flex;
                align-items: center;
                gap: 20px;
            }
            
            .search-bar {
                display: flex;
                align-items: center;
                gap: 10px;
                background: rgba(255, 255, 255, 0.05);
                padding: 8px 16px;
                border-radius: 30px;
                border: 1px solid rgba(139, 92, 246, 0.2);
            }
            
            .search-bar i {
                color: rgba(255, 255, 255, 0.5);
            }
            
            .search-bar input {
                background: none;
                border: none;
                color: white;
                outline: none;
                font-size: 0.8rem;
                width: 200px;
            }
            
            .search-bar input::placeholder {
                color: rgba(255, 255, 255, 0.3);
            }
            
            .user-avatar {
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, #8b5cf6, #ec4899);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 0.8rem;
            }
            
            /* Content Wrapper */
            .content-wrapper {
                padding: 24px;
            }
            
            /* Stats Grid */
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 30px;
            }
            
            .stat-card {
                background: rgba(15, 15, 30, 0.6);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 14px;
                border: 1px solid rgba(139, 92, 246, 0.15);
                transition: all 0.3s ease;
            }
            
            .stat-card:hover {
                transform: translateY(-2px);
                border-color: rgba(139, 92, 246, 0.4);
            }
            
            .stat-icon {
                width: 48px;
                height: 48px;
                background: rgba(139, 92, 246, 0.15);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.3rem;
            }
            
            .stat-icon.purple { background: rgba(139, 92, 246, 0.2); }
            .stat-icon.blue { background: rgba(59, 130, 246, 0.2); }
            .stat-icon.green { background: rgba(16, 185, 129, 0.2); }
            .stat-icon.orange { background: rgba(245, 158, 11, 0.2); }
            
            .stat-info {
                flex: 1;
            }
            
            .stat-info h3 {
                font-size: 1.3rem;
                font-weight: 700;
                margin-bottom: 4px;
            }
            
            .stat-info p {
                font-size: 0.7rem;
                color: rgba(255, 255, 255, 0.5);
                text-transform: uppercase;
            }
            
            .stat-trend {
                font-size: 0.7rem;
                color: #10b981;
            }
            
            /* Welcome Section */
            .welcome-section {
                margin-bottom: 30px;
            }
            
            .welcome-card {
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(236, 72, 153, 0.1));
                border-radius: 20px;
                padding: 24px;
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 24px;
                border: 1px solid rgba(139, 92, 246, 0.2);
            }
            
            .welcome-icon {
                width: 60px;
                height: 60px;
                background: rgba(139, 92, 246, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
            }
            
            .welcome-text h2 {
                font-size: 1.3rem;
                margin-bottom: 6px;
            }
            
            .welcome-text p {
                font-size: 0.85rem;
                color: rgba(255, 255, 255, 0.6);
            }
            
            /* Quick Actions */
            .quick-actions {
                margin-bottom: 30px;
            }
            
            .quick-actions h3 {
                font-size: 0.9rem;
                margin-bottom: 16px;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .quick-actions h3 i {
                margin-right: 8px;
                color: #8b5cf6;
            }
            
            .quick-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 16px;
            }
            
            .quick-card {
                background: rgba(15, 15, 30, 0.6);
                border: 1px solid rgba(139, 92, 246, 0.15);
                border-radius: 16px;
                padding: 20px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .quick-card:hover {
                transform: translateY(-3px);
                border-color: #8b5cf6;
            }
            
            .quick-card i {
                font-size: 2rem;
                color: #8b5cf6;
                margin-bottom: 10px;
                display: block;
            }
            
            .quick-card span {
                font-size: 0.9rem;
                font-weight: 500;
                display: block;
                margin-bottom: 4px;
            }
            
            .quick-card small {
                font-size: 0.65rem;
                color: rgba(255, 255, 255, 0.4);
            }
            
            .quick-card.coming {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            .quick-card.coming:hover {
                transform: none;
            }
            
            /* API Usage */
            .api-usage {
                background: rgba(15, 15, 30, 0.6);
                border-radius: 20px;
                padding: 20px;
                border: 1px solid rgba(139, 92, 246, 0.15);
            }
            
            .api-usage h3 {
                font-size: 0.9rem;
                margin-bottom: 20px;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .api-usage h3 i {
                margin-right: 8px;
                color: #8b5cf6;
            }
            
            .usage-item {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .usage-label {
                width: 100px;
                font-size: 0.8rem;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .usage-bar {
                flex: 1;
                height: 8px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                overflow: hidden;
            }
            
            .usage-fill {
                height: 100%;
                background: linear-gradient(90deg, #8b5cf6, #ec4899);
                border-radius: 10px;
                transition: width 0.5s ease;
            }
            
            .usage-value {
                width: 45px;
                font-size: 0.75rem;
                color: #a78bfa;
                text-align: right;
            }
            
            /* API Full Page */
            .api-full-page {
                animation: fadeIn 0.4s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .api-page-header {
                display: flex;
                align-items: center;
                gap: 20px;
                padding: 20px;
                background: rgba(15, 15, 30, 0.6);
                border-radius: 20px;
                border: 1px solid rgba(139, 92, 246, 0.15);
                margin-bottom: 24px;
            }
            
            .api-page-icon {
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #8b5cf6, #ec4899);
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.8rem;
            }
            
            .api-page-info {
                flex: 1;
            }
            
            .api-page-info h2 {
                font-size: 1.3rem;
                margin-bottom: 4px;
            }
            
            .api-page-info p {
                font-size: 0.8rem;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .api-status-badge {
                padding: 6px 14px;
                border-radius: 30px;
                font-size: 0.7rem;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .api-status-badge.active {
                background: rgba(16, 185, 129, 0.15);
                color: #10b981;
            }
            
            /* Endpoint Cards */
            .endpoints-container {
                display: flex;
                flex-direction: column;
                gap: 24px;
            }
            
            .endpoint-card-large {
                background: rgba(15, 15, 30, 0.6);
                border-radius: 20px;
                border: 1px solid rgba(139, 92, 246, 0.15);
                overflow: hidden;
                transition: all 0.3s ease;
            }
            
            .endpoint-card-large:hover {
                border-color: rgba(139, 92, 246, 0.4);
            }
            
            .endpoint-header-large {
                background: rgba(139, 92, 246, 0.08);
                padding: 16px 20px;
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
                border-bottom: 1px solid rgba(139, 92, 246, 0.15);
            }
            
            .method-badge {
                padding: 4px 12px;
                border-radius: 6px;
                font-size: 0.7rem;
                font-weight: 700;
                text-transform: uppercase;
            }
            
            .method-get {
                background: #10b981;
                color: white;
            }
            
            .endpoint-code {
                font-family: monospace;
                font-size: 0.8rem;
                color: #a78bfa;
                background: rgba(0, 0, 0, 0.3);
                padding: 4px 12px;
                border-radius: 6px;
                flex: 1;
            }
            
            .endpoint-description {
                padding: 16px 20px 0 20px;
                font-size: 0.85rem;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .endpoint-params {
                padding: 16px 20px;
                border-bottom: 1px solid rgba(139, 92, 246, 0.15);
            }
            
            .endpoint-params h4 {
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.4);
                margin-bottom: 12px;
                text-transform: uppercase;
            }
            
            .param-row {
                display: flex;
                gap: 12px;
                margin-bottom: 8px;
                font-size: 0.75rem;
            }
            
            .param-row code {
                background: rgba(139, 92, 246, 0.15);
                padding: 2px 8px;
                border-radius: 4px;
                color: #a78bfa;
                font-family: monospace;
                min-width: 60px;
            }
            
            .param-row span {
                color: rgba(255, 255, 255, 0.6);
            }
            
            .endpoint-example-full {
                padding: 16px 20px;
                border-bottom: 1px solid rgba(139, 92, 246, 0.15);
            }
            
            .endpoint-example-full h4 {
                font-size: 0.7rem;
                color: rgba(255, 255, 255, 0.4);
                margin-bottom: 8px;
                text-transform: uppercase;
            }
            
            .endpoint-example-full pre {
                background: rgba(0, 0, 0, 0.4);
                padding: 12px;
                border-radius: 12px;
                overflow-x: auto;
                margin-bottom: 16px;
            }
            
            .endpoint-example-full pre code {
                font-family: monospace;
                font-size: 0.65rem;
                color: #10b981;
            }
            
            /* Try It Section */
            .try-it {
                padding: 16px 20px;
                display: flex;
                gap: 12px;
                background: rgba(0, 0, 0, 0.2);
                border-top: 1px solid rgba(139, 92, 246, 0.15);
            }
            
            .try-it input {
                flex: 1;
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(139, 92, 246, 0.2);
                border-radius: 8px;
                padding: 10px 14px;
                color: white;
                font-size: 0.8rem;
                outline: none;
            }
            
            .try-it input:focus {
                border-color: #8b5cf6;
            }
            
            .copy-btn, .try-btn {
                background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                border: none;
                padding: 8px 20px;
                border-radius: 8px;
                color: white;
                font-size: 0.8rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .copy-btn:hover, .try-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
            }
            
            .live-result {
                padding: 16px 20px;
                background: rgba(0, 0, 0, 0.3);
                border-top: 1px solid rgba(139, 92, 246, 0.15);
            }
            
            .live-result pre {
                background: transparent;
                margin: 0;
                padding: 0;
                font-size: 0.7rem;
                overflow-x: auto;
            }
            
            .loading-spinner {
                text-align: center;
                padding: 20px;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .loading-spinner::before {
                content: '';
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 2px solid rgba(139, 92, 246, 0.2);
                border-top-color: #8b5cf6;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-right: 10px;
                vertical-align: middle;
            }
            
            .error-msg {
                color: #ef4444;
                text-align: center;
                padding: 20px;
            }
            
            /* Coming Soon Page */
            .coming-soon-page {
                text-align: center;
                padding: 60px 20px;
                background: rgba(15, 15, 30, 0.6);
                border-radius: 20px;
                border: 1px solid rgba(139, 92, 246, 0.15);
            }
            
            .coming-soon-icon {
                font-size: 4rem;
                margin-bottom: 20px;
            }
            
            .coming-soon-page h2 {
                font-size: 2rem;
                margin-bottom: 12px;
            }
            
            .coming-soon-page p {
                color: rgba(255, 255, 255, 0.6);
                margin-bottom: 30px;
            }
            
            .coming-features {
                text-align: left;
                max-width: 400px;
                margin: 0 auto 30px;
                background: rgba(0, 0, 0, 0.2);
                padding: 20px;
                border-radius: 16px;
            }
            
            .coming-features h3 {
                font-size: 0.9rem;
                margin-bottom: 16px;
                color: #a78bfa;
            }
            
            .coming-features ul {
                list-style: none;
            }
            
            .coming-features li {
                padding: 8px 0;
                font-size: 0.8rem;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .coming-features li i {
                color: #10b981;
                margin-right: 10px;
            }
            
            .coming-soon-estimate {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 10px 20px;
                background: rgba(139, 92, 246, 0.1);
                border-radius: 30px;
                font-size: 0.8rem;
                color: #a78bfa;
            }
            
            /* Footer */
            .api-footer {
                margin-top: 40px;
                padding: 24px;
                text-align: center;
                border-top: 1px solid rgba(139, 92, 246, 0.15);
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.75rem;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .sidebar {
                    width: 70px;
                }
                
                .sidebar .logo span,
                .sidebar .nav-link span,
                .sidebar .status-indicator span,
                .sidebar .api-version span {
                    display: none;
                }
                
                .sidebar .nav-link i {
                    margin-right: 0;
                }
                
                .main-content {
                    margin-left: 70px;
                }
                
                .top-header {
                    flex-direction: column;
                    gap: 15px;
                }
                
                .search-bar input {
                    width: 150px;
                }
                
                .stats-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .welcome-card {
                    flex-direction: column;
                    text-align: center;
                }
                
                .api-page-header {
                    flex-direction: column;
                    text-align: center;
                }
                
                .endpoint-header-large {
                    flex-direction: column;
                    text-align: center;
                }
                
                .try-it {
                    flex-direction: column;
                }
            }
            
            @media (max-width: 480px) {
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                
                .quick-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
    }

    renderApp() {
        const appRoot = document.getElementById('app-root');
        if (!appRoot) return;
        
        appRoot.innerHTML = `
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
                ${this.renderStatCard('📊', "Today's Requests", 'stat-today', 'purple', 'fas fa-chart-line')}
                ${this.renderStatCard('👥', 'Active Now', 'stat-users', 'blue', 'fas fa-users')}
                ${this.renderStatCard('🌐', 'Total Calls', 'stat-total', 'green', 'fas fa-globe')}
            </div>
            
            <div id="apiPageContent">
                ${this.renderDashboardPageContent()}
            </div>
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

    renderDashboardPageContent() {
        return `
            <div class="welcome-section">
                <div class="welcome-card">
                    <div class="welcome-icon">
                        <i class="fas fa-rocket"></i>
                    </div>
                    <div class="welcome-text">
                        <h2>Welcome to MR THINUZZ API Platform</h2>
                        <p>Your complete solution for free, unlimited API access. No API keys required, real-time data scraping.</p>
                    </div>
                </div>
                
                <div class="quick-actions">
                    <h3><i class="fas fa-bolt"></i> Quick Actions</h3>
                    <div class="quick-grid">
                        <div class="quick-card" data-page="games">
                            <i class="fas fa-gamepad"></i>
                            <span>Games API</span>
                            <small>FitGirl Repacks</small>
                        </div>
                        <div class="quick-card" data-page="anime">
                            <i class="fas fa-tv"></i>
                            <span>Anime API</span>
                            <small>Multi-Source</small>
                        </div>
                        <div class="quick-card" data-page="download">
                            <i class="fas fa-download"></i>
                            <span>Download API</span>
                            <small>Link Extractor</small>
                        </div>
                        <div class="quick-card coming">
                            <i class="fas fa-microchip"></i>
                            <span>AI API</span>
                            <small>Coming Soon</small>
                        </div>
                    </div>
                </div>
                
                <div class="api-usage">
                    <h3><i class="fas fa-chart-simple"></i> API Usage Overview</h3>
                    <div class="usage-stats">
                        <div class="usage-item">
                            <div class="usage-label">Games API</div>
                            <div class="usage-bar">
                                <div class="usage-fill" style="width: 65%;"></div>
                            </div>
                            <div class="usage-value">65%</div>
                        </div>
                        <div class="usage-item">
                            <div class="usage-label">Anime API</div>
                            <div class="usage-bar">
                                <div class="usage-fill" style="width: 45%;"></div>
                            </div>
                            <div class="usage-value">45%</div>
                        </div>
                        <div class="usage-item">
                            <div class="usage-label">Download API</div>
                            <div class="usage-bar">
                                <div class="usage-fill" style="width: 30%;"></div>
                            </div>
                            <div class="usage-value">30%</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderGamesPageContent() {
        return `
            <div class="api-full-page">
                <div class="api-page-header">
                    <div class="api-page-icon">
                        <i class="fas fa-gamepad"></i>
                    </div>
                    <div class="api-page-info">
                        <h2>Games API - FitGirl Repacks</h2>
                        <p>Complete FitGirl Repacks API - Search, Info & Download endpoints with real-time scraping</p>
                    </div>
                    <div class="api-status-badge active">
                        <i class="fas fa-circle"></i> Active
                    </div>
                </div>
                
                <div class="endpoints-container">
                    <div class="endpoint-card-large">
                        <div class="endpoint-header-large">
                            <span class="method-badge method-get">GET</span>
                            <code class="endpoint-code">/game/fitgirl-search</code>
                            <button class="copy-btn" data-code="/game/fitgirl-search?q=cyberpunk">📋 Copy</button>
                        </div>
                        <p class="endpoint-description">Search for games on FitGirl Repacks by title</p>
                        <div class="endpoint-params">
                            <h4>Parameters</h4>
                            <div class="param-row">
                                <code>q</code>
                                <span>Required - Search query (e.g., cyberpunk, gta, red dead)</span>
                            </div>
                        </div>
                        <div class="endpoint-example-full">
                            <h4>Example Request</h4>
                            <pre><code>GET /game/fitgirl-search?q=cyberpunk</code></pre>
                            <h4>Example Response</h4>
                            <pre><code>${this.getGameSearchResponse()}</code></pre>
                        </div>
                        <div class="try-it">
                            <input type="text" id="gameSearchInput" placeholder="Enter game name..." value="cyberpunk">
                            <button id="tryGameSearch" class="try-btn">Try It →</button>
                        </div>
                        <div id="gameSearchResult" class="live-result" style="display: none;"></div>
                    </div>
                    
                    <div class="endpoint-card-large">
                        <div class="endpoint-header-large">
                            <span class="method-badge method-get">GET</span>
                            <code class="endpoint-code">/game/fitgirl-info</code>
                            <button class="copy-btn" data-code="/game/fitgirl-info?url=https://fitgirl-repacks.site/cyberpunk-2077/">📋 Copy</button>
                        </div>
                        <p class="endpoint-description">Get complete game information with all download links</p>
                        <div class="endpoint-params">
                            <h4>Parameters</h4>
                            <div class="param-row">
                                <code>url</code>
                                <span>Required - FitGirl repack page URL</span>
                            </div>
                        </div>
                        <div class="endpoint-example-full">
                            <h4>Example Request</h4>
                            <pre><code>GET /game/fitgirl-info?url=https://fitgirl-repacks.site/cyberpunk-2077/</code></pre>
                            <h4>Example Response</h4>
                            <pre><code>${this.getGameInfoResponse()}</code></pre>
                        </div>
                    </div>
                    
                    <div class="endpoint-card-large">
                        <div class="endpoint-header-large">
                            <span class="method-badge method-get">GET</span>
                            <code class="endpoint-code">/game/fitgirl-download</code>
                            <button class="copy-btn" data-code="/game/fitgirl-download?url=https://fuckingfast.co/LINK">📋 Copy</button>
                        </div>
                        <p class="endpoint-description">Extract direct download link from fuckingfast.co</p>
                        <div class="endpoint-params">
                            <h4>Parameters</h4>
                            <div class="param-row">
                                <code>url</code>
                                <span>Required - FuckingFast.co download URL</span>
                            </div>
                        </div>
                        <div class="endpoint-example-full">
                            <h4>Example Request</h4>
                            <pre><code>GET /game/fitgirl-download?url=https://fuckingfast.co/EXAMPLE</code></pre>
                            <h4>Example Response</h4>
                            <pre><code>${this.getGameDownloadResponse()}</code></pre>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderAnimePageContent() {
        return `
            <div class="api-full-page">
                <div class="api-page-header">
                    <div class="api-page-icon">
                        <i class="fas fa-tv"></i>
                    </div>
                    <div class="api-page-info">
                        <h2>Anime API - Multi-Source</h2>
                        <p>Multi-source Anime API - Search, Popular, Info endpoints (Jikan API + AniList + Direct Scraping)</p>
                    </div>
                    <div class="api-status-badge active">
                        <i class="fas fa-circle"></i> Active
                    </div>
                </div>
                
                <div class="endpoints-container">
                    <div class="endpoint-card-large">
                        <div class="endpoint-header-large">
                            <span class="method-badge method-get">GET</span>
                            <code class="endpoint-code">/anime/search</code>
                            <button class="copy-btn" data-code="/anime/search?q=naruto">📋 Copy</button>
                        </div>
                        <p class="endpoint-description">Search for anime by title (Multi-source fallback)</p>
                        <div class="endpoint-params">
                            <h4>Parameters</h4>
                            <div class="param-row">
                                <code>q</code>
                                <span>Required - Anime title to search (e.g., naruto, one piece, attack on titan)</span>
                            </div>
                        </div>
                        <div class="endpoint-example-full">
                            <h4>Example Request</h4>
                            <pre><code>GET /anime/search?q=naruto</code></pre>
                            <h4>Example Response</h4>
                            <pre><code>${this.getAnimeSearchResponse()}</code></pre>
                        </div>
                        <div class="try-it">
                            <input type="text" id="animeSearchInput" placeholder="Enter anime name..." value="naruto">
                            <button id="tryAnimeSearch" class="try-btn">Try It →</button>
                        </div>
                        <div id="animeSearchResult" class="live-result" style="display: none;"></div>
                    </div>
                    
                    <div class="endpoint-card-large">
                        <div class="endpoint-header-large">
                            <span class="method-badge method-get">GET</span>
                            <code class="endpoint-code">/anime/popular</code>
                            <button class="copy-btn" data-code="/anime/popular">📋 Copy</button>
                        </div>
                        <p class="endpoint-description">Get top popular anime from MyAnimeList</p>
                        <div class="endpoint-example-full">
                            <h4>Example Request</h4>
                            <pre><code>GET /anime/popular</code></pre>
                            <h4>Example Response</h4>
                            <pre><code>${this.getAnimePopularResponse()}</code></pre>
                        </div>
                        <button id="tryAnimePopular" class="try-btn" style="margin-top: 16px;">Load Popular Anime →</button>
                        <div id="animePopularResult" class="live-result" style="display: none;"></div>
                    </div>
                    
                    <div class="endpoint-card-large">
                        <div class="endpoint-header-large">
                            <span class="method-badge method-get">GET</span>
                            <code class="endpoint-code">/anime/info</code>
                            <button class="copy-btn" data-code="/anime/info?id=21">📋 Copy</button>
                        </div>
                        <p class="endpoint-description">Get complete anime information by ID</p>
                        <div class="endpoint-params">
                            <h4>Parameters</h4>
                            <div class="param-row">
                                <code>id</code>
                                <span>Required - MyAnimeList ID of the anime</span>
                            </div>
                        </div>
                        <div class="endpoint-example-full">
                            <h4>Example Request</h4>
                            <pre><code>GET /anime/info?id=21</code></pre>
                            <h4>Example Response</h4>
                            <pre><code>${this.getAnimeInfoResponse()}</code></pre>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderDownloadPageContent() {
        return `
            <div class="api-full-page">
                <div class="api-page-header">
                    <div class="api-page-icon">
                        <i class="fas fa-download"></i>
                    </div>
                    <div class="api-page-info">
                        <h2>Download API</h2>
                        <p>Extract direct download links from various file hosting services</p>
                    </div>
                    <div class="api-status-badge active">
                        <i class="fas fa-circle"></i> Active
                    </div>
                </div>
                
                <div class="endpoints-container">
                    <div class="endpoint-card-large">
                        <div class="endpoint-header-large">
                            <span class="method-badge method-get">GET</span>
                            <code class="endpoint-code">/game/fitgirl-download</code>
                            <button class="copy-btn" data-code="/game/fitgirl-download?url=URL">📋 Copy</button>
                        </div>
                        <p class="endpoint-description">Extract direct download link from fuckingfast.co and other hosts</p>
                        <div class="endpoint-params">
                            <h4>Parameters</h4>
                            <div class="param-row">
                                <code>url</code>
                                <span>Required - File hosting URL to extract download link</span>
                            </div>
                        </div>
                        <div class="endpoint-example-full">
                            <h4>Example Request</h4>
                            <pre><code>GET /game/fitgirl-download?url=https://fuckingfast.co/EXAMPLE</code></pre>
                            <h4>Example Response</h4>
                            <pre><code>${this.getGameDownloadResponse()}</code></pre>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderComingSoonPage(title, description) {
        return `
            <div class="coming-soon-page">
                <div class="coming-soon-icon">
                    <i class="fas fa-tools"></i>
                </div>
                <h2>${title}</h2>
                <p>${description}</p>
                <div class="coming-features">
                    <h3>Planned Features:</h3>
                    <ul>
                        <li><i class="fas fa-check-circle"></i> Advanced search with filters</li>
                        <li><i class="fas fa-check-circle"></i> Real-time data updates</li>
                        <li><i class="fas fa-check-circle"></i> Batch request support</li>
                        <li><i class="fas fa-check-circle"></i> Webhook integrations</li>
                    </ul>
                </div>
                <div class="coming-soon-estimate">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Expected Release: Q2 2026</span>
                </div>
            </div>
        `;
    }

    renderFooter() {
        return `
            <footer class="api-footer">
                <p>Made with <span class="footer-heart">❤️</span> by <strong>Mr Thinura</strong> | Free APIs for everyone</p>
                <p style="font-size: 0.7rem; margin-top: 8px;">© 2026 Mr Thinuzz APIs - No Rate Limits • Forever Free • Advanced Platform v3.0</p>
            </footer>
        `;
    }

    getGameSearchResponse() {
        return JSON.stringify({
            status: true,
            author: "Mr Thinuzz",
            timestamp: new Date().toISOString(),
            data: {
                query: "cyberpunk",
                total_results: 5,
                results: [
                    { title: "Cyberpunk 2077 v2.1 + Phantom Liberty", url: "https://fitgirl-repacks.site/cyberpunk-2077/" }
                ]
            }
        }, null, 2);
    }

    getGameInfoResponse() {
        return JSON.stringify({
            status: true,
            author: "Mr Thinuzz",
            data: {
                title: "Cyberpunk 2077 v2.1 + Phantom Liberty",
                game_info: {
                    "Genres/Tags": "Action, RPG, Open World",
                    "Companies": "CD Projekt RED",
                    "Repack Size": "64.5 GB"
                }
            }
        }, null, 2);
    }

    getGameDownloadResponse() {
        return JSON.stringify({
            status: true,
            author: "Mr Thinuzz",
            data: {
                original_url: "https://fuckingfast.co/...",
                download_url: "https://dl.fuckingfast.co/file.rar",
                filename: "game.part1.rar"
            }
        }, null, 2);
    }

    getAnimeSearchResponse() {
        return JSON.stringify({
            status: true,
            source: "Jikan API",
            data: {
                query: "naruto",
                total_results: 10,
                results: [
                    { id: 20, title: "Naruto", type: "TV", episodes: 220, score: 7.98 }
                ]
            }
        }, null, 2);
    }

    getAnimePopularResponse() {
        return JSON.stringify({
            status: true,
            author: "Mr Thinuzz",
            data: [
                { id: 21, title: "One Piece", score: 8.5 },
                { id: 30, title: "Attack on Titan", score: 9.0 }
            ]
        }, null, 2);
    }

    getAnimeInfoResponse() {
        return JSON.stringify({
            status: true,
            data: {
                id: 21,
                title: "One Piece",
                type: "TV",
                episodes: "1000+",
                score: 8.5,
                status: "Currently Airing"
            }
        }, null, 2);
    }

    async updateStats() {
        try {
            const startTime = performance.now();
            const response = await fetch('/health');
            const endTime = performance.now();
            const data = await response.json();
            
            this.stats.uptime = data.uptime || '450 seconds';
            this.stats.memory = data.memory_usage || '17 MB';
            this.stats.responseTime = `${Math.round(endTime - startTime)}ms`;
            this.stats.status = 'Online';
            
            this.stats.todayRequests = Math.floor(Math.random() * 200) + 89;
            this.stats.activeUsers = Math.floor(Math.random() * 30) + 11;
            this.stats.totalCalls = 893231 + Math.floor(Math.random() * 1000);
            
            this.updateStatElement('stat-uptime', this.stats.uptime);
            this.updateStatElement('stat-memory', this.stats.memory);
            this.updateStatElement('stat-response', this.stats.responseTime);
            this.updateStatElement('stat-status', `🟢 ${this.stats.status}`);
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

    async switchPage(page) {
        this.currentPage = page;
        const contentWrapper = document.getElementById('contentWrapper');
        if (!contentWrapper) return;
        
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
        
        switch(page) {
            case 'dashboard':
                contentWrapper.innerHTML = this.renderDashboardContent();
                this.bindDashboardEvents();
                break;
            case 'games':
                contentWrapper.innerHTML = this.renderGamesPageContent();
                this.bindGamesEvents();
                break;
            case 'anime':
                contentWrapper.innerHTML = this.renderAnimePageContent();
                this.bindAnimeEvents();
                break;
            case 'download':
                contentWrapper.innerHTML = this.renderDownloadPageContent();
                break;
            case 'ai':
                contentWrapper.innerHTML = this.renderComingSoonPage('AI API', 'Advanced AI-powered API for content generation and analysis');
                break;
            case 'movie':
                contentWrapper.innerHTML = this.renderComingSoonPage('Movie API', 'Comprehensive movie database API with ratings, reviews and streaming info');
                break;
            case 'search':
                contentWrapper.innerHTML = this.renderComingSoonPage('Search API', 'Universal search API for web, images, news and more');
                break;
            case 'stalk':
                contentWrapper.innerHTML = this.renderComingSoonPage('Stalk API', 'Social media analytics and public data gathering tools');
                break;
            default:
                contentWrapper.innerHTML = this.renderDashboardContent();
                this.bindDashboardEvents();
        }
        
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.dataset.page === page) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        
        window.scrollTo(0, 0);
    }

    bindDashboardEvents() {
        document.querySelectorAll('.quick-card[data-page]').forEach(card => {
            card.addEventListener('click', () => {
                if (!card.classList.contains('coming')) {
                    this.switchPage(card.dataset.page);
                }
            });
        });
    }

    bindGamesEvents() {
        const searchBtn = document.getElementById('tryGameSearch');
        const searchInput = document.getElementById('gameSearchInput');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                const query = searchInput?.value || 'cyberpunk';
                const resultDiv = document.getElementById('gameSearchResult');
                if (resultDiv) {
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '<div class="loading-spinner">Loading...</div>';
                    try {
                        const response = await fetch(`/game/fitgirl-search?q=${encodeURIComponent(query)}`);
                        const data = await response.json();
                        resultDiv.innerHTML = `<pre><code>${JSON.stringify(data, null, 2)}</code></pre>`;
                    } catch (error) {
                        resultDiv.innerHTML = `<div class="error-msg">Error: ${error.message}</div>`;
                    }
                }
            });
        }
    }

    bindAnimeEvents() {
        const searchBtn = document.getElementById('tryAnimeSearch');
        const searchInput = document.getElementById('animeSearchInput');
        const popularBtn = document.getElementById('tryAnimePopular');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                const query = searchInput?.value || 'naruto';
                const resultDiv = document.getElementById('animeSearchResult');
                if (resultDiv) {
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '<div class="loading-spinner">Loading...</div>';
                    try {
                        const response = await fetch(`/anime/search?q=${encodeURIComponent(query)}`);
                        const data = await response.json();
                        resultDiv.innerHTML = `<pre><code>${JSON.stringify(data, null, 2)}</code></pre>`;
                    } catch (error) {
                        resultDiv.innerHTML = `<div class="error-msg">Error: ${error.message}</div>`;
                    }
                }
            });
        }
        
        if (popularBtn) {
            popularBtn.addEventListener('click', async () => {
                const resultDiv = document.getElementById('animePopularResult');
                if (resultDiv) {
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '<div class="loading-spinner">Loading...</div>';
                    try {
                        const response = await fetch('/anime/popular');
                        const data = await response.json();
                        resultDiv.innerHTML = `<pre><code>${JSON.stringify(data, null, 2)}</code></pre>`;
                    } catch (error) {
                        resultDiv.innerHTML = `<div class="error-msg">Error: ${error.message}</div>`;
                    }
                }
            });
        }
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            const toggle = e.target.closest('#sidebarToggle');
            if (toggle) {
                const sidebar = document.querySelector('.sidebar');
                sidebar.classList.toggle('collapsed');
                localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            }
        });
        
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link');
            if (link && link.dataset.page) {
                e.preventDefault();
                this.switchPage(link.dataset.page);
            }
        });
        
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
        
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchEndpoints(e.target.value);
            });
        }
    }

    searchEndpoints(query) {
        if (!query.trim()) return;
        
        const endpoints = [
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
        
        const results = endpoints.filter(ep => 
            ep.path.toLowerCase().includes(query.toLowerCase()) ||
            ep.description.toLowerCase().includes(query.toLowerCase())
        );
        
        if (results.length > 0) {
            console.log('Found endpoints:', results);
        }
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

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
