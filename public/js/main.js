// ============ INITIALIZATION SCREEN ============
let progress = 0;
const progressInterval = setInterval(() => {
    progress += Math.random() * 12;
    if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
        const progressFill = document.getElementById('initProgress');
        const percentEl = document.getElementById('initPercent');
        const statusEl = document.getElementById('initStatus');
        if (progressFill) progressFill.style.width = '100%';
        if (percentEl) percentEl.textContent = '100%';
        if (statusEl) statusEl.textContent = 'Ready!';
        setTimeout(() => {
            const initScreen = document.getElementById('initScreen');
            if (initScreen) initScreen.classList.add('fade-out');
        }, 500);
    }
    const progressFill = document.getElementById('initProgress');
    const percentEl = document.getElementById('initPercent');
    if (progressFill) progressFill.style.width = progress + '%';
    if (percentEl) percentEl.textContent = Math.floor(progress) + '%';
    
    const statuses = ['Loading modules...', 'Connecting to APIs...', 'Initializing routes...', 'Almost ready...'];
    const statusEl = document.getElementById('initStatus');
    if (statusEl) {
        if (progress > 30 && progress < 70) {
            statusEl.textContent = statuses[1];
        } else if (progress > 70) {
            statusEl.textContent = statuses[2];
        }
    }
}, 100);

// ============ GLOBAL VARIABLES ============
let apiCardsData = [];
let currentSection = 'dashboard';

// ============ LOAD STATS FROM SERVER ============
async function loadStats() {
    try {
        const healthRes = await fetch('/health');
        const healthData = await healthRes.json();
        const uptimeEl = document.getElementById('statUptime');
        const memoryEl = document.getElementById('statMemory');
        if (uptimeEl) uptimeEl.textContent = healthData.uptime || '--';
        if (memoryEl) memoryEl.textContent = healthData.memory_usage || '--';
    } catch (e) {
        console.log('Stats not available:', e);
    }
}

