// Init Screen
let progress = 0;
const interval = setInterval(() => {
    progress += Math.random() * 12;
    if (progress >= 100) {
        clearInterval(interval);
        document.getElementById('initProgress').style.width = '100%';
        document.getElementById('initPercent').textContent = '100%';
        document.getElementById('initStatus').textContent = 'Ready!';
        setTimeout(() => document.getElementById('initScreen').classList.add('fade-out'), 500);
    }
    document.getElementById('initProgress').style.width = progress + '%';
    document.getElementById('initPercent').textContent = Math.floor(progress) + '%';
}, 100);

let apiData = [];
let currentTab = 'dashboard';

async function loadStats() {
    try {
        const res = await fetch('/health');
        const data = await res.json();
        document.getElementById('statUptime').textContent = data.uptime || '--';
        document.getElementById('statMemory').textContent = data.memory_usage || '--';
    } catch(e) { console.log(e); }
}

async function loadAPIs() {
    try {
        const res = await fetch('/all-apis/cards');
        const data = await res.json();
        if (data.status && data.cards) {
            apiData = data.cards;
            document.getElementById('statApiCount').textContent = data.total_apis;
            const totalEndpoints = data.cards.reduce((s,c) => s + (c.endpoints?.length || 0), 0);
            document.getElementById('statEndpointCount').textContent = totalEndpoints;
            renderCards(data.cards);
            renderAPIsTab(data.cards);
            renderDocs(data.cards);
            updateDemoSelectors(data.cards);
        }
    } catch(e) { console.error(e); showError(e.message); }
}

function renderCards(cards) {
    const container = document.getElementById('apiCardsContainer');
    if (!cards?.length) { container.innerHTML = '<div class="no-apis">No APIs configured</div>'; return; }
    container.innerHTML = cards.slice(0,3).map(c => `
        <div class="api-card" onclick="switchToTabAndSelect('demo','${c.id}')">
            <div class="api-icon"><i class="fas ${c.icon}" style="color:${c.color}"></i></div>
            <h3>${escapeHtml(c.name)}</h3>
            <p>${c.endpoints?.length || 0} endpoints</p>
            <span class="api-badge">${escapeHtml(c.base_path)}</span>
        </div>
    `).join('');
}

function renderAPIsTab(cards) {
    const container = document.getElementById('apisContainer');
    if (!cards?.length) { container.innerHTML = '<div class="no-apis">No APIs configured</div>'; return; }
    container.innerHTML = cards.map(c => `
        <div class="api-card" onclick="switchToTabAndSelect('demo','${c.id}')">
            <div class="api-icon"><i class="fas ${c.icon}" style="color:${c.color}"></i></div>
            <h3>${escapeHtml(c.name)}</h3>
            <p>${c.name_si || ''}</p>
            <div class="api-endpoints-list">${(c.endpoints||[]).slice(0,3).map(() => `<span class="api-endpoint-tag">●</span>`).join('')}${c.endpoints?.length>3?`<span class="api-endpoint-tag">+${c.endpoints.length-3}</span>`:''}</div>
            <span class="api-badge">${c.endpoints?.length || 0} endpoints</span>
        </div>
    `).join('');
}

