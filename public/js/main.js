// Global variables
let apiCardsData = [];

// ============ LOAD API CARDS FROM SERVER ============

async function loadAPICards() {
    try {
        const response = await fetch('/all-apis/cards');
        const data = await response.json();
        
        if (data.status && data.cards) {
            apiCardsData = data.cards;
            renderAPICards(data.cards);
            renderDocumentation(data.cards);
            updateSelectors(data.cards);
            updateStats(data.cards);
            updateFooterLinks(data.cards);
        } else {
            showError('Failed to load API cards');
        }
    } catch (error) {
        console.error('Error loading API cards:', error);
        showError('Error loading API cards: ' + error.message);
    }
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
        <div class="doc-section">
            <h3>
                <i class="fas ${card.icon}" style="color: ${card.color}"></i>
                ${card.name}
                <small style="color: ${card.color}; font-size: 0.8rem;">${card.base_path}</small>
            </h3>
            ${card.endpoints.map(ep => `
                <div class="endpoint">
                    <div class="endpoint-header">
                        <span class="method ${ep.method.toLowerCase()}">${ep.method}</span>
                        <span class="path">${card.base_path}${ep.path}</span>
                        <button class="test-endpoint-btn" onclick="testEndpoint('${card.id}', '${ep.name}')">
                            <i class="fas fa-play"></i> Test
                        </button>
                    </div>
                    <div class="endpoint-desc">${ep.description || 'No description available'}</div>
                    ${ep.params && ep.params.length > 0 ? `
                        <div class="params">
                            <strong>Parameters:</strong>
                            ${ep.params.map(p => `
                                <code class="${ep.required_params?.includes(p) ? 'required' : ''}">${p}${ep.required_params?.includes(p) ? '*' : ''}</code>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="example">
                        <strong>Example:</strong>
                        <code>GET ${ep.example || `${card.base_path}${ep.path}`}</code>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

// ============ UPDATE SELECTORS ============

function updateSelectors(cards) {
    const apiSelect = document.getElementById('apiSelect');
    
    if (!cards || cards.length === 0) {
        apiSelect.innerHTML = '<option value="">No APIs available</option>';
        return;
    }
    
    apiSelect.innerHTML = '<option value="">Select API</option>' + 
        cards.map(card => `<option value="${card.id}">${card.icon ? '🎮' : '📁'} ${card.name}</option>`).join('');
    
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

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .param-group {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }
    
    .param-field {
        flex: 1;
        min-width: 150px;
    }
    
    .param-field label {
        display: block;
        font-size: 0.75rem;
        margin-bottom: 5px;
        color: #888;
    }
    
    .param-field input {
        width: 100%;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(99, 102, 241, 0.3);
        color: white;
        padding: 0.5rem;
        border-radius: 6px;
    }
    
    .required-star {
        color: #ef4444;
    }
    
    .test-endpoint-btn {
        background: rgba(99, 102, 241, 0.2);
        border: none;
        color: #6366f1;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.75rem;
        margin-left: auto;
    }
    
    .test-endpoint-btn:hover {
        background: rgba(99, 102, 241, 0.4);
    }
    
    .params {
        margin: 10px 0;
        font-size: 0.875rem;
    }
    
    .params code {
        background: rgba(0,0,0,0.3);
        padding: 2px 6px;
        border-radius: 4px;
        margin-right: 5px;
    }
    
    .params code.required {
        color: #f59e0b;
        border: 1px solid #f59e0b;
    }
    
    .method.post { background: #f59e0b; }
    .method.put { background: #3b82f6; }
    .method.delete { background: #ef4444; }
    
    .loading-spinner {
        text-align: center;
        padding: 40px;
    }
    
    .loading-spinner i {
        font-size: 40px;
        color: #6366f1;
        margin-bottom: 10px;
    }
    
    .no-apis, .error-message {
        text-align: center;
        padding: 40px;
        background: rgba(0,0,0,0.3);
        border-radius: 12px;
    }
    
    .no-apis i, .error-message i {
        font-size: 48px;
        color: #f59e0b;
        margin-bottom: 16px;
    }
    
    .no-apis pre {
        background: #1e1e1e;
        padding: 16px;
        border-radius: 8px;
        margin-top: 20px;
        text-align: left;
        overflow-x: auto;
    }
`;

document.head.appendChild(style);

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
    loadAPICards();
    
    // Setup test button
    const testBtn = document.getElementById('testBtn');
    if (
