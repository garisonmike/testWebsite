const API_URL = 'http://localhost:3000';

// Check session on load
window.onload = async () => {
    const user = await checkSession();
    if (user) {
        await loadConfig();
    }
};

async function checkSession() {
    try {
        const res = await fetch(`${API_URL}/api/session`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            return data.user;
        }
    } catch (e) { }
    return null;
}

function showSignup() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
}

async function signup() {
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;

    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            showSetupView();
        } else {
            const data = await res.json();
            alert(data.error || 'Signup failed');
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            await loadConfig();
        } else {
            alert('Invalid credentials');
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function loadConfig() {
    try {
        const res = await fetch(`${API_URL}/api/config`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            if (data.os && data.webServer) {
                showSuccessView(data);
            } else {
                showSetupView();
            }
        }
    } catch (e) {
        alert('Error loading config: ' + e.message);
    }
}

function updateWebServers() {
    const os = document.getElementById('osSelect').value;
    const webServerSelect = document.getElementById('webServerSelect');
    webServerSelect.innerHTML = '<option value="">Select Web Server</option>';

    if (os.includes('Windows')) {
        webServerSelect.innerHTML += '<option value="IIS">IIS</option>';
        webServerSelect.innerHTML += '<option value="Apache">Apache</option>';
        webServerSelect.innerHTML += '<option value="Nginx">Nginx</option>';
    } else {
        webServerSelect.innerHTML += '<option value="Apache">Apache</option>';
        webServerSelect.innerHTML += '<option value="Nginx">Nginx</option>';
    }
}

async function saveConfig() {
    const os = document.getElementById('osSelect').value;
    const webServer = document.getElementById('webServerSelect').value;

    if (!os || !webServer) {
        alert('Please select both OS and Web Server');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ os, webServer })
        });

        if (res.ok) {
            const data = await res.json();
            showSuccessView(data);
        } else {
            alert('Error saving configuration');
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function showSetupView() {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('setupView').classList.remove('hidden');
    document.getElementById('successView').classList.add('hidden');
}

function showSuccessView(config) {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('setupView').classList.add('hidden');
    document.getElementById('successView').classList.remove('hidden');

    const details = `
        <div><strong>OS:</strong> ${config.os}</div>
        <div><strong>Web Server:</strong> ${config.webServer}</div>
    `;
    document.getElementById('configDetails').innerHTML = details;
}

function editConfig() {
    showSetupView();
}

async function logout() {
    try {
        await fetch(`${API_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        location.reload();
    } catch (e) {
        alert('Error logging out: ' + e.message);
    }
}
