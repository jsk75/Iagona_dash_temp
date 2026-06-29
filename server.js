const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { Client: PgClient } = require('pg');
const mqtt = require('mqtt');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

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
    targets TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )`);
  await pgClient.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS targets TEXT');
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
    name TEXT,
    height TEXT,
    width TEXT,
    depth TEXT,
    watt TEXT,
    environment TEXT,
    color TEXT,
    sunExposure TEXT,
    updatedAt TEXT
  )`);
  await pgClient.query('ALTER TABLE totem_specs ADD COLUMN IF NOT EXISTS sunExposure TEXT');
  await pgClient.query(`CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updatedAt TEXT
  )`);
  await pgClient.query(`CREATE TABLE IF NOT EXISTS fan_events (
    id SERIAL PRIMARY KEY,
    fanGroup TEXT,
    fanIndex INTEGER,
    fanLabel TEXT,
    eventType TEXT,
    previousValue TEXT,
    nextValue TEXT,
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
    targets TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )`);
  sqliteDb.run(`ALTER TABLE profiles ADD COLUMN targets TEXT`, (err) => {
    if (err && !String(err.message || '').includes('duplicate column name')) {
      console.error('SQLite ALTER TABLE profiles targets error', err);
    }
  });
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
    name TEXT,
    height TEXT,
    width TEXT,
    depth TEXT,
    watt TEXT,
    environment TEXT,
    color TEXT,
    sunExposure TEXT,
    updatedAt TEXT
  )`, (err) => { if (err) console.error('SQLite CREATE TABLE totem_specs error', err); });
  sqliteDb.run(`ALTER TABLE totem_specs ADD COLUMN sunExposure TEXT`, (err) => {
    if (err && !String(err.message || '').includes('duplicate column name')) {
      console.error('SQLite ALTER TABLE totem_specs sunExposure error', err);
    }
  });
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updatedAt TEXT
  )`, (err) => { if (err) console.error('SQLite CREATE TABLE app_config error', err); });
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS fan_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fanGroup TEXT,
    fanIndex INTEGER,
    fanLabel TEXT,
    eventType TEXT,
    previousValue TEXT,
    nextValue TEXT,
    date TEXT,
    heure TEXT,
    ts TEXT,
    createdAt TEXT
  )`, (err) => { if (err) console.error('SQLite CREATE TABLE fan_events error', err); });
});

// Start PG if configured
if (usePg) {
  initPg().then(() => console.log('Connected to Postgres')).catch(err => console.error('PG init error', err));
}

app.use(cors());
app.use(express.json({ limit: '15mb' }));
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

function linearTrend(values) {
  if (!Array.isArray(values) || values.length < 2) return 0;
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = Number(values[i]) || 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denominator = (n * sumXX) - (sumX * sumX);
  if (!denominator) return 0;
  return ((n * sumXY) - (sumX * sumY)) / denominator;
}

function trendLabel(values) {
  const slope = linearTrend(values);
  if (slope > 0.02) return 'Hausse';
  if (slope < -0.02) return 'Baisse';
  return 'Stable';
}

function computeIndicativeThermal(specs = {}, weatherContext = {}) {
  const parseMmToM = (value) => {
    const normalized = String(value ?? '').replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed / 1000 : null;
  };

  const baseWatt = Number(specs.watt);
  if (!Number.isFinite(baseWatt) || baseWatt <= 0) {
    return {
      coefficient: 1,
      adjustedWatt: null,
      surplusWatt: null,
      note: 'Watt non renseigné.',
      details: null
    };
  }

  const environment = String(specs.environment || '').toLowerCase();
  const color = String(specs.color || '').toLowerCase();
  const sunExposure = String(specs.sunExposure || '').toLowerCase();

  if (environment !== 'outdoor') {
    return {
      coefficient: 1,
      adjustedWatt: Number(baseWatt.toFixed(1)),
      surplusWatt: 0,
      note: 'Indoor: pas de correction climatique appliquée.',
      details: null
    };
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const orientationFactors = {
    nord: 0.65,
    est: 0.90,
    sud: 1.00,
    ouest: 0.92,
    faible: 0.45,
    moyenne: 0.70,
    forte: 0.90,
    directe: 1.00
  };
  const absorptivityByColor = {
    noir: 0.95,
    blanc: 0.22,
    gris: 0.55,
    vert: 0.65
  };

  const orientationFactor = orientationFactors[sunExposure] || 0.75;
  const alpha = absorptivityByColor[color] || 0.60;
  const solar = Number(weatherContext && weatherContext.solarMJm2Day);
  const wind = Number(weatherContext && weatherContext.windKmh);

  const meanG = Number.isFinite(solar) ? (solar * 11.574) : null;
  const gEffective = Number.isFinite(meanG) ? (meanG * orientationFactor) : null;

  const widthM = parseMmToM(specs.width);
  const heightM = parseMmToM(specs.height);
  const depthM = parseMmToM(specs.depth);
  const hasFullDims = !!(widthM && heightM && depthM);
  const faceFront = hasFullDims ? (widthM * heightM) : null;
  const faceSide = hasFullDims ? (depthM * heightM) : null;
  let areaProjectedBase = hasFullDims ? faceFront : 1.2;
  if (hasFullDims && (sunExposure === 'est' || sunExposure === 'ouest')) {
    areaProjectedBase = faceSide;
  }
  const areaProjected = Math.max(0.05, areaProjectedBase);
  const areaTotal = hasFullDims
    ? Math.max(0.2, 2 * ((widthM * heightM) + (heightM * depthM) + (widthM * depthM)))
    : 3.6;

  const windMs = Number.isFinite(wind) ? Math.max(0, wind / 3.6) : 0;
  const hConv = 5.7 + (3.8 * windMs);
  const hRad = 6;
  const hTotal = hConv + hRad;

  let qSite = null;
  if (Number.isFinite(wind) && wind > 0) {
    const rho = 1.225;
    const vSite = Math.max(0.5, wind / 3.6);
    qSite = 0.5 * rho * vSite * vSite;
  }

  const qSolar = Number.isFinite(gEffective) ? (alpha * gEffective * areaProjected) : 0;
  const transmissionToInternal = 0.35;
  const convectionAttenuation = clamp(11.7 / Math.max(8, hTotal), 0.45, 1.15);
  const projectedToTotalRatio = areaProjected / areaTotal;
  const geometricFactor = clamp(projectedToTotalRatio / 0.22, 0.70, 1.35);
  const surplusWatt = Number(Math.max(0, qSolar * transmissionToInternal * convectionAttenuation * geometricFactor).toFixed(1));
  const adjustedWatt = Number((baseWatt + surplusWatt).toFixed(1));
  const coefficient = Number((adjustedWatt / baseWatt).toFixed(3));

  const climateBits = [
    Number.isFinite(solar) ? `irradiation ${solar.toFixed(1)} MJ/m²/j` : null,
    Number.isFinite(meanG) ? `G~${meanG.toFixed(0)} W/m²` : null,
    Number.isFinite(wind) ? `vent ${wind.toFixed(1)} km/h` : null,
    Number.isFinite(qSite) ? `qsite ${qSite.toFixed(1)} N/m²` : null
  ].filter(Boolean);
  const note = `Surplus basé sur Qsolaire=alpha*G*Aproj (acier), convection h=5.7+3.8V, hrad~6 et vent EN 1991-1-4. Params: alpha=${alpha.toFixed(2)}, Aproj=${areaProjected.toFixed(2)} m², ${climateBits.join(', ') || 'indices indisponibles'}.`;
  return {
    coefficient,
    adjustedWatt,
    surplusWatt,
    note,
    details: {
      alpha,
      meanG,
      gEffective,
      areaProjected,
      areaTotal,
      geometricFactor,
      widthM,
      heightM,
      depthM,
      hConv,
      hRad,
      hTotal,
      qSolar,
      transmissionToInternal,
      convectionAttenuation
    }
  };
}

function parseMaybeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function getAppConfig(key) {
  if (usePg && pgClient) {
    const { rows } = await pgClient.query('SELECT key, value, updatedAt FROM app_config WHERE key = $1', [key]);
    return rows[0] || null;
  }
  return await new Promise((resolve, reject) => {
    sqliteDb.get('SELECT key, value, updatedAt FROM app_config WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

async function setAppConfig(key, value) {
  const now = new Date().toISOString();
  const serialized = JSON.stringify(value);
  if (usePg && pgClient) {
    await pgClient.query(
      `INSERT INTO app_config (key, value, updatedAt) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updatedAt = EXCLUDED.updatedAt`,
      [key, serialized, now]
    );
    return { key, value, updatedAt: now };
  }
  return await new Promise((resolve, reject) => {
    sqliteDb.run(
      `INSERT INTO app_config (key, value, updatedAt) VALUES (?,?,?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
      [key, serialized, now],
      function (err) {
        if (err) return reject(err);
        resolve({ key, value, updatedAt: now });
      }
    );
  });
}

