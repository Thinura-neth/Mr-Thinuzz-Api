// Endpoint configurations
const endpoints = {
    movie: {
        search: { param: 'q', placeholder: 'Enter movie name...', endpoint: '/movie/search' },
        recent: { param: null, placeholder: null, endpoint: '/movie/recent' },
        popular: { param: null, placeholder: null, endpoint: '/movie/popular' },
        info: { param: 'url', placeholder: 'Enter movie URL...', endpoint: '/movie/info' }
    },
    game: {
        search: { param: 'q', placeholder: 'Enter game name...', endpoint: '/game/fitgirl-search' },
        info: { param: 'url', placeholder: 'Enter FitGirl URL...', endpoint: '/game/fitgirl-info' },
        download: { param: 'url', placeholder: 'Enter fuckingfast.co URL...', endpoint: '/game/fitgirl-download' }
    },
    anime: {
        search: { param: 'q', placeholder: 'Enter anime name...', endpoint: '/anime/search' },
        popular: { param: null, placeholder: null, endpoint: '/anime/popular' },
        info: { param: 'id', placeholder: 'Enter anime ID...', endpoint: '/anime/info' }
    }
};

// Update endpoint select based on API category
function updateEndpoints() {
    const apiSelect = document.getElementById('apiSelect');
    const endpointSelect = document.getElementById('endpointSelect');
    const paramInput = document.getElementById('paramInput');
    
    const selectedAPI = apiSelect.value;
    const apiEndpoints = endpoints[selectedAPI];
    
    endpointSelect.innerHTML = '';
    
    for (const [key, config] of Object.entries(apiEndpoints)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key.charAt(0).toUpperCase() + key.slice(1);
        endpointSelect.appendChild(option);
    }
    
    updateParamInput();
}

// Update parameter input based on selected endpoint
function updateParamInput() {
    const apiSelect = document.getElementById('apiSelect');
    const endpointSelect = document.getElementById('endpointSelect');
    const paramInput = document.getElementById('paramInput');
    
    const selectedAPI = apiSelect.value;
    const selectedEndpoint = endpointSelect.value;
    const config = endpoints[selectedAPI][selectedEndpoint];
    
    if (config.param) {
        paramInput.innerHTML = `
            <input type="text" id="paramValue" placeholder="${config.placeholder}" autocomplete="off">
        `;
    } else {
        paramInput.innerHTML = `
            <input type="text" id="paramValue" placeholder="No parameters needed" disabled>
        `;
    }
}

// Test API endpoint
async function testAPI() {
    const apiSelect = document.getElementById('apiSelect');
    const endpointSelect = document.getElementById('endpointSelect');
    const paramValue = document.getElementById('paramValue');
    const responseOutput = document.getElementById('responseOutput');
    
    const selectedAPI = apiSelect.value;
    const selectedEndpoint = endpointSelect.value;
    const config = endpoints[selectedAPI][selectedEndpoint];
    
    let url = config.endpoint;
    
    if (config.param && paramValue && paramValue.value) {
        url += `?${config.param}=${encodeURIComponent(paramValue.value)}`;
    }
    
    responseOutput.innerHTML = '<code>Loading...</code>';
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        responseOutput.innerHTML = `<code>${JSON.stringify(data, null, 2)}</code>`;
    } catch (error) {
        responseOutput.innerHTML = `<code>Error: ${error.message}</code>`;
    }
}

// Copy code from hero section
function copyCode() {
    const code = document.querySelector('#quickCode code').innerText;
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
}

// Copy response
function copyResponse() {
    const response = document.querySelector('#responseOutput code').innerText;
    navigator.clipboard.writeText(response);
    alert('Response copied to clipboard!');
}

// Show category
function showCategory(category) {
    document.getElementById('apiSelect').value = category;
    updateEndpoints();
    document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
}

// Mobile menu toggle
function toggleMobileMenu() {
    const nav = document.querySelector('nav');
    nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
}

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

// Active link highlighting
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('nav a');
    
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    updateEndpoints();
    
    document.getElementById('apiSelect').addEventListener('change', updateEndpoints);
    document.getElementById('endpointSelect').addEventListener('change', updateParamInput);
    document.getElementById('testBtn').addEventListener('click', testAPI);
    document.querySelector('.menu-btn')?.addEventListener('click', toggleMobileMenu);
});