// ============ LOAD API CARDS ============
async function loadAPICards() {
    try {
        const response = await fetch('/all-apis/cards');
        const data = await response.json();
        
        if (data.status && data.cards) {
            apiCardsData = data.cards;
            const apiCountEl = document.getElementById('statApiCount');
            if (apiCountEl) apiCountEl.textContent = data.total_apis;
            
            const totalEndpoints = data.cards.reduce((sum, card) => sum + (card.endpoints?.length || 0), 0);
            const endpointCountEl = document.getElementById('statEndpointCount');
            if (endpointCountEl) endpointCountEl.textContent = totalEndpoints;
            
            renderAPICards(data.cards);
            renderDocumentation(data.cards);
            updateSelectors(data.cards);
        } else {
            showError('Failed to load API cards');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Error loading API cards: ' + error.message);
    }
}

function renderAPICards(cards) {
    const container = document.getElementById('apiCardsContainer');
    if (!container) return;
    
    if (!cards || cards.length === 0) {
        container.innerHTML = '<div class="no-apis">No APIs configured. Add to route-config.json</div>';
        return;
    }
    
    container.innerHTML = cards.map(card => `
        <div class="api-card" onclick="selectAPI('${card.id}')">
            <div class="api-icon">
                <i class="fas ${card.icon}" style="color: ${card.color}"></i>
            </div>
            <h3>${escapeHtml(card.name)}</h3>
            <p>${card.endpoints?.length || 0} endpoints available</p>
            <span class="api-badge">${escapeHtml(card.base_path)}</span>
        </div>
    `).join('');
}

function renderDocumentation(cards) {
    const container = document.getElementById('docsContainer');
    if (!container) return;
    
    if (!cards || cards.length === 0) {
        container.innerHTML = '<div class="no-docs">No documentation available.</div>';
        return;
    }
    
    container.innerHTML = cards.map(card => `
        <div class="doc-section">
            <h3><i class="fas ${card.icon}" style="color: ${card.color}"></i> ${escapeHtml(card.name)}</h3>
            ${(card.endpoints || []).map(ep => `
                <div class="endpoint-card">
                    <div class="endpoint-header" onclick="toggleEndpoint(this)">
                        <span class="method ${(ep.method || 'GET').toLowerCase()}">${ep.method || 'GET'}</span>
                        <code class="endpoint-path">${escapeHtml(card.base_path)}${escapeHtml(ep.path)}</code>
                        <i class="fas fa-chevron-down toggle-docs-icon"></i>
                    </div>
                    <div class="endpoint-body">
                        <p>${escapeHtml(ep.description || 'No description available')}</p>
                        ${ep.params && ep.params.length > 0 ? `
                            <h4>📋 Parameters:</h4>
                            <ul class="params-list">
                                ${ep.params.map(p => `<li><code>${escapeHtml(p)}</code> ${ep.required_params?.includes(p) ? '<span class="required">(required)</span>' : '<span class="optional">(optional)</span>'}</li>`).join('')}
                            </ul>
                        ` : ''}
                        <h4>🔗 Example:</h4>
                        <code class="example-code">GET ${escapeHtml(ep.example || card.base_path + ep.path)}</code>
                        <button class="test-this-btn" onclick="testThisEndpoint('${card.id}', '${escapeHtml(ep.name)}')">
                            <i class="fas fa-play"></i> Test This Endpoint
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

function toggleEndpoint(header) {
    const card = header.closest('.endpoint-card');
    if (card) {
        card.classList.toggle('expanded');
        const icon = header.querySelector('.toggle-docs-icon');
        if (icon) {
            icon.style.transform = card.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
}

function updateSelectors(cards) {
    const apiSelect = document.getElementById('apiSelect');
    if (!apiSelect) return;
    
    apiSelect.innerHTML = '<option value="">Select API</option>' + 
        cards.map(card => `<option value="${card.id}">${escapeHtml(card.name)}</option>`).join('');
    
    apiSelect.onchange = () => {
        const card = cards.find(c => c.id === apiSelect.value);
        if (card) {
            const endpointSelect = document.getElementById('endpointSelect');
            if (endpointSelect) {
                endpointSelect.innerHTML = '<option value="">Select endpoint</option>' +
                    (card.endpoints || []).map(ep => `<option value="${ep.name}">${ep.method || 'GET'} ${escapeHtml(ep.name)}</option>`).join('');
                
                endpointSelect.onchange = () => {
                    const endpoint = card.endpoints.find(ep => ep.name === endpointSelect.value);
                    const paramInput = document.getElementById('paramInput');
                    if (paramInput) {
                        if (endpoint && endpoint.params && endpoint.params.length > 0) {
                            paramInput.innerHTML = `
                                <div class="param-group">
                                    ${endpoint.params.map(p => `
                                        <div class="param-field">
                                            <label>${escapeHtml(p)} ${endpoint.required_params?.includes(p) ? '<span class="required-star">*</span>' : ''}</label>
                                            <input type="text" id="param_${p}" placeholder="Enter ${escapeHtml(p)}" ${endpoint.required_params?.includes(p) ? 'required' : ''}>
                                        </div>
                                    `).join('')}
                                </div>
                            `;
                        } else {
                            paramInput.innerHTML = '<input type="text" placeholder="No parameters needed" disabled>';
                        }
                    }
                };
                endpointSelect.dispatchEvent(new Event('change'));
            }
        } else {
            const endpointSelect = document.getElementById('endpointSelect');
            if (endpointSelect) endpointSelect.innerHTML = '<option value="">Select endpoint</option>';
            const paramInput = document.getElementById('paramInput');
            if (paramInput) paramInput.innerHTML = '<input type="text" placeholder="No parameters needed" disabled>';
        }
    };
}

async function testThisEndpoint(apiId, endpointName) {
    const card = apiCardsData.find(c => c.id === apiId);
    if (!card) return;
    
    const endpoint = card.endpoints.find(ep => ep.name === endpointName);
    if (!endpoint) return;
    
    // Switch to demo section
    showSection('demo');
    
    // Set values in demo
    const apiSelect = document.getElementById('apiSelect');
    const endpointSelect = document.getElementById('endpointSelect');
    
    if (apiSelect) {
        apiSelect.value = apiId;
        apiSelect.dispatchEvent(new Event('change'));
    }
    
    setTimeout(() => {
        if (endpointSelect) {
            endpointSelect.value = endpointName;
            endpointSelect.dispatchEvent(new Event('change'));
            setTimeout(() => {
                const testBtn = document.getElementById('testBtn');
                if (testBtn) testBtn.click();
            }, 100);
        }
    }, 100);
}

function selectAPI(apiId) {
    showSection('demo');
    const apiSelect = document.getElementById('apiSelect');
    if (apiSelect) {
        apiSelect.value = apiId;
        apiSelect.dispatchEvent(new Event('change'));
    }
}

function showSection(sectionId) {
    currentSection = sectionId;
    
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    const activeSection = document.getElementById(sectionId);
    if (activeSection) activeSection.classList.add('active');
    
    // Update sidebar active states
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === sectionId) {
            item.classList.add('active');
        }
    });
    
    // Update header nav active states
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
        }
    });
    
    // Update URL hash without scrolling
    history.pushState(null, '', `#${sectionId}`);
}

