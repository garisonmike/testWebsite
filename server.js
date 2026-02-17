const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const app = express();
const db = new Database('lab.db');

// Initialize database
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        os TEXT NOT NULL,
        web_server TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
`);

// Middleware
app.use(express.json({ limit: '50kb' }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'lab-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/app.js', (req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'app.js'));
});

function createPasswordHash(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    if (!storedPassword.includes(':')) {
        const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
        return storedPassword === legacyHash;
    }

    const [salt, hash] = storedPassword.split(':');
    const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

// Routes
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Invalid input' });
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 40 || password.length < 4) {
        return res.status(400).json({ error: 'Invalid username or password length' });
    }

    try {
        const hashedPassword = createPasswordHash(password);
        const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(cleanUsername, hashedPassword);
        req.session.userId = result.lastInsertRowid;
        res.json({ success: true });
    } catch (e) {
        if (e.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(500).json({ error: 'Server error' });
        }
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Invalid input' });
    }

    const cleanUsername = username.trim();
    const user = db.prepare('SELECT id, password FROM users WHERE username = ?').get(cleanUsername);

    if (user && verifyPassword(password, user.password)) {
        req.session.userId = user.id;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.session.userId);
        res.json({ user: user.username });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

app.post('/api/config', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { os, webServer } = req.body;

    if (!os || !webServer || typeof os !== 'string' || typeof webServer !== 'string') {
        return res.status(400).json({ error: 'OS and Web Server required' });
    }

    const cleanOs = os.trim().slice(0, 80);
    const cleanWebServer = webServer.trim().slice(0, 80);

    if (!cleanOs || !cleanWebServer) {
        return res.status(400).json({ error: 'OS and Web Server required' });
    }

    try {
        // Delete old config
        db.prepare('DELETE FROM configs WHERE user_id = ?').run(req.session.userId);

        // Insert new config
        db.prepare('INSERT INTO configs (user_id, os, web_server) VALUES (?, ?, ?)').run(req.session.userId, cleanOs, cleanWebServer);

        res.json({ os: cleanOs, webServer: cleanWebServer });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/config', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const config = db.prepare('SELECT os, web_server as webServer FROM configs WHERE user_id = ?').get(req.session.userId);

    if (config) {
        res.json(config);
    } else {
        res.json({});
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