async function getAllLogs(limit = 5000) {
  if (usePg && pgClient) {
    const { rows } = await pgClient.query('SELECT * FROM logs ORDER BY id ASC LIMIT $1', [limit]);
    return rows;
  }
  return await new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM logs ORDER BY id ASC LIMIT ?', [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function insertFanEventRecord({ fanGroup, fanIndex, fanLabel, eventType, previousValue, nextValue, date, heure, ts, createdAt }) {
  const resolvedCreatedAt = createdAt || new Date().toISOString();
  if (usePg && pgClient) {
    const { rows } = await pgClient.query(
      `INSERT INTO fan_events (fanGroup, fanIndex, fanLabel, eventType, previousValue, nextValue, date, heure, ts, createdAt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [fanGroup || '', fanIndex, fanLabel || '', eventType || '', previousValue || '', nextValue || '', date || '', heure || '', ts || '', resolvedCreatedAt]
    );
    return rows[0];
  }

  return await new Promise((resolve, reject) => {
    sqliteDb.run(
      `INSERT INTO fan_events (fanGroup, fanIndex, fanLabel, eventType, previousValue, nextValue, date, heure, ts, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fanGroup || '', fanIndex, fanLabel || '', eventType || '', previousValue || '', nextValue || '', date || '', heure || '', ts || '', resolvedCreatedAt],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, fanGroup, fanIndex, fanLabel, eventType, previousValue, nextValue, date, heure, ts, createdAt: resolvedCreatedAt });
      }
    );
  });
}

