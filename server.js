const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { Client: PgClient } = require('pg');
const mqtt = require('mqtt');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const MQTT_HOST = process.env.MQTT_HOST || 'broker.hivemq.com';
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '8884', 10);
const TOPIC_ROOT = process.env.TOPIC_ROOT || 'temperatures';
const NB_SONDES = parseInt(process.env.NB_SONDES || '5', 10);
const SONDE_NAMES = Array.from({ length: NB_SONDES }, (_, i) => `Sonde${i + 1}`);
let mqttClient = null;

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
  await pgClient.query(`CREATE TABLE IF NOT EXISTS totem_specs (
    id INTEGER PRIMARY KEY DEFAULT 1,
    height TEXT,
    width TEXT,
    depth TEXT,
    watt TEXT,
    environment TEXT,
    color TEXT,
    updatedAt TEXT
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
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS totem_specs (
    id INTEGER PRIMARY KEY DEFAULT 1,
    height TEXT,
    width TEXT,
    depth TEXT,
    watt TEXT,
    environment TEXT,
    color TEXT,
    updatedAt TEXT
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

function inferSondeIdxFromName(name) {
  if (!name || typeof name !== 'string') return -1;
  const directIdx = SONDE_NAMES.indexOf(name);
  if (directIdx >= 0) return directIdx;
  const match = name.match(/(\d+)/);
  if (!match) return -1;
  const parsed = parseInt(match[1], 10) - 1;
  if (Number.isNaN(parsed)) return -1;
  return parsed >= 0 && parsed < NB_SONDES ? parsed : -1;
}

function buildLogPayloadFromMqtt(data) {
  if (!data || typeof data !== 'object') return null;
  const temp = parseFloat(data.temp);
  if (Number.isNaN(temp)) return null;

  const sondeIdx = typeof data.sondeIdx === 'number'
    ? data.sondeIdx
    : inferSondeIdxFromName(data.nom || data.label || '');
  if (sondeIdx < 0 || sondeIdx >= NB_SONDES) return null;

  const now = new Date();
  return {
    sondeIdx,
    label: data.nom || `Sonde ${sondeIdx + 1}`,
    temp,
    date: now.toLocaleDateString('fr-FR'),
    heure: now.toLocaleTimeString('fr-FR'),
    ts: now.toISOString(),
    createdAt: now.toISOString()
  };
}

async function insertLogRecord({ sondeIdx, label, temp, date, heure, ts, createdAt }) {
  const resolvedCreatedAt = createdAt || new Date().toISOString();
  if (usePg && pgClient) {
    const { rows } = await pgClient.query(
      'INSERT INTO logs (sondeIdx, label, temp, date, heure, ts, createdAt) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [sondeIdx, label || '', temp, date || '', heure || '', ts || '', resolvedCreatedAt]
    );
    return rows[0];
  }

  return await new Promise((resolve, reject) => {
    sqliteDb.run(
      'INSERT INTO logs (sondeIdx, label, temp, date, heure, ts, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sondeIdx, label || '', temp, date || '', heure || '', ts || '', resolvedCreatedAt],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, sondeIdx, label, temp, date, heure, ts, createdAt: resolvedCreatedAt });
      }
    );
  });
}

function startMqttBackupConsumer() {
  const clientId = `render_backup_${Math.random().toString(16).slice(2, 10)}`;
  mqttClient = mqtt.connect(`wss://${MQTT_HOST}:${MQTT_PORT}/mqtt`, {
    clientId,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10000
  });

  mqttClient.on('connect', () => {
    const topic = `${TOPIC_ROOT}/#`;
    mqttClient.subscribe(topic, err => {
      if (err) {
        console.error('MQTT subscribe error', err.message);
      } else {
        console.log(`MQTT backup consumer subscribed to ${topic}`);
      }
    });
  });

  mqttClient.on('error', err => {
    console.error('MQTT client error', err.message);
  });

  mqttClient.on('message', async (topic, message) => {
    if (topic === `${TOPIC_ROOT}/ventilateurs`) return;
    let parsed;
    try {
      parsed = JSON.parse(message.toString());
    } catch {
      return;
    }

    const payload = buildLogPayloadFromMqtt(parsed);
    if (!payload) return;

    try {
      await insertLogRecord(payload);
    } catch (error) {
      console.error('MQTT backup insert error', error.message);
    }
  });
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

// Totem specs — single-row upsert (id always = 1)
app.get('/api/totem-specs', async (req, res) => {
  try {
    if (usePg && pgClient) {
      const { rows } = await pgClient.query('SELECT * FROM totem_specs WHERE id = 1');
      return res.json(rows[0] || {});
    }
    sqliteDb.get('SELECT * FROM totem_specs WHERE id = 1', [], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || {});
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/totem-specs', requireApiToken, async (req, res) => {
  const { height, width, depth, watt, environment, color } = req.body;
  const now = new Date().toISOString();
  try {
    if (usePg && pgClient) {
      await pgClient.query(
        `INSERT INTO totem_specs (id, height, width, depth, watt, environment, color, updatedAt)
         VALUES (1, $1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET height=EXCLUDED.height, width=EXCLUDED.width, depth=EXCLUDED.depth,
           watt=EXCLUDED.watt, environment=EXCLUDED.environment, color=EXCLUDED.color, updatedAt=EXCLUDED.updatedAt`,
        [height||'', width||'', depth||'', watt||'', environment||'', color||'', now]
      );
      return res.json({ height, width, depth, watt, environment, color, updatedAt: now });
    }
    sqliteDb.run(
      `INSERT INTO totem_specs (id, height, width, depth, watt, environment, color, updatedAt)
       VALUES (1,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET height=excluded.height, width=excluded.width, depth=excluded.depth,
         watt=excluded.watt, environment=excluded.environment, color=excluded.color, updatedAt=excluded.updatedAt`,
      [height||'', width||'', depth||'', watt||'', environment||'', color||'', now],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ height, width, depth, watt, environment, color, updatedAt: now });
      }
    );
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
  try {
    const saved = await insertLogRecord({ sondeIdx, label, temp, date, heure, ts, createdAt: new Date().toISOString() });
    return res.json(saved);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT} (usePg=${usePg})`);
  startMqttBackupConsumer();
});
