// Initialize loading animation
let progress = 0;
const progressInterval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
        document.getElementById('initProgress').style.width = '100%';
        document.getElementById('initPercent').textContent = '100%';
        document.getElementById('initStatus').textContent = 'Ready!';
        setTimeout(() => {
            document.getElementById('initScreen').classList.add('fade-out');
        }, 500);
    }
    document.getElementById('initProgress').style.width = progress + '%';
    document.getElementById('initPercent').textContent = Math.floor(progress) + '%';
    
    const statuses = ['Loading modules...', 'Connecting to APIs...', 'Initializing routes...', 'Almost ready...'];
    if (progress > 30 && progress < 70) {
        document.getElementById('initStatus').textContent = statuses[1];
    } else if (progress > 70) {
        document.getElementById('initStatus').textContent = statuses[2];
    }
}, 100);

// Global variables
let apiCardsData = [];
let currentSection = 'dashboard';

// Load stats from server
async function loadStats() {
    try {
        const healthRes = await fetch('/health');
        const healthData = await healthRes.json();
        document.getElementById('statUptime').textContent = healthData.uptime || '--';
        document.getElementById('statMemory').textContent = healthData.memory_usage || '--';
    } catch (e) {
        console.log('Stats not available');
    }
}

// Load API cards
async function loadAPICards() {
    try {
        const response = await fetch('/all-apis/cards');
        const data = await response.json();
        
        if (data.status && data.cards) {
            apiCardsData = data.cards;
            document.getElementById('statApiCount').textContent = data.total_apis;
            const totalEndpoints = data.cards.reduce((sum, card) => sum + card.endpoints.length, 0);
            document.getElementById('statEndpointCount').textContent = totalEndpoints;
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
    
    if (!cards || cards.length === 0) {
        container.innerHTML = '<div class="no-apis">No APIs configured. Add to route-config.json</div>';
        return;
    }
    
    container.innerHTML = cards.map(card => `
        <div class="api-card" onclick="selectAPI('${card.id}')">
            <div class="api-icon">
                <i class="fas ${card.icon}" style="color: ${card.color}"></i>
            </div>
            <h3>${card.name}</h3>
            <p>${card.endpoints.length} endpoints available</p>
            <span class="api-badge">${card.base_path}</span>
        </div>
    `).join('');
}

function renderDocumentation(cards) {
    const container = document.getElementById('docsContainer');
    
    if (!cards || cards.length === 0) {
        container.innerHTML = '<div class="no-docs">No documentation available.</div>';
        return;
    }
    
    container.innerHTML = cards.map(card => `
        <div class="doc-section">
            <h3><i class="fas ${card.icon}" style="color: ${card.color}"></i> ${card.name}</h3>
            ${card.endpoints.map(ep => `
                <div class="endpoint-card">
                    <div class="endpoint-header" onclick="toggleEndpoint(this)">
                        <span class="method ${ep.method.toLowerCase()}">${ep.method}</span>
                        <code class="endpoint-path">${card.base_path}${ep.path}</code>
                        <i class="fas fa-chevron-down" style="margin-left: auto;"></i>
                    </div>
                    <div class="endpoint-body">
                        <p>${ep.description || 'No description'}</p>
                        ${ep.params?.length ? `
                            <h4>Parameters:</h4>
                            <ul>
                                ${ep.params.map(p => `<li><code>${p}</code> ${ep.required_params?.includes(p) ? '(required)' : '(optional)'}</li>`).join('')}
                            </ul>
                        ` : ''}
                        <h4>Example:</h4>
                        <code>GET ${ep.example || card.base_path + ep.path}</code>
                        <button class="test-this-btn" onclick="testThisEndpoint('${card.id}', '${ep.name}')">
                            <i class="fas fa-play"></i> Test
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

function toggleEndpoint(header) {
    const card = header.closest('.endpoint-card');
    card.classList.toggle('expanded');
}

function updateSelectors(cards) {
    const apiSelect = document.getElementById('apiSelect');
    apiSelect.innerHTML = '<option value="">Select API</option>' + 
        cards.map(card => `<option value="${card.id}">${card.name}</option>`).join('');
    
    apiSelect.onchange = () => {
        const card = cards.find(c => c.id === apiSelect.value);
        if (card) {
            const endpointSelect = document.getElementById('endpointSelect');
            endpointSelect.innerHTML = '<option value="">Select endpoint</option>' +
                card.endpoints.map(ep => `<option value="${ep.name}">${ep.method} ${ep.name}</option>`).join('');
            
            endpointSelect.onchange = () => {
                const endpoint = card.endpoints.find(ep => ep.name === endpointSelect.value);
                if (endpoint && endpoint.params?.length) {
                    document.getElementById('paramInput').innerHTML = `
                        <div class="param-group">
                            ${endpoint.params.map(p => `
                                <input type="text" id="param_${p}" placeholder="${p}" ${endpoint.required_params?.includes(p) ? 'required' : ''}>
                            `).join('')}
                        </div>
                    `;
                } else {
                    document.getElementById('paramInput').innerHTML = '<input type="text" placeholder="No parameters needed" disabled>';
                }
            };
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
    
    // Set values
    document.getElementById('apiSelect').value = apiId;
    document.getElementById('apiSelect').dispatchEvent(new Event('change'));
    
    setTimeout(() => {
        document.getElementById('endpointSelect').value = endpointName;
        document.getElementById('endpointSelect').dispatchEvent(new Event('change'));
        document.getElementById('testBtn').click();
    }, 100);
}

function selectAPI(apiId) {
    showSection('demo');
    document.getElementById('apiSelect').value = apiId;
    document.getElementById('apiSelect').dispatchEvent(new Event('change'));
}

// Section navigation
function showSection(sectionId) {
    currentSection = sectionId;
    document.querySelectorAll('section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';
    
    // Update active states
    document.querySelectorAll('.sidebar-item, nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
        }
    });
}

// Sidebar functions
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleIcon = document.getElementById('toggleIcon');
    sidebar.classList.toggle('collapsed');
    
    if (sidebar.classList.contains('collapsed')) {
        toggleIcon.classList.remove('fa-chevron-left');
        toggleIcon.classList.add('fa-chevron-right');
    } else {
        toggleIcon.classList.remove('fa-chevron-right');
        toggleIcon.classList.add('fa-chevron-left');
    }
}

function closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// Demo test function
async function testAPIDemo() {
    const apiSelect = document.getElementById('apiSelect');
    const endpointSelect = document.getElementById('endpointSelect');
    
    const card = apiCardsData.find(c => c.id === apiSelect.value);
    if (!card) return;
    
    const endpoint = card.endpoints.find(ep => ep.name === endpointSelect.value);
    if (!endpoint) return;
    
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
    
    const output = document.getElementById('responseOutput');
    output.innerHTML = '<code>Loading...</code>';
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        output.innerHTML = `<code>${JSON.stringify(data, null, 2)}</code>`;
    } catch (error) {
        output.innerHTML = `<code>Error: ${error.message}</code>`;
    }
}

function showError(message) {
    const container = document.getElementById('apiCardsContainer');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadAPICards();
    showSection('dashboard');
    document.getElementById('testBtn').onclick = testAPIDemo;
    
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const href = item.getAttribute('href');
            if (href && href.startsWith('#')) {
                showSection(href.substring(1));
            }
        });
    });
});