async function getAllFanEvents(limit = 5000) {
  if (usePg && pgClient) {
    const { rows } = await pgClient.query('SELECT * FROM fan_events ORDER BY id ASC LIMIT $1', [limit]);
    return rows;
  }
  return await new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM fan_events ORDER BY id ASC LIMIT ?', [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function buildExcelExportBuffer(payload = {}) {
  const {
    chartImageBase64,
    sensorLabels = SONDE_NAMES.map((name, index) => `Sonde ${index + 1}`),
    colors = [],
    sensorTargets = [],
    report = null,
    reportRange = null,
    weatherContext = null,
    specs = null,
    runtimeConfig = null,
    exportedAt = new Date().toISOString()
  } = payload;

  const logs = await getAllLogs();
  const fanEvents = await getAllFanEvents();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GitHub Copilot';
  workbook.created = new Date();

  const resolveSondeIndex = (entry) => {
    const raw = entry && entry.sondeIdx !== undefined ? entry.sondeIdx : (entry ? entry.sondeidx : undefined);
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) return -1;
    return parsed >= 0 && parsed < NB_SONDES ? parsed : -1;
  };

  const allSheet = workbook.addWorksheet('Toutes sondes');
  allSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Heure', key: 'heure', width: 12 },
    { header: 'Sonde', key: 'sonde', width: 24 },
    { header: 'Température (°C)', key: 'temp', width: 18 }
  ];
  logs.forEach(entry => {
    const idx = resolveSondeIndex(entry);
    const label = idx >= 0 ? (sensorLabels[idx] || `Sonde ${idx + 1}`) : (entry.label || 'Sonde inconnue');
    const date = entry.date || '';
    const heure = entry.heure || '';
    allSheet.addRow({ date, heure, sonde: label, temp: entry.temp });
  });

  const grouped = Array.from({ length: NB_SONDES }, () => []);
  logs.forEach(entry => {
    const idx = resolveSondeIndex(entry);
    if (idx >= 0) grouped[idx].push(entry);
  });

  grouped.forEach((entries, index) => {
    if (!entries.length) return;
    const sheet = workbook.addWorksheet((sensorLabels[index] || `Sonde ${index + 1}`).slice(0, 31));
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Heure', key: 'heure', width: 12 },
      { header: 'Température (°C)', key: 'temp', width: 18 }
    ];
    entries.forEach(entry => sheet.addRow({ date: entry.date || '', heure: entry.heure || '', temp: entry.temp }));
  });

  const summarySheet = workbook.addWorksheet('Tendances');
  summarySheet.columns = [
    { header: 'Sonde', key: 'sonde', width: 24 },
    { header: 'Min (°C)', key: 'min', width: 14 },
    { header: 'Max (°C)', key: 'max', width: 14 },
    { header: 'Moyenne (°C)', key: 'avg', width: 16 },
    { header: 'Tendance', key: 'trend', width: 14 },
    { header: 'Pente', key: 'slope', width: 12 }
  ];
  grouped.forEach((entries, index) => {
    if (!entries.length) return;
    const values = entries.map(entry => Number(entry.temp)).filter(value => !Number.isNaN(value));
    if (!values.length) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const slope = linearTrend(values);
    summarySheet.addRow({
      sonde: sensorLabels[index] || `Sonde ${index + 1}`,
      min,
      max,
      avg,
      trend: trendLabel(values),
      slope: Number(slope.toFixed(4))
    });
  });

  const specsSheet = workbook.addWorksheet('Fiche Totem');
  specsSheet.columns = [{ width: 24 }, { width: 36 }];
  const resolvedSpecs = specs || {};
  const thermalIndicative = computeIndicativeThermal(resolvedSpecs, weatherContext || {});
  const thermalDetails = thermalIndicative.details
    ? `dims=${Number(thermalIndicative.details.heightM).toFixed(2)}x${Number(thermalIndicative.details.widthM).toFixed(2)}x${Number(thermalIndicative.details.depthM).toFixed(2)} m, alpha=${Number(thermalIndicative.details.alpha).toFixed(2)}, G=${Number(thermalIndicative.details.meanG).toFixed(0)} W/m², Geff=${Number(thermalIndicative.details.gEffective).toFixed(0)} W/m², Aproj=${Number(thermalIndicative.details.areaProjected).toFixed(2)} m², Atot=${Number(thermalIndicative.details.areaTotal).toFixed(2)} m², facteurGeom=${Number(thermalIndicative.details.geometricFactor).toFixed(2)}, h=${Number(thermalIndicative.details.hConv).toFixed(1)} W/m²K, hrad=${Number(thermalIndicative.details.hRad).toFixed(1)} W/m²K, Qsolaire=${Number(thermalIndicative.details.qSolar).toFixed(1)} W, attenuation=${Number(thermalIndicative.details.convectionAttenuation).toFixed(2)}`
    : '--';
  const envLabel = { indoor: 'Indoor', outdoor: 'Outdoor' }[resolvedSpecs.environment] || resolvedSpecs.environment || '--';
  const exposureLabel = resolvedSpecs.environment === 'outdoor' ? (resolvedSpecs.sunExposure || '--') : '--';
  [
    ['Fiche Totem', ''],
    ['Nom', resolvedSpecs.name || '--'],
    ['Exporté le', new Date(exportedAt).toLocaleString('fr-FR')],
    ['', ''],
    ['Dimensions', ''],
    ['Hauteur (mm)', resolvedSpecs.height || '--'],
    ['Largeur (mm)', resolvedSpecs.width || '--'],
    ['Profondeur (mm)', resolvedSpecs.depth || '--'],
    ['', ''],
    ['Technique', ''],
    ['Watt à dissiper', resolvedSpecs.watt ? `${resolvedSpecs.watt} W` : '--'],
    ['Coefficient thermique indicatif', thermalIndicative.adjustedWatt === null ? '--' : thermalIndicative.coefficient.toFixed(2)],
    ['Watt ajusté indicatif', thermalIndicative.adjustedWatt === null ? '--' : `${thermalIndicative.adjustedWatt} W`],
    ['Surplus thermique indicatif', thermalIndicative.surplusWatt === null ? '--' : `${thermalIndicative.surplusWatt > 0 ? '+' : ''}${thermalIndicative.surplusWatt} W`],
    ['Détail calcul thermique', thermalDetails],
    ['Environnement', envLabel],
    ['Couleur', resolvedSpecs.environment === 'outdoor' ? (resolvedSpecs.color || '--') : '--'],
    ['Exposition au soleil', exposureLabel],
    ['Note', `${thermalIndicative.note} Le débit nominal ventilateur reste manuel.`]
  ].forEach(row => specsSheet.addRow(row));

  const configSheet = workbook.addWorksheet('Configuration');
  configSheet.columns = [{ width: 26 }, { width: 80 }];
  const resolvedConfig = runtimeConfig || {};
  configSheet.addRow(['Preset actif', resolvedConfig.activeProfile || 'default']);
  configSheet.addRow(['Noms sondes', (resolvedConfig.sensorNames || []).join(' | ') || '--']);
  configSheet.addRow(['Positions sondes', JSON.stringify(resolvedConfig.sensorPositions || [])]);
  configSheet.addRow(['Configuration ventilateurs', JSON.stringify(resolvedConfig.ventilation || {})]);

  const fanEventsSheet = workbook.addWorksheet('Événements Ventilos');
  fanEventsSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Heure', key: 'heure', width: 12 },
    { header: 'Ventilateur', key: 'fanLabel', width: 20 },
    { header: 'Groupe', key: 'fanGroup', width: 12 },
    { header: 'Type', key: 'eventType', width: 18 },
    { header: 'Avant', key: 'previousValue', width: 16 },
    { header: 'Après', key: 'nextValue', width: 16 }
  ];
  fanEvents.forEach(event => {
    fanEventsSheet.addRow({
      date: event.date,
      heure: event.heure,
      fanLabel: event.fanlabel || event.fanLabel,
      fanGroup: event.fangroup || event.fanGroup,
      eventType: event.eventtype || event.eventType,
      previousValue: event.previousvalue || event.previousValue,
      nextValue: event.nextvalue || event.nextValue
    });
  });

  const chartSheet = workbook.addWorksheet('Courbes');
  chartSheet.columns = [{ width: 22 }, { width: 22 }, { width: 22 }];
  chartSheet.addRow(['Courbes de température', '', '']);
  chartSheet.addRow(['Exporté le', new Date(exportedAt).toLocaleString('fr-FR'), '']);
  if (chartImageBase64 && typeof chartImageBase64 === 'string') {
    const cleaned = chartImageBase64.replace(/^data:image\/png;base64,/, '');
    const imageId = workbook.addImage({ base64: cleaned, extension: 'png' });
    chartSheet.addImage(imageId, {
      tl: { col: 0, row: 3 },
      ext: { width: 920, height: 420 }
    });
  }
  chartSheet.addRow([]);
  chartSheet.addRow([]);
  chartSheet.addRow([]);
  chartSheet.addRow([]);
  chartSheet.addRow([]);
  chartSheet.addRow([]);
  chartSheet.addRow([]);
  chartSheet.addRow([]);
  chartSheet.addRow(['Sonde', 'Couleur', 'Tendance']);
  grouped.forEach((entries, index) => {
    if (!entries.length) return;
    const values = entries.map(entry => Number(entry.temp)).filter(value => !Number.isNaN(value));
    chartSheet.addRow([
      sensorLabels[index] || `Sonde ${index + 1}`,
      colors[index] || '',
      trendLabel(values)
    ]);
  });

  const reportSheet = workbook.addWorksheet('Rapport Test');
  reportSheet.columns = [{ width: 30 }, { width: 30 }, { width: 22 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 }];
  reportSheet.addRow(['Rapport de test (24h)']);
  reportSheet.addRow(['Généré le', new Date(exportedAt).toLocaleString('fr-FR')]);
  if (reportRange) {
    const modeLabel = reportRange.mode === 'custom'
      ? 'Intervalle personnalisé'
      : reportRange.mode === 'current'
        ? 'Test courant'
        : 'Dernières 24h';
    reportSheet.addRow(['Période sélectionnée', modeLabel]);
    reportSheet.addRow(['Début sélection', reportRange.start ? new Date(reportRange.start).toLocaleString('fr-FR') : '--']);
    reportSheet.addRow(['Fin sélection', reportRange.end ? new Date(reportRange.end).toLocaleString('fr-FR') : '--']);
  }
  reportSheet.addRow([]);

  const resolvedReport = report || {};
  const statusText = resolvedReport.status === 'success' ? 'Réussite' : resolvedReport.status === 'failure' ? 'Échec' : '--';
  reportSheet.addRow(['Résultat Journée', statusText]);
  reportSheet.addRow(['Début Test', resolvedReport.testStart ? new Date(resolvedReport.testStart).toLocaleString('fr-FR') : '--']);
  reportSheet.addRow(['Fin Test', resolvedReport.testEnd ? new Date(resolvedReport.testEnd).toLocaleString('fr-FR') : '--']);
  reportSheet.addRow(['Durée Test', Number.isFinite(resolvedReport.durationMs) ? `${Math.floor(resolvedReport.durationMs / 3600000)}h ${Math.floor((resolvedReport.durationMs % 3600000) / 60000)}m` : '--']);
  reportSheet.addRow(['Température extérieure début', Number.isFinite(resolvedReport.exteriorStart) ? `${resolvedReport.exteriorStart.toFixed(1)} °C` : '--']);
  reportSheet.addRow(['Température extérieure fin', Number.isFinite(resolvedReport.exteriorEnd) ? `${resolvedReport.exteriorEnd.toFixed(1)} °C` : '--']);
  reportSheet.addRow(['Température intérieure moyenne début', Number.isFinite(resolvedReport.interiorStart) ? `${resolvedReport.interiorStart.toFixed(1)} °C` : '--']);
  reportSheet.addRow(['Température intérieure moyenne fin', Number.isFinite(resolvedReport.interiorEnd) ? `${resolvedReport.interiorEnd.toFixed(1)} °C` : '--']);
  reportSheet.addRow([]);
  reportSheet.addRow(['Sonde', 'Cible Min', 'Cible Max', 'Mesure Min', 'Mesure Max', 'Début', 'Fin', 'Statut']);

  const reportSensors = Array.isArray(resolvedReport.sensors) ? resolvedReport.sensors : [];
  if (reportSensors.length) {
    reportSensors.forEach(sensor => {
      reportSheet.addRow([
        sensor.label || '--',
        Number.isFinite(sensor.tmin) ? `${Number(sensor.tmin).toFixed(1)} °C` : '--',
        Number.isFinite(sensor.tmax) ? `${Number(sensor.tmax).toFixed(1)} °C` : '--',
        Number.isFinite(sensor.min) ? `${Number(sensor.min).toFixed(2)} °C` : '--',
        Number.isFinite(sensor.max) ? `${Number(sensor.max).toFixed(2)} °C` : '--',
        Number.isFinite(sensor.start) ? `${Number(sensor.start).toFixed(2)} °C` : '--',
        Number.isFinite(sensor.end) ? `${Number(sensor.end).toFixed(2)} °C` : '--',
        sensor.pass ? 'Réussite' : 'Échec'
      ]);
    });
  } else {
    for (let i = 0; i < NB_SONDES; i++) {
      const t = sensorTargets[i] || {};
      reportSheet.addRow([
        sensorLabels[i] || `Sonde ${i + 1}`,
        Number.isFinite(t.min) ? `${Number(t.min).toFixed(1)} °C` : '--',
        Number.isFinite(t.max) ? `${Number(t.max).toFixed(1)} °C` : '--',
        '--', '--', '--', '--', '--'
      ]);
    }
  }

  return workbook.xlsx.writeBuffer();
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
      const { rows } = await pgClient.query('SELECT name, names, positions, targets, createdAt, updatedAt FROM profiles ORDER BY updatedAt DESC');
      const profiles = rows.map(r => ({ name: r.name, names: JSON.parse(r.names || '[]'), positions: JSON.parse(r.positions || '[]'), targets: JSON.parse(r.targets || '[]'), createdAt: r.createdat, updatedAt: r.updatedat }));
      return res.json(profiles);
    }
    sqliteDb.all('SELECT name, names, positions, targets, createdAt, updatedAt FROM profiles ORDER BY updatedAt DESC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const profiles = rows.map(r => ({ name: r.name, names: JSON.parse(r.names || '[]'), positions: JSON.parse(r.positions || '[]'), targets: JSON.parse(r.targets || '[]'), createdAt: r.createdAt, updatedAt: r.updatedAt }));
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
      const { rows } = await pgClient.query('SELECT name, names, positions, targets, createdAt, updatedAt FROM profiles WHERE name = $1', [name]);
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Profil non trouvé' });
      const row = rows[0];
      return res.json({ name: row.name, names: JSON.parse(row.names || '[]'), positions: JSON.parse(row.positions || '[]'), targets: JSON.parse(row.targets || '[]'), createdAt: row.createdat, updatedAt: row.updatedat });
    }
    sqliteDb.get('SELECT name, names, positions, targets, createdAt, updatedAt FROM profiles WHERE name = ?', [name], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Profil non trouvé' });
      res.json({ name: row.name, names: JSON.parse(row.names || '[]'), positions: JSON.parse(row.positions || '[]'), targets: JSON.parse(row.targets || '[]'), createdAt: row.createdAt, updatedAt: row.updatedAt });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Protected endpoints for creating/updating/deleting profiles
app.post('/api/profiles', requireApiToken, async (req, res) => {
  const { name, names, positions, targets } = req.body;
  if (!name || !Array.isArray(names) || !Array.isArray(positions)) return res.status(400).json({ error: 'Payload invalide' });
  const resolvedTargets = Array.isArray(targets) ? targets : [];
  const now = new Date().toISOString();
  try {
    if (usePg && pgClient) {
      await pgClient.query(`INSERT INTO profiles (name, names, positions, targets, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (name) DO UPDATE SET names = EXCLUDED.names, positions = EXCLUDED.positions, targets = EXCLUDED.targets, updatedAt = EXCLUDED.updatedAt`, [name, JSON.stringify(names), JSON.stringify(positions), JSON.stringify(resolvedTargets), now, now]);
      return res.json({ name, names, positions, targets: resolvedTargets, createdAt: now, updatedAt: now });
    }
    sqliteDb.run(`INSERT INTO profiles (name, names, positions, targets, createdAt, updatedAt) VALUES (?,?,?,?,?,?)
      ON CONFLICT(name) DO UPDATE SET names = excluded.names, positions = excluded.positions, targets = excluded.targets, updatedAt = excluded.updatedAt`, [name, JSON.stringify(names), JSON.stringify(positions), JSON.stringify(resolvedTargets), now, now], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ name, names, positions, targets: resolvedTargets, createdAt: now, updatedAt: now });
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
  const { name, height, width, depth, watt, environment, color, sunExposure } = req.body;
  const resolvedColor = environment === 'outdoor' ? (color || '') : '';
  const resolvedSunExposure = environment === 'outdoor' ? (sunExposure || '') : '';
  const now = new Date().toISOString();
  try {
    if (usePg && pgClient) {
      await pgClient.query(
        `INSERT INTO totem_specs (id, name, height, width, depth, watt, environment, color, sunExposure, updatedAt)
         VALUES (1, $1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, height=EXCLUDED.height, width=EXCLUDED.width, depth=EXCLUDED.depth,
           watt=EXCLUDED.watt, environment=EXCLUDED.environment, color=EXCLUDED.color, sunExposure=EXCLUDED.sunExposure, updatedAt=EXCLUDED.updatedAt`,
        [name||'', height||'', width||'', depth||'', watt||'', environment||'', resolvedColor, resolvedSunExposure, now]
      );
      return res.json({ name, height, width, depth, watt, environment, color: resolvedColor, sunExposure: resolvedSunExposure, updatedAt: now });
    }
    sqliteDb.run(
      `INSERT INTO totem_specs (id, name, height, width, depth, watt, environment, color, sunExposure, updatedAt)
       VALUES (1,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, height=excluded.height, width=excluded.width, depth=excluded.depth,
         watt=excluded.watt, environment=excluded.environment, color=excluded.color, sunExposure=excluded.sunExposure, updatedAt=excluded.updatedAt`,
      [name||'', height||'', width||'', depth||'', watt||'', environment||'', resolvedColor, resolvedSunExposure, now],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ name, height, width, depth, watt, environment, color: resolvedColor, sunExposure: resolvedSunExposure, updatedAt: now });
      }
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/config/:key', async (req, res) => {
  try {
    const entry = await getAppConfig(req.params.key);
    if (!entry) return res.json({ key: req.params.key, value: null, updatedAt: null });
    return res.json({ key: entry.key, value: parseMaybeJson(entry.value, null), updatedAt: entry.updatedAt || entry.updatedat || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/config/:key', requireApiToken, async (req, res) => {
  try {
    const { value } = req.body || {};
    const saved = await setAppConfig(req.params.key, value);
    res.json(saved);
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

app.get('/api/fan-events', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  try {
    if (usePg && pgClient) {
      const { rows } = await pgClient.query('SELECT * FROM fan_events ORDER BY id DESC LIMIT $1', [limit]);
      return res.json(rows);
    }
    sqliteDb.all('SELECT * FROM fan_events ORDER BY id DESC LIMIT ?', [limit], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/fan-events', requireApiToken, async (req, res) => {
  const { fanGroup, fanIndex, fanLabel, eventType, previousValue, nextValue, date, heure, ts } = req.body || {};
  if (typeof fanIndex !== 'number' || !eventType) return res.status(400).json({ error: 'Payload invalide' });
  try {
    const saved = await insertFanEventRecord({
      fanGroup,
      fanIndex,
      fanLabel,
      eventType,
      previousValue,
      nextValue,
      date,
      heure,
      ts,
      createdAt: new Date().toISOString()
    });
    res.json(saved);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/export/excel', async (req, res) => {
  try {
    const specsEntry = await getAppConfig('runtime_state');
    const runtimeState = specsEntry ? parseMaybeJson(specsEntry.value, {}) : {};

    let resolvedSpecs = {};
    if (usePg && pgClient) {
      const { rows } = await pgClient.query('SELECT * FROM totem_specs WHERE id = 1');
      resolvedSpecs = rows[0] || {};
    } else {
      resolvedSpecs = await new Promise((resolve, reject) => {
        sqliteDb.get('SELECT * FROM totem_specs WHERE id = 1', [], (err, row) => {
          if (err) return reject(err);
          resolve(row || {});
        });
      });
    }

    const buffer = await buildExcelExportBuffer({
      chartImageBase64: req.body && req.body.chartImageBase64,
      sensorLabels: req.body && req.body.sensorLabels,
      colors: req.body && req.body.colors,
      sensorTargets: req.body && req.body.sensorTargets,
      weatherContext: req.body && req.body.weatherContext,
      report: req.body && req.body.report,
      specs: resolvedSpecs,
      runtimeConfig: runtimeState,
      exportedAt: req.body && req.body.exportedAt
    });

    const rawTotemName = String((resolvedSpecs && resolvedSpecs.name) || '').trim();
    const safeTotemName = rawTotemName
      ? rawTotemName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9 _-]/g, ' ')
          .trim()
          .replace(/\s+/g, '_')
      : '';
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const timestamp = `${String(now.getFullYear()).slice(-2)}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}-${pad2(now.getHours())}-${pad2(now.getMinutes())}`;
    const filename = safeTotemName
      ? `${safeTotemName}_${timestamp}.xlsx`
      : `temperatures_${timestamp}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT} (usePg=${usePg})`);
  startMqttBackupConsumer();
});
