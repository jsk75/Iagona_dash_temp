const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(path.join(DATA_DIR, 'app.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS profiles (
    name TEXT PRIMARY KEY,
    names TEXT,
    positions TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS logs (
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

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/profiles', (req, res) => {
  db.all('SELECT name, names, positions, createdAt, updatedAt FROM profiles ORDER BY updatedAt DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const profiles = rows.map(row => ({
        name: row.name,
        names: JSON.parse(row.names || '[]'),
        positions: JSON.parse(row.positions || '[]'),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
      res.json(profiles);
    } catch (parseError) {
      res.status(500).json({ error: parseError.message });
    }
  });
});

app.get('/api/profiles/:name', (req, res) => {
  const { name } = req.params;
  db.get('SELECT name, names, positions, createdAt, updatedAt FROM profiles WHERE name = ?', [name], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Profil non trouvé' });
    try {
      res.json({
        name: row.name,
        names: JSON.parse(row.names || '[]'),
        positions: JSON.parse(row.positions || '[]'),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      });
    } catch (parseError) {
      res.status(500).json({ error: parseError.message });
    }
  });
});

app.post('/api/profiles', (req, res) => {
  const { name, names, positions } = req.body;
  if (!name || !Array.isArray(names) || !Array.isArray(positions)) {
    return res.status(400).json({ error: 'Payload invalide' });
  }

  const now = new Date().toISOString();
  db.run(
    `INSERT INTO profiles (name, names, positions, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET names = excluded.names, positions = excluded.positions, updatedAt = excluded.updatedAt`,
    [name, JSON.stringify(names), JSON.stringify(positions), now, now],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ name, names, positions, createdAt: now, updatedAt: now });
    }
  );
});

app.delete('/api/profiles/:name', (req, res) => {
  const { name } = req.params;
  db.run('DELETE FROM profiles WHERE name = ?', [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Profil non trouvé' });
    res.json({ success: true });
  });
});

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 200;
  db.all('SELECT * FROM logs ORDER BY id DESC LIMIT ?', [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/logs', (req, res) => {
  const { sondeIdx, label, temp, date, heure, ts } = req.body;
  if (typeof sondeIdx !== 'number' || typeof temp !== 'number') {
    return res.status(400).json({ error: 'Payload invalide' });
  }

  const createdAt = new Date().toISOString();
  db.run(
    'INSERT INTO logs (sondeIdx, label, temp, date, heure, ts, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [sondeIdx, label || '', temp, date || '', heure || '', ts || '', createdAt],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, sondeIdx, label, temp, date, heure, ts, createdAt });
    }
  );
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