// ============ SIDEBAR FUNCTIONS ============
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleIcon = document.getElementById('toggleIcon');
    const mainContent = document.getElementById('mainContent');
    
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        if (toggleIcon) {
            if (sidebar.classList.contains('collapsed')) {
                toggleIcon.classList.remove('fa-chevron-left');
                toggleIcon.classList.add('fa-chevron-right');
            } else {
                toggleIcon.classList.remove('fa-chevron-right');
                toggleIcon.classList.add('fa-chevron-left');
            }
        }
        if (mainContent) {
            mainContent.classList.toggle('full-width');
        }
        // Save state to localStorage
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    }
}

function closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
    }
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

// ============ DEMO TEST FUNCTION ============
async function testAPIDemo() {
    const apiSelect = document.getElementById('apiSelect');
    const endpointSelect = document.getElementById('endpointSelect');
    const responseOutput = document.getElementById('responseOutput');
    
    if (!apiSelect || !endpointSelect || !responseOutput) return;
    
    const card = apiCardsData.find(c => c.id === apiSelect.value);
    if (!card) {
        responseOutput.innerHTML = '<code>// Please select an API first</code>';
        return;
    }
    
    const endpoint = card.endpoints.find(ep => ep.name === endpointSelect.value);
    if (!endpoint) {
        responseOutput.innerHTML = '<code>// Please select an endpoint first</code>';
        return;
    }
    
    let url = `${card.base_path}${endpoint.path}`;
    const params = {};
    
    if (endpoint.params) {
        for (const param of endpoint.params) {
            const input = document.getElementById(`param_${param}`);
            if (input && input.value) {
                params[param] = input.value;
            }
        }
    }
    
    const queryString = new URLSearchParams(params).toString();
    if (queryString) url += `?${queryString}`;
    
    responseOutput.innerHTML = '<code>Loading... <i class="fas fa-spinner fa-spin"></i></code>';
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        responseOutput.innerHTML = `<code>${JSON.stringify(data, null, 2)}</code>`;
    } catch (error) {
        responseOutput.innerHTML = `<code>Error: ${escapeHtml(error.message)}</code>`;
    }
}

function copyResponse() {
    const responseOutput = document.getElementById('responseOutput');
    if (responseOutput) {
        const text = responseOutput.innerText;
        navigator.clipboard.writeText(text);
        showToast('Response copied to clipboard!');
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${escapeHtml(message)}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--success);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showError(message) {
    const container = document.getElementById('apiCardsContainer');
    if (container) {
        container.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i> ${escapeHtml(message)}</div>`;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const isDark = !document.body.classList.contains('light-theme');
    localStorage.setItem('darkTheme', isDark);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadAPICards();
    
    // Restore sidebar state
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        const toggleIcon = document.getElementById('toggleIcon');
        if (sidebar) sidebar.classList.add('collapsed');
        if (mainContent) mainContent.classList.add('full-width');
        if (toggleIcon) {
            toggleIcon.classList.remove('fa-chevron-left');
            toggleIcon.classList.add('fa-chevron-right');
        }
    }
    
    // Check URL hash for initial section
    const hash = window.location.hash.substring(1);
    if (hash && ['dashboard', 'apis', 'demo', 'docs'].includes(hash)) {
        showSection(hash);
    } else {
        showSection('dashboard');
    }
    
    // Setup test button
    const testBtn = document.getElementById('testBtn');
    if (testBtn) testBtn.onclick = testAPIDemo;
    
    // Sidebar navigation click handlers
    document.querySelectorAll('.sidebar-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            if (section) showSection(section);
            closeSidebarOnMobile();
        });
    });
    
    // Header navigation click handlers
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                showSection(href.substring(1));
            }
        });
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            const menuBtn = document.querySelector('.menu-btn');
            if (sidebar && sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        }
    });
});
