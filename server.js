const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { Client: PgClient } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

const usePg = !!process.env.DATABASE_URL;
let pgClient = null;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// SQLite fallback
const sqliteDbPath = path.join(DATA_DIR, 'app.db');
const sqliteDb = new sqlite3.Database(sqliteDbPath);

async function initPg() {
  if (!usePg) return;
  pgClient = new PgClient({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  // create tables if not exists (Postgres)
  await pgClient.query(`CREATE TABLE IF NOT EXISTS profiles (
    name TEXT PRIMARY KEY,
    names TEXT,
    positions TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )`);
  await pgClient.query(`CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    sondeIdx INTEGER,
    label TEXT,
    temp REAL,
    date TEXT,
    heure TEXT,
    ts TEXT,
    createdAt TEXT
  )`);
}

// Initialize sqlite tables
sqliteDb.serialize(() => {
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS profiles (
    name TEXT PRIMARY KEY,
    names TEXT,
    positions TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )`);
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sondeIdx INTEGER,
    label TEXT,
    temp REAL,
    date TEXT,
    heure TEXT,
    ts TEXT,
    createdAt TEXT
  )`);
});

// Start PG if configured
if (usePg) {
  initPg().then(() => console.log('Connected to Postgres')).catch(err => console.error('PG init error', err));
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Content Security Policy: allow self, images, CDN scripts and trusted inline styles for now.
// Short-term: include 'unsafe-inline' to avoid blocking existing inline <script> blocks.
// Longer-term: remove 'unsafe-inline' and use nonces or script hashes, or move inline scripts to external files.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://cdn.jsdelivr.net/npm",
  "connect-src 'self' wss: wss://* https:",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'"
].join('; ');
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  next();
});

function requireApiToken(req, res, next) {
  const token = process.env.API_TOKEN;
  if (!token) return next(); // no token configured -> open
  const provided = req.headers['x-api-token'] || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (provided !== token) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', env: usePg ? 'postgres' : 'sqlite' }));

// Profiles list (returns full profiles)
app.get('/api/profiles', async (req, res) => {
  try {
    if (usePg && pgClient) {
      const { rows } = await pgClient.query('SELECT name, names, positions, createdAt, updatedAt FROM profiles ORDER BY updatedAt DESC');
      const profiles = rows.map(r => ({ name: r.name, names: JSON.parse(r.names || '[]'), positions: JSON.parse(r.positions || '[]'), createdAt: r.createdat, updatedAt: r.updatedat }));
      return res.json(profiles);
    }
    sqliteDb.all('SELECT name, names, positions, createdAt, updatedAt FROM profiles ORDER BY updatedAt DESC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const profiles = rows.map(r => ({ name: r.name, names: JSON.parse(r.names || '[]'), positions: JSON.parse(r.positions || '[]'), createdAt: r.createdAt, updatedAt: r.updatedAt }));
      res.json(profiles);
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/profiles/:name', async (req, res) => {
  const { name } = req.params;
  try {
    if (usePg && pgClient) {
      const { rows } = await pgClient.query('SELECT name, names, positions, createdAt, updatedAt FROM profiles WHERE name = $1', [name]);
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Profil non trouvé' });
      const row = rows[0];
      return res.json({ name: row.name, names: JSON.parse(row.names || '[]'), positions: JSON.parse(row.positions || '[]'), createdAt: row.createdat, updatedAt: row.updatedat });
    }
    sqliteDb.get('SELECT name, names, positions, createdAt, updatedAt FROM profiles WHERE name = ?', [name], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Profil non trouvé' });
      res.json({ name: row.name, names: JSON.parse(row.names || '[]'), positions: JSON.parse(row.positions || '[]'), createdAt: row.createdAt, updatedAt: row.updatedAt });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Protected endpoints for creating/updating/deleting profiles
app.post('/api/profiles', requireApiToken, async (req, res) => {
  const { name, names, positions } = req.body;
  if (!name || !Array.isArray(names) || !Array.isArray(positions)) return res.status(400).json({ error: 'Payload invalide' });
  const now = new Date().toISOString();
  try {
    if (usePg && pgClient) {
      await pgClient.query(`INSERT INTO profiles (name, names, positions, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (name) DO UPDATE SET names = EXCLUDED.names, positions = EXCLUDED.positions, updatedAt = EXCLUDED.updatedAt`, [name, JSON.stringify(names), JSON.stringify(positions), now, now]);
      return res.json({ name, names, positions, createdAt: now, updatedAt: now });
    }
    sqliteDb.run(`INSERT INTO profiles (name, names, positions, createdAt, updatedAt) VALUES (?,?,?,?,?)
      ON CONFLICT(name) DO UPDATE SET names = excluded.names, positions = excluded.positions, updatedAt = excluded.updatedAt`, [name, JSON.stringify(names), JSON.stringify(positions), now, now], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ name, names, positions, createdAt: now, updatedAt: now });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/profiles/:name', requireApiToken, async (req, res) => {
  const { name } = req.params;
  try {
    if (usePg && pgClient) {
      const result = await pgClient.query('DELETE FROM profiles WHERE name = $1', [name]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Profil non trouvé' });
      return res.json({ success: true });
    }
    sqliteDb.run('DELETE FROM profiles WHERE name = ?', [name], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Profil non trouvé' });
      res.json({ success: true });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/logs', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 200;
  try {
    if (usePg && pgClient) {
      const { rows } = await pgClient.query('SELECT * FROM logs ORDER BY id DESC LIMIT $1', [limit]);
      return res.json(rows);
    }
    sqliteDb.all('SELECT * FROM logs ORDER BY id DESC LIMIT ?', [limit], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/logs', requireApiToken, async (req, res) => {
  const { sondeIdx, label, temp, date, heure, ts } = req.body;
  if (typeof sondeIdx !== 'number' || typeof temp !== 'number') return res.status(400).json({ error: 'Payload invalide' });
  const createdAt = new Date().toISOString();
  try {
    if (usePg && pgClient) {
      const { rows } = await pgClient.query('INSERT INTO logs (sondeIdx, label, temp, date, heure, ts, createdAt) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [sondeIdx, label || '', temp, date || '', heure || '', ts || '', createdAt]);
      return res.json(rows[0]);
    }
    sqliteDb.run('INSERT INTO logs (sondeIdx, label, temp, date, heure, ts, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [sondeIdx, label || '', temp, date || '', heure || '', ts || '', createdAt], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, sondeIdx, label, temp, date, heure, ts, createdAt });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT} (usePg=${usePg})`);
});