function renderDocs(cards) {
    const container = document.getElementById('docsContainer');
    if (!cards?.length) { container.innerHTML = '<div class="no-docs">No docs available</div>'; return; }
    container.innerHTML = cards.map(c => `
        <div class="doc-section">
            <h3><i class="fas ${c.icon}" style="color:${c.color}"></i> ${escapeHtml(c.name)}</h3>
            <p class="doc-description">Base: <code>${escapeHtml(c.base_path)}</code></p>
            ${(c.endpoints||[]).map(ep => `
                <div class="endpoint-card">
                    <div class="endpoint-header" onclick="toggleEndpoint(this)">
                        <span class="method ${(ep.method||'GET').toLowerCase()}">${ep.method||'GET'}</span>
                        <code class="endpoint-path">${escapeHtml(c.base_path)}${escapeHtml(ep.path)}</code>
                        <i class="fas fa-chevron-down toggle-docs-icon"></i>
                    </div>
                    <div class="endpoint-body">
                        <p>${escapeHtml(ep.description||'No description')}</p>
                        ${ep.params?.length ? `<h4>📋 Parameters:</h4><ul class="params-list">${ep.params.map(p => `<li><code>${escapeHtml(p)}</code> ${ep.required_params?.includes(p)?'<span class="required">(required)</span>':'<span class="optional">(optional)</span>'}</li>`).join('')}</ul>` : ''}
                        <h4>🔗 Example:</h4>
                        <code class="example-code">${ep.method||'GET'} ${escapeHtml(ep.example||c.base_path+ep.path)}</code>
                        <button class="test-this-btn" onclick="switchToTabAndTest('${c.id}','${escapeHtml(ep.name)}')"><i class="fas fa-play"></i> Test</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

function toggleEndpoint(header) {
    const card = header.closest('.endpoint-card');
    if(card) card.classList.toggle('expanded');
}

function updateDemoSelectors(cards) {
    const apiSelect = document.getElementById('apiSelect');
    apiSelect.innerHTML = '<option value="">Select API</option>' + cards.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    apiSelect.onchange = () => {
        const card = cards.find(c => c.id === apiSelect.value);
        if(card) {
            const epSelect = document.getElementById('endpointSelect');
            epSelect.innerHTML = '<option value="">Select endpoint</option>' + (card.endpoints||[]).map(ep => `<option value="${ep.name}">${ep.method||'GET'} ${escapeHtml(ep.name)}</option>`).join('');
            epSelect.onchange = () => {
                const ep = card.endpoints.find(e => e.name === epSelect.value);
                const paramDiv = document.getElementById('paramInput');
                if(ep?.params?.length) {
                    paramDiv.innerHTML = `<div class="param-group">${ep.params.map(p => `<div class="param-field"><label>${escapeHtml(p)} ${ep.required_params?.includes(p)?'<span class="required-star">*</span>':''}</label><input type="text" id="param_${p}" placeholder="Enter ${escapeHtml(p)}"></div>`).join('')}</div>`;
                } else {
                    paramDiv.innerHTML = '<input type="text" placeholder="No parameters needed" disabled>';
                }
            };
            epSelect.dispatchEvent(new Event('change'));
        }
    };
}

async function testAPI() {
    const apiSelect = document.getElementById('apiSelect');
    const epSelect = document.getElementById('endpointSelect');
    const output = document.getElementById('responseOutput');
    const card = apiData.find(c => c.id === apiSelect.value);
    if(!card) { output.innerHTML = '<code>// Select API first</code>'; return; }
    const ep = card.endpoints.find(e => e.name === epSelect.value);
    if(!ep) { output.innerHTML = '<code>// Select endpoint first</code>'; return; }
    let url = `${card.base_path}${ep.path}`;
    const params = {};
    if(ep.params) for(const p of ep.params) {
        const input = document.getElementById(`param_${p}`);
        if(input?.value) params[p] = input.value;
    }
    const qs = new URLSearchParams(params).toString();
    if(qs) url += `?${qs}`;
    output.innerHTML = '<code>Loading...</code>';
    try {
        const res = await fetch(url);
        const data = await res.json();
        output.innerHTML = `<code>${JSON.stringify(data, null, 2)}</code>`;
    } catch(e) { output.innerHTML = `<code>Error: ${e.message}</code>`; }
}

function copyResponse() {
    const pre = document.getElementById('responseOutput');
    if(pre) { navigator.clipboard.writeText(pre.innerText); showToast('Copied!'); }
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast-notification';
    t.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--success);color:#fff;padding:12px 20px;border-radius:8px;z-index:10000;animation:slideIn 0.3s';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function showError(msg) {
    const c = document.getElementById('apiCardsContainer');
    if(c) c.innerHTML = `<div class="error-message">${escapeHtml(msg)}</div>`;
}

function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }

// Tab Navigation
function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.nav-tab[data-tab="${tabId}"]`)?.classList.add('active');
    document.querySelectorAll('.mobile-nav-item[data-tab]').forEach(i => i.classList.remove('active'));
    document.querySelector(`.mobile-nav-item[data-tab="${tabId}"]`)?.classList.add('active');
    document.getElementById('mobileSidebar')?.classList.remove('open');
    history.pushState(null, '', `#${tabId}`);
}

function switchToTabAndSelect(tabId, apiId) {
    switchTab(tabId);
    setTimeout(() => { const sel = document.getElementById('apiSelect'); if(sel) { sel.value = apiId; sel.dispatchEvent(new Event('change')); } }, 100);
}

function switchToTabAndTest(apiId, epName) {
    switchTab('demo');
    setTimeout(() => {
        const apiSel = document.getElementById('apiSelect');
        const epSel = document.getElementById('endpointSelect');
        if(apiSel) { apiSel.value = apiId; apiSel.dispatchEvent(new Event('change')); }
        setTimeout(() => {
            if(epSel) { epSel.value = epName; epSel.dispatchEvent(new Event('change')); }
            setTimeout(() => document.getElementById('testBtn')?.click(), 100);
        }, 100);
    }, 100);
}

function toggleMobileMenu() { document.getElementById('mobileSidebar')?.classList.toggle('open'); }

document.addEventListener('DOMContentLoaded', () => {
    loadStats(); loadAPIs();
    document.querySelectorAll('.nav-tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    document.querySelectorAll('.mobile-nav-item[data-tab]').forEach(i => i.addEventListener('click', () => switchTab(i.dataset.tab)));
    document.getElementById('testBtn')?.addEventListener('click', testAPI);
    const hash = window.location.hash.substring(1);
    if(['dashboard','apis','demo','docs'].includes(hash)) switchTab(hash);
    else switchTab('dashboard');
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('mobileSidebar');
        const btn = document.querySelector('.menu-btn');
        if(sidebar?.classList.contains('open') && !sidebar.contains(e.target) && !btn?.contains(e.target)) sidebar.classList.remove('open');
    });
});
