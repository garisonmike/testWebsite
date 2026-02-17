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
app.use(express.json());
app.use(express.static('.'));
app.use(session({
    secret: 'lab-secret-' + crypto.randomBytes(16).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Hash password
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Routes
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const hashedPassword = hashPassword(password);
        const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);
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

    const hashedPassword = hashPassword(password);
    const user = db.prepare('SELECT id FROM users WHERE username = ? AND password = ?').get(username, hashedPassword);

    if (user) {
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
    req.session.destroy();
    res.json({ success: true });
});

app.post('/api/config', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { os, webServer } = req.body;

    if (!os || !webServer) {
        return res.status(400).json({ error: 'OS and Web Server required' });
    }

    // Delete old config
    db.prepare('DELETE FROM configs WHERE user_id = ?').run(req.session.userId);

    // Insert new config
    db.prepare('INSERT INTO configs (user_id, os, web_server) VALUES (?, ?, ?)').run(req.session.userId, os, webServer);

    res.json({ os, webServer });
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
