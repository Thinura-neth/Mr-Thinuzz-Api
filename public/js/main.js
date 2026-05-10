// Global variables
let apiCardsData = [];
let currentSidebarSection = null;

// ============ LOAD API CARDS FROM SERVER ============

async function loadAPICards() {
    try {
        const response = await fetch('/all-apis/cards');
        const data = await response.json();
        
        if (data.status && data.cards) {
            apiCardsData = data.cards;
            renderAPICards(data.cards);
            renderDocumentation(data.cards);
            renderSidebar(data.cards);
            updateSelectors(data.cards);
            updateStats(data.cards);
            updateFooterLinks(data.cards);
            setupBackToTop();
        } else {
            showError('Failed to load API cards');
        }
    } catch (error) {
        console.error('Error loading API cards:', error);
        showError('Error loading API cards: ' + error.message);
    }
}

// ============ RENDER SIDEBAR ============

function renderSidebar(cards) {
    const sidebarNav = document.getElementById('sidebarNav');
    
    if (!cards || cards.length === 0) {
        sidebarNav.innerHTML = '<div class="no-apis" style="padding: 1rem;">No APIs configured</div>';
        return;
    }
    
    sidebarNav.innerHTML = cards.map(card => `
        <div class="sidebar-section" data-section-id="${card.id}" data-section-name="${card.name.toLowerCase()}">
            <div class="sidebar-section-header" onclick="toggleSidebarSection('${card.id}')">
                <i class="fas ${card.icon}" style="color: ${card.color}"></i>
                <span class="section-name">${card.name}</span>
                <span class="section-badge">${card.endpoints.length}</span>
                <i class="fas fa-chevron-down toggle-icon"></i>
            </div>
            <div class="sidebar-endpoints">
                ${card.endpoints.map(ep => `
                    <div class="sidebar-endpoint" onclick="scrollToEndpoint('${card.id}', '${ep.name}')">
                        <span class="method-badge ${ep.method.toLowerCase()}">${ep.method}</span>
                        <span class="endpoint-name">${ep.name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function toggleSidebarSection(sectionId) {
    const section = document.querySelector(`.sidebar-section[data-section-id="${sectionId}"]`);
    if (section) {
        section.classList.toggle('collapsed');
    }
}

function scrollToEndpoint(apiId, endpointName) {
    // Close sidebar on mobile
    if (window.innerWidth <= 968) {
        toggleSidebar();
    }
    
    // Find and scroll to endpoint
    const element = document.getElementById(`endpoint-${apiId}-${endpointName.replace(/\s+/g, '-')}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 1000);
        
        // Update active states
        document.querySelectorAll('.sidebar-endpoint').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.sidebar-section-header').forEach(el => el.classList.remove('active'));
        
        const clickedEndpoint = event?.target?.closest('.sidebar-endpoint');
        if (clickedEndpoint) clickedEndpoint.classList.add('active');
        
        const section = document.querySelector(`.sidebar-section[data-section-id="${apiId}"] .sidebar-section-header`);
        if (section) section.classList.add('active');
    }
}

function searchDocs() {
    const searchTerm = document.getElementById('sidebarSearch').value.toLowerCase();
    const sections = document.querySelectorAll('.sidebar-section');
    
    sections.forEach(section => {
        const sectionName = section.dataset.sectionName || '';
        const endpoints = section.querySelectorAll('.sidebar-endpoint');
        let hasMatch = false;
        
        endpoints.forEach(endpoint => {
            const endpointName = endpoint.querySelector('.endpoint-name')?.innerText.toLowerCase() || '';
            const matches = endpointName.includes(searchTerm) || sectionName.includes(searchTerm);
            endpoint.style.display = matches ? 'flex' : 'none';
            if (matches) hasMatch = true;
        });
        
        section.style.display = hasMatch || searchTerm === '' ? 'block' : 'none';
        if (hasMatch && searchTerm !== '') {
            section.classList.remove('collapsed');
        }
    });
}

// ============ RENDER API CARDS ============

function renderAPICards(cards) {
    const container = document.getElementById('apiCardsContainer');
    
    if (!cards || cards.length === 0) {
        container.innerHTML = `
            <div class="no-apis">
                <i class="fas fa-info-circle"></i>
                <h3>No APIs Configured</h3>
                <p>Add API configurations to route-config.json</p>
                <pre><code>{
  "your-api": {
    "name": "Your API Name",
    "icon": "fa-code",
    "color": "#6366f1",
    "base_path": "/yourapi",
    "enabled": true,
    "endpoints": [...]
  }
}</code></pre>
            </div>
        `;
        return;
    }
    
    container.innerHTML = cards.map(card => `
        <div class="api-card" onclick="selectAPI('${card.id}')" style="border-top: 3px solid ${card.color}">
            <div class="api-icon" style="color: ${card.color}">
                <i class="fas ${card.icon}"></i>
            </div>
            <h3>${card.name}</h3>
            ${card.name_si !== card.name ? `<small style="color: #666">${card.name_si}</small>` : ''}
            <p>${card.endpoints.length} endpoints available</p>
            <div class="api-tags">
                ${card.endpoints.slice(0, 3).map(ep => `
                    <span style="background: ${card.color}20; color: ${card.color}">${ep.name}</span>
                `).join('')}
                ${card.endpoints.length > 3 ? `<span>+${card.endpoints.length - 3} more</span>` : ''}
            </div>
            <div class="api-link">Click to test →</div>
        </div>
    `).join('');
}

// ============ RENDER DOCUMENTATION ============

function renderDocumentation(cards) {
    const container = document.getElementById('docsContainer');
    
    if (!cards || cards.length === 0) {
        container.innerHTML = '<div class="no-docs">No documentation available. Add API configurations.</div>';
        return;
    }
    
    container.innerHTML = cards.map(card => `
        <div id="doc-section-${card.id}" class="doc-section">
            <h3>
                <i class="fas ${card.icon}" style="color: ${card.color}"></i>
                ${card.name}
                <small>${card.base_path}</small>
            </h3>
            ${card.endpoints.map(ep => `
                <div id="endpoint-${card.id}-${ep.name.replace(/\s+/g, '-')}" class="endpoint-card">
                    <div class="endpoint-card-header" onclick="toggleEndpointCard(this)">
                        <span class="method ${ep.method.toLowerCase()}">${ep.method}</span>
                        <code class="path">${card.base_path}${ep.path}</code>
                        <button class="copy-endpoint" onclick="event.stopPropagation(); copyEndpoint('${card.base_path}${ep.path}')">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="toggle-details">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                    <div class="endpoint-card-body">
                        <div class="endpoint-description">
                            ${ep.description || 'No description available'}
                        </div>
                        
                        ${ep.params && ep.params.length > 0 ? `
                            <div class="endpoint-params">
                                <h4>📋 Parameters</h4>
                                <table class="params-table">
                                    <thead>
                                        <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
                                    </thead>
                                    <tbody>
                                        ${ep.params.map(p => `
                                            <tr>
                                                <td><code>${p}</code></td>
                                                <td>string</td>
                                                <td>${ep.required_params?.includes(p) ? '<span class="required">Yes</span>' : 'No'}</td>
                                                <td>${p} parameter</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}
                        
                        <div class="endpoint-example">
                            <h4>🔗 Example Request</h4>
                            <code>GET ${ep.example || `${card.base_path}${ep.path}`}</code>
                        </div>
                        
                        <div class="endpoint-response">
                            <h4>📤 Example Response</h4>
                            <pre><code>{
  "status": true,
  "data": { ... }
}</code></pre>
                        </div>
                        
                        <button class="test-this-btn" onclick="testThisEndpoint('${card.id}', '${ep.name}')">
                            <i class="fas fa-play"></i> Test This Endpoint
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

function toggleEndpointCard(header) {
    const card = header.closest('.endpoint-card');
    card.classList.toggle('expanded');
}

function copyEndpoint(endpoint) {
    navigator.clipboard.writeText(endpoint);
    showToast('Endpoint copied to clipboard!');
}

async function testThisEndpoint(apiId, endpointName) {
    const card = apiCardsData.find(c => c.id === apiId);
    if (!card) return;
    
    const endpoint = card.endpoints.find(ep => ep.name === endpointName);
    if (!endpoint) return;
    
    // Switch to demo tab
    document.querySelector('#demo').scrollIntoView({ behavior: 'smooth' });
    
    // Set API and endpoint in demo
    const apiSelect = document.getElementById('apiSelect');
    const endpointSelect = document.getElementById('endpointSelect');
    
    apiSelect.value = apiId;
    apiSelect.dispatchEvent(new Event('change'));
    
    setTimeout(() => {
        endpointSelect.value = endpointName;
        endpointSelect.dispatchEvent(new Event('change'));
        
        setTimeout(() => {
            document.getElementById('testBtn').click();
        }, 100);
    }, 100);
}

// ============ UPDATE SELECTORS ============

function updateSelectors(cards) {
    const apiSelect = document.getElementById('apiSelect');
    
    if (!cards || cards.length === 0) {
        apiSelect.innerHTML = '<option value="">No APIs available</option>';
        return;
    }
    
    apiSelect.innerHTML = '<option value="">Select API</option>' + 
        cards.map(card => `<option value="${card.id}">🎮 ${card.name}</option>`).join('');
    
    // Add change event
    apiSelect.onchange = () => {
        const selectedId = apiSelect.value;
        const selectedCard = cards.find(c => c.id === selectedId);
        
        if (selectedCard) {
            updateEndpointSelect(selectedCard);
        } else {
            document.getElementById('endpointSelect').innerHTML = '<option value="">Select endpoint</option>';
            document.getElementById('paramInput').innerHTML = '<input type="text" id="paramValue" placeholder="Enter parameters..." disabled>';
        }
    };
}

function updateEndpointSelect(card) {
    const endpointSelect = document.getElementById('endpointSelect');
    
    endpointSelect.innerHTML = '<option value="">Select endpoint</option>' +
        card.endpoints.map(ep => `<option value="${ep.name}">${ep.method} ${ep.name}</option>`).join('');
    
    endpointSelect.onchange = () => {
        const selectedEndpointName = endpointSelect.value;
        const selectedEndpoint = card.endpoints.find(ep => ep.name === selectedEndpointName);
        
        if (selectedEndpoint) {
            updateParamInput(selectedEndpoint);
        }
    };
}

function updateParamInput(endpoint) {
    const paramDiv = document.getElementById('paramInput');
    
    if (endpoint.params && endpoint.params.length > 0) {
        paramDiv.innerHTML = `
            <div class="param-group">
                ${endpoint.params.map(param => `
                    <div class="param-field">
                        <label>${param} ${endpoint.required_params?.includes(param) ? '<span class="required-star">*</span>' : ''}</label>
                        <input type="text" id="param_${param}" placeholder="Enter ${param}" ${endpoint.required_params?.includes(param) ? 'required' : ''}>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        paramDiv.innerHTML = '<input type="text" id="paramValue" placeholder="No parameters needed" disabled>';
    }
}

// ============ TEST ENDPOINT ============

async function testEndpoint(apiId, endpointName) {
    const card = apiCardsData.find(c => c.id === apiId);
    if (!card) return;
    
    const endpoint = card.endpoints.find(ep => ep.name === endpointName);
    if (!endpoint) return;
    
    // Build URL with params
    let url = `${card.base_path}${endpoint.path}`;
    const params = {};
    
    if (endpoint.params && endpoint.params.length > 0) {
        for (const param of endpoint.params) {
            const input = document.getElementById(`param_${param}`);
            if (input && input.value) {
                params[param] = input.value;
            }
        }
    }
    
    const queryString = new URLSearchParams(params).toString();
    if (queryString) url += `?${queryString}`;
    
    // Show loading
    const responseOutput = document.getElementById('responseOutput');
    responseOutput.innerHTML = '<code>Loading...</code>';
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        responseOutput.innerHTML = `<code>${JSON.stringify(data, null, 2)}</code>`;
    } catch (error) {
        responseOutput.innerHTML = `<code>Error: ${error.message}</code>`;
    }
}

// ============ SELECT API FROM CARD ============

function selectAPI(apiId) {
    const apiSelect = document.getElementById('apiSelect');
    apiSelect.value = apiId;
    apiSelect.dispatchEvent(new Event('change'));
    document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
}

// ============ UPDATE STATS ============

function updateStats(cards) {
    const apiCount = cards.length;
    const endpointCount = cards.reduce((sum, card) => sum + card.endpoints.length, 0);
    
    document.getElementById('apiCount').innerHTML = apiCount;
    document.getElementById('endpointCount').innerHTML = endpointCount;
}

// ============ UPDATE FOOTER LINKS ============

function updateFooterLinks(cards) {
    const container = document.getElementById('footerApiLinks');
    if (container) {
        container.innerHTML = cards.map(card => 
            `<a href="#" onclick="selectAPI('${card.id}'); return false;">${card.name}</a>`
        ).join('');
    }
}

// ============ TEST API FROM DEMO SECTION ============

async function testAPIDemo() {
    const apiSelect = document.getElementById('apiSelect');
    const endpointSelect = document.getElementById('endpointSelect');
    
    const selectedApiId = apiSelect.value;
    const selectedEndpointName = endpointSelect.value;
    
    if (!selectedApiId || !selectedEndpointName) {
        alert('Please select both API and endpoint');
        return;
    }
    
    const card = apiCardsData.find(c => c.id === selectedApiId);
    if (!card) return;
    
    const endpoint = card.endpoints.find(ep => ep.name === selectedEndpointName);
    if (!endpoint) return;
    
    await testEndpoint(selectedApiId, selectedEndpointName);
}

// ============ SIDEBAR FUNCTIONS ============

function toggleSidebar() {
    const sidebar = document.getElementById('docsSidebar');
    sidebar.classList.toggle('open');
}

function setupBackToTop() {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(btn);
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.classList.add('show');
        } else {
            btn.classList.remove('show');
        }
    });
}

function toggleMobileMenu() {
    const nav = document.querySelector('nav');
    nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
}

// ============ HELPER FUNCTIONS ============

function copyCode() {
    const code = document.querySelector('#quickCode code').innerText;
    navigator.clipboard.writeText(code);
    showToast('Code copied to clipboard!');
}

function copyResponse() {
    const response = document.querySelector('#responseOutput code');
    if (response) {
        navigator.clipboard.writeText(response.innerText);
        showToast('Response copied to clipboard!');
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showError(message) {
    const container = document.getElementById('apiCardsContainer');
    container.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading APIs</h3>
            <p>${message}</p>
            <button onclick="loadAPICards()" class="btn btn-primary">Retry</button>
        </div>
    `;
}

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
    loadAPICards();
    
    // Setup test button
    const testBtn = document.getElementById('testBtn');
    if (testBtn) {
        testBtn.onclick = testAPIDemo;
    }
    
    // Close sidebar when clicking outside (mobile)
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('docsSidebar');
        const toggle = document.querySelector('.sidebar-toggle');
        
        if (window.innerWidth <= 968 && sidebar && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && !toggle?.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});

// Keyboard shortcut to toggle sidebar (Ctrl + D)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        toggleSidebar();
    }
});
