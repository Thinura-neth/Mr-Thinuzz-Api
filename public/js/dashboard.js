const API_BASE = window.location.origin;
let userData = null;

async function loadUser() {
    const apiKey = localStorage.getItem('apiKey');
    if (!apiKey) {
        window.location.href = '/';
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'x-api-key': apiKey }
        });
        if (!res.ok) throw new Error('Invalid session');
        userData = await res.json();
        userData = userData.user;
        document.getElementById('coins-balance').innerText = userData.coins;
        document.getElementById('api-key-value').innerText = userData.apiKey;
        document.getElementById('profile-name').innerText = userData.name;
        document.getElementById('profile-email').innerText = userData.email;
        document.getElementById('profile-coins').innerText = userData.coins;
    } catch (err) {
        localStorage.removeItem('apiKey');
        window.location.href = '/';
    }
}

async function testAPI(endpoint, resultDiv, action = '', paramKey = '', paramValue = '') {
    const apiKey = localStorage.getItem('apiKey');
    if (!apiKey) {
        resultDiv.innerText = '❌ Not logged in';
        return;
    }
    let url = `${API_BASE}/api/request?endpoint=${endpoint}&api_key=${apiKey}`;
    if (action) url += `&action=${action}`;
    if (paramKey && paramValue) url += `&${paramKey}=${encodeURIComponent(paramValue)}`;
    
    try {
        resultDiv.innerText = '⏳ Processing... (1 coin)';
        const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
        const data = await res.json();
        if (res.ok) {
            resultDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
            await loadUser(); // refresh coin balance
        } else {
            resultDiv.innerHTML = `❌ Error: ${data.error}`;
        }
    } catch (err) {
        resultDiv.innerHTML = `❌ Network error: ${err.message}`;
    }
}

// Sidebar navigation and API card rendering (your existing logic)
// ... (keep your existing sidebar and API rendering code, but update fetch calls to use API_BASE and add x-api-key header where needed)
// For brevity, I'm showing only the core changes. Your existing dashboard.js can be adapted.

document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('apiKey');
    window.location.href = '/';
});

loadUser();
