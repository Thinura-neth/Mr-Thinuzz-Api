const API_BASE = window.location.origin;

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(`${tab}-form`).classList.add('active');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Register
document.getElementById('register-btn').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const alertDiv = document.getElementById('register-alert');
    if (!name || !email || !password) {
        alertDiv.textContent = 'All fields required';
        alertDiv.classList.add('error');
        return;
    }
    if (password.length < 6) {
        alertDiv.textContent = 'Password must be at least 6 characters';
        alertDiv.classList.add('error');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('apiKey', data.apiKey);
            alertDiv.textContent = 'Registration successful! Redirecting...';
            alertDiv.classList.add('success');
            setTimeout(() => window.location.href = '/dashboard', 1500);
        } else {
            alertDiv.textContent = data.error || 'Registration failed';
            alertDiv.classList.add('error');
        }
    } catch (err) {
        alertDiv.textContent = err.message;
        alertDiv.classList.add('error');
    }
});

// Login
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const alertDiv = document.getElementById('login-alert');
    if (!email || !password) {
        alertDiv.textContent = 'Email and password required';
        alertDiv.classList.add('error');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('apiKey', data.apiKey);
            alertDiv.textContent = 'Login successful! Redirecting...';
            alertDiv.classList.add('success');
            setTimeout(() => window.location.href = '/dashboard', 1000);
        } else {
            alertDiv.textContent = data.error || 'Login failed';
            alertDiv.classList.add('error');
        }
    } catch (err) {
        alertDiv.textContent = err.message;
        alertDiv.classList.add('error');
    }
});
