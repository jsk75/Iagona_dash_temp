// Externalized frontend script extracted from index.html
document.addEventListener('DOMContentLoaded', () => {
  // Wire up formerly-inline event handlers
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const closeSidebarBtn = document.querySelector('.close-sidebar-btn');
  const burgerBtn = document.querySelector('.burger-btn');
  const searchInput = document.getElementById('input-ville');
  const searchBtn = document.querySelector('.search-btn');
  const slider = document.getElementById('slider-pwm');
  const profileSelect = document.getElementById('profile-select');
  const profileSaveBtn = document.getElementById('profile-save-btn');
  const profileDeleteBtn = document.getElementById('profile-delete-btn');
  const clearBtn = document.getElementById('clear-log-btn');
  const exportBtn = document.getElementById('export-btn');
  const testReportBtn = document.getElementById('test-report-btn');
  const reportRangeSelect = document.getElementById('report-range-select');
  const reportRangeStart = document.getElementById('report-range-start');
  const reportRangeEnd = document.getElementById('report-range-end');
  const totemUploadInput = document.getElementById('totem-image-upload');
  const totemDropzone = document.getElementById('totem-dropzone');
  const totemResetBtn = document.getElementById('totem-reset-image-btn');
  const modeAuto = document.getElementById('btn-mode-auto');
  const modeManu = document.getElementById('btn-mode-manu');
  const calculatorToggle = document.getElementById('totem-calculator-toggle');

  if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
  if (burgerBtn) burgerBtn.addEventListener('click', () => toggleSidebar(true));

  if (searchInput) searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') chercherVilleManuelle(); });
  if (searchBtn) searchBtn.addEventListener('click', chercherVilleManuelle);

  if (slider) {
    slider.addEventListener('input', (e) => ajusterSliderManuel(e.target.value));
    slider.addEventListener('change', (e) => envoyerCommandePwm(e.target.value));
  }

  if (profileSelect) profileSelect.addEventListener('change', (e) => chargerProfil(e.target.value));
  if (profileSaveBtn) profileSaveBtn.addEventListener('click', sauvegarderProfil);
  if (profileDeleteBtn) profileDeleteBtn.addEventListener('click', supprimerProfil);

  if (clearBtn) clearBtn.addEventListener('click', viderLog);
  if (exportBtn) exportBtn.addEventListener('click', exporterExcel);
  if (testReportBtn) testReportBtn.addEventListener('click', () => { genererRapportTest(); });
  if (reportRangeSelect) {
    reportRangeSelect.addEventListener('change', () => {
      basculerVisibilitePlagePersonnalisee();
      planifierSauvegardeRuntimeState();
      genererRapportTest();
    });
  }
  if (reportRangeStart) reportRangeStart.addEventListener('change', () => { planifierSauvegardeRuntimeState(); genererRapportTest(); });
  if (reportRangeEnd) reportRangeEnd.addEventListener('change', () => { planifierSauvegardeRuntimeState(); genererRapportTest(); });

  if (totemUploadInput) totemUploadInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) ajouterImageTotemDepuisFichier(file);
    e.target.value = '';
  });
  if (totemDropzone) {
    ['dragenter', 'dragover'].forEach(evt => {
      totemDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        totemDropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      totemDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        totemDropzone.classList.remove('dragover');
      });
    });
    totemDropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) ajouterImageTotemDepuisFichier(file);
    });
  }
  if (totemResetBtn) totemResetBtn.addEventListener('click', resetImageTotemParDefaut);

  if (modeAuto) modeAuto.addEventListener('click', () => changerModeVentilo('AUTO'));
  if (modeManu) modeManu.addEventListener('click', () => changerModeVentilo('MANU'));
  if (calculatorToggle) calculatorToggle.addEventListener('click', toggleCalculateurThermique);

  // rename inputs
  for (let i = 0; i < 5; i++) {
    const inp = document.getElementById(`sonde-name-${i}`);
    if (inp) inp.addEventListener('input', (e) => changerNomSonde(i, e.target.value));

    const minInput = document.getElementById(`sonde-target-min-${i}`);
    const maxInput = document.getElementById(`sonde-target-max-${i}`);
    if (minInput) minInput.addEventListener('input', planifierSauvegardeRuntimeState);
    if (maxInput) maxInput.addEventListener('input', planifierSauvegardeRuntimeState);
  }

  // Système de ventilation
  const debitInput = document.getElementById('ventilo-debit-input');
  if (debitInput) {
    debitInput.addEventListener('input', () => {
      sauvegarderConfigVentilateurs();
      mettreAJourDebitTotal();
    });
  }

  // Toggle ventilation section
  const ventiloHeaderToggle = document.getElementById('ventilo-header-toggle');
  if (ventiloHeaderToggle) {
    ventiloHeaderToggle.addEventListener('click', () => toggleVentiloSection());
  }

  // Toggle onglet ventilation (accordéon principal)
  const ventiloTabToggle = document.getElementById('ventilo-tab-toggle');
  if (ventiloTabToggle) {
    ventiloTabToggle.addEventListener('click', () => toggleAccordion('ventilo'));
  }

  // Toggle onglets principaux (specs, definition, profils, image)
  ['specs', 'definition', 'profils', 'image'].forEach(tabName => {
    const toggle = document.getElementById(`${tabName}-tab-toggle`);
    if (toggle) {
      toggle.addEventListener('click', () => toggleAccordion(tabName));
    }
  });

  // Toggle groups ventilateurs entrée/sortie
  document.querySelectorAll('.ventilo-group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const group = e.currentTarget.dataset.ventiloGroup;
      if (group) toggleVentiloGroup(group);
    });
  });

  // Spécifications du totem
  const specFields = [
    'totem-spec-name',
    'totem-spec-height',
    'totem-spec-width',
    'totem-spec-depth',
    'totem-spec-watt',
    'totem-spec-environment',
    'totem-spec-color',
    'totem-spec-sun-exposure'
  ];
  specFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', sauvegarderSpecsTotem);
      field.addEventListener('change', sauvegarderSpecsTotem);
    }
  });
  const environmentSelect = document.getElementById('totem-spec-environment');
  if (environmentSelect) {
    environmentSelect.addEventListener('change', () => gererVisibiliteOptionsOutdoor(true));
  }
  gererVisibiliteOptionsOutdoor(false);

  // initialize dynamic parts that expect to run after DOM is ready
  initialiserImagesTotem();
  initTotemSensors();
  
  // Hover sur sensors pour afficher nom de la sonde
  document.querySelectorAll('.sensor').forEach((sensor, idx) => {
    sensor.addEventListener('mouseenter', () => {
      const label = sensor.querySelector('.sensor-label');
      if (label) {
        label.textContent = getSondeLabel(idx);
      }
    });
    sensor.addEventListener('mouseleave', () => {
      const label = sensor.querySelector('.sensor-label');
      const tempId = `totem-temp-${idx}`;
      const tempEl = document.getElementById(tempId);
      if (label && tempEl) {
        label.textContent = tempEl.textContent;
      }
    });
  });

  initialiserVentilateurs();
  initialiserProfils();
  chargerSpecsTotem();
  restaurerEtatVentiloTab();
  restaurerEtatAccordions();
  restaurerEtatVentiloGroups();
  restaurerEtatCalculateurThermique();
  geolocalisationAutomatique();
  setInterval(recupererMeteo, 900000);
  demarrerMQTT();
  basculerVisibilitePlagePersonnalisee();
  genererRapportTest();
});

// ---- rest of application logic (extracted) ----
// The rest of the functions were kept global-style for simplicity.

const logComplet = [];
const MAX_LIGNES_AFFICHEES = 50;
let clientMQTT = null;
let modeSelectionne = "AUTO";

let latActuelle = 48.8566;
let lonActuelle = 2.3522;
let villeActuelle = "Paris (Défaut)";
let contexteClimatiqueSurplus = {
  city: villeActuelle,
  latitude: latActuelle,
  longitude: lonActuelle,
  solarMJm2Day: null,
  windKmh: null,
  source: 'pending',
  updatedAt: null
};

function toggleSidebar(open) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const mainContent = document.getElementById('main-content');
  
  if (open) {
    sidebar.classList.add('open');
    overlay.classList.add('show');
    if(window.innerWidth > 992) mainContent.style.marginRight = "320px";
  } else {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    mainContent.style.marginRight = "0";
  }
}

function changerModeVentilo(mode) {
  modeSelectionne = mode;
  document.getElementById('btn-mode-auto').classList.toggle('active', mode === 'AUTO');
  document.getElementById('btn-mode-manu').classList.toggle('active', mode === 'MANU');
  
  const block = document.getElementById('slider-block');
  if (mode === 'MANU') {
    block.classList.add('show');
    envoyerCommandePwm(document.getElementById('slider-pwm').value);
  } else {
    block.classList.remove('show');
    if(clientMQTT && clientMQTT.connected) {
      clientMQTT.publish("temperatures/ventilateurs/cmd", JSON.stringify({ mode: "AUTO" }), { qos: 0, retain: false });
    }
  }
}

function ajusterSliderManuel(val) {
  document.getElementById('slider-txt-val').textContent = val + " %";
}

function envoyerCommandePwm(val) {
  if (modeSelectionne !== 'MANU') return;
  if (clientMQTT && clientMQTT.connected) {
    const payload = JSON.stringify({ mode: "MANU", pwm: parseInt(val) });
    clientMQTT.publish("temperatures/ventilateurs/cmd", payload, { qos: 0, retain: false });
  }
}

function ajouterAuLog(idx, temp, now) {
  const entry = { date: now.toLocaleDateString('fr-FR'), heure: now.toLocaleTimeString('fr-FR'), sondeIdx: idx, temp: temp, ts: now };
  logComplet.push(entry);
  document.getElementById('log-count').textContent = logComplet.length;
  document.getElementById('export-btn').disabled = false;

  const tbody = document.getElementById('log-tbody');
  const tr = document.createElement('tr');
  const label = getSondeLabel(idx);
  tr.innerHTML = `<td>${entry.date}</td><td>${entry.heure}</td><td style="color:${COULEURS[idx] || '#aaa'};font-weight:600">${label}</td><td class="temp-val">${temp.toFixed(2)} °C</td>`;
  tbody.insertBefore(tr, tbody.firstChild);
  while (tbody.rows.length > MAX_LIGNES_AFFICHEES) tbody.deleteRow(tbody.rows.length - 1);

  logTempToServer(entry);
}

function viderLog() {
  if (!confirm('Vider tout le log ? Les données non exportées seront perdues.')) return;
  logComplet.length = 0;
  document.getElementById('log-tbody').innerHTML = '';
  document.getElementById('log-count').textContent = '0';
  document.getElementById('export-btn').disabled = true;
}

function exporterExcel() {
  if (logComplet.length === 0) return;
  exporterExcelDepuisServeur();
}

function getSondeTargetsCourants() {
  const targets = [];
  for (let i = 0; i < NB_SONDES; i++) {
    const minRaw = document.getElementById(`sonde-target-min-${i}`)?.value;
    const maxRaw = document.getElementById(`sonde-target-max-${i}`)?.value;
    const min = minRaw === '' || minRaw === undefined ? null : Number(minRaw);
    const max = maxRaw === '' || maxRaw === undefined ? null : Number(maxRaw);
    targets.push({
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null
    });
  }
  return targets;
}

function appliquerSondeTargets(targets) {
  if (!Array.isArray(targets)) return;
  for (let i = 0; i < NB_SONDES; i++) {
    const row = targets[i] || {};
    const minInput = document.getElementById(`sonde-target-min-${i}`);
    const maxInput = document.getElementById(`sonde-target-max-${i}`);
    if (minInput) minInput.value = row.min === null || row.min === undefined ? '' : row.min;
    if (maxInput) maxInput.value = row.max === null || row.max === undefined ? '' : row.max;
  }
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '--';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${h}h ${m}m`;
}

function parseEntryTimestamp(entry) {
  if (entry.ts) {
    const dt = new Date(entry.ts);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  if (entry.date && entry.heure) {
    const [d, m, y] = String(entry.date).split('/').map(Number);
    if (d && m && y) {
      const dt = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${entry.heure}`);
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }
  return null;
}

async function chargerLogsDepuisServeur(limit = 5000) {
  const rows = await sendToServer(`/api/logs?limit=${limit}`);
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({
    sondeIdx: Number(r.sondeIdx ?? r.sondeidx),
    temp: Number(r.temp),
    date: r.date || '',
    heure: r.heure || '',
    ts: r.ts || r.createdAt || r.createdat || ''
  })).filter(r => Number.isFinite(r.sondeIdx) && Number.isFinite(r.temp));
}

function calculerTemperatureExterieureSurPeriode(start, end) {
  const inRange = donneesExterieures.filter(p => p && p.t instanceof Date && p.t >= start && p.t <= end);
  if (!inRange.length) return { start: null, end: null };
  return { start: inRange[0].v, end: inRange[inRange.length - 1].v };
}

function basculerVisibilitePlagePersonnalisee() {
  const select = document.getElementById('report-range-select');
  const startInput = document.getElementById('report-range-start');
  const endInput = document.getElementById('report-range-end');
  if (!select || !startInput || !endInput) return;
  const show = select.value === 'custom';
  startInput.classList.toggle('hidden', !show);
  endInput.classList.toggle('hidden', !show);
  if (show) {
    initialiserPlagePersonnaliseeParDefaut();
  }
}

function toDatetimeLocalValue(date) {
  const d = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return d.toISOString().slice(0, 16);
}

function initialiserPlagePersonnaliseeParDefaut() {
  const startInput = document.getElementById('report-range-start');
  const endInput = document.getElementById('report-range-end');
  if (!startInput || !endInput) return;

  if (!startInput.value) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    startInput.value = toDatetimeLocalValue(start);
  }
  if (!endInput.value) {
    endInput.value = toDatetimeLocalValue(new Date());
  }
}

function getPlageRapport(entries) {
  const select = document.getElementById('report-range-select');
  const startInput = document.getElementById('report-range-start');
  const endInput = document.getElementById('report-range-end');
  const now = new Date();
  const mode = select ? select.value : '24h';

  if (mode === 'custom') {
    const start = startInput && startInput.value ? new Date(startInput.value) : null;
    const end = endInput && endInput.value ? new Date(endInput.value) : null;
    if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      return { mode, start, end, label: 'Intervalle personnalisé' };
    }
    return null;
  }

  if (mode === 'current') {
    const timestamps = entries.map(parseEntryTimestamp).filter(Boolean).sort((a, b) => a - b);
    if (!timestamps.length) return null;
    const start = timestamps[0];
    const end = timestamps[timestamps.length - 1];
    return { mode, start, end, label: 'Test courant' };
  }

  const start = new Date(now.getTime() - (24 * 3600 * 1000));
  return { mode: '24h', start, end: now, label: 'Dernières 24h' };
}

async function genererRapportTest() {
  const tbody = document.getElementById('test-report-tbody');
  const statusPill = document.getElementById('test-status-pill');
  const startEl = document.getElementById('report-start');
  const endEl = document.getElementById('report-end');
  const durationEl = document.getElementById('report-duration');
  const extRangeEl = document.getElementById('report-ext-range');
  const intRangeEl = document.getElementById('report-int-range');
  const resultEl = document.getElementById('report-result');
  const titleEl = document.getElementById('test-report-title');
  if (!tbody || !statusPill) return null;

  const sourceLogs = await chargerLogsDepuisServeur(5000);
  const fallback = sourceLogs.length ? sourceLogs : logComplet;
  const range = getPlageRapport(fallback);
  if (!range) {
    tbody.innerHTML = '<tr><td colspan="8">Intervalle personnalisé invalide. Sélectionne début/fin.</td></tr>';
    statusPill.textContent = 'En attente';
    statusPill.classList.remove('pass');
    statusPill.classList.add('fail');
    if (titleEl) titleEl.textContent = 'Rapport de Test';
    return null;
  }
  if (titleEl) titleEl.textContent = `Rapport de Test (${range.label})`;

  const entriesInRange = fallback.filter(entry => {
    const ts = parseEntryTimestamp(entry);
    return ts && ts >= range.start && ts <= range.end;
  });

  if (!entriesInRange.length) {
    tbody.innerHTML = '<tr><td colspan="8">Aucune donnée sur la période sélectionnée.</td></tr>';
    statusPill.textContent = 'En attente';
    statusPill.classList.remove('pass');
    statusPill.classList.add('fail');
    if (startEl) startEl.textContent = '--';
    if (endEl) endEl.textContent = '--';
    if (durationEl) durationEl.textContent = '--';
    if (extRangeEl) extRangeEl.textContent = '--';
    if (intRangeEl) intRangeEl.textContent = '--';
    if (resultEl) resultEl.textContent = 'Échec';
    return null;
  }

  const targets = getSondeTargetsCourants();
  const rows = [];
  let allPass = true;

  for (let i = 0; i < NB_SONDES; i++) {
    const sensorEntries = entriesInRange
      .filter(entry => Number(entry.sondeIdx) === i)
      .sort((a, b) => parseEntryTimestamp(a) - parseEntryTimestamp(b));
    const target = targets[i] || { min: null, max: null };

    if (!sensorEntries.length) {
      allPass = false;
      rows.push({ label: getSondeLabel(i), tmin: target.min, tmax: target.max, min: null, max: null, start: null, end: null, pass: false });
      continue;
    }

    const values = sensorEntries.map(entry => Number(entry.temp)).filter(v => Number.isFinite(v));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const start = Number(sensorEntries[0].temp);
    const end = Number(sensorEntries[sensorEntries.length - 1].temp);
    const passMin = target.min === null || min >= target.min;
    const passMax = target.max === null || max <= target.max;
    const pass = passMin && passMax;
    if (!pass) allPass = false;

    rows.push({ label: getSondeLabel(i), tmin: target.min, tmax: target.max, min, max, start, end, pass });
  }

  const timestamps = entriesInRange.map(parseEntryTimestamp).filter(Boolean).sort((a, b) => a - b);
  const testStart = timestamps[0];
  const testEnd = timestamps[timestamps.length - 1];
  const durationMs = testEnd - testStart;

  const startValues = rows.filter(r => r.start !== null).map(r => r.start);
  const endValues = rows.filter(r => r.end !== null).map(r => r.end);
  const interiorStart = startValues.length ? startValues.reduce((a, b) => a + b, 0) / startValues.length : null;
  const interiorEnd = endValues.length ? endValues.reduce((a, b) => a + b, 0) / endValues.length : null;
  const ext = calculerTemperatureExterieureSurPeriode(testStart, testEnd);

  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${row.label}</td>
      <td>${row.tmin === null ? '--' : row.tmin.toFixed(1)} °C</td>
      <td>${row.tmax === null ? '--' : row.tmax.toFixed(1)} °C</td>
      <td>${row.min === null ? '--' : row.min.toFixed(2)} °C</td>
      <td>${row.max === null ? '--' : row.max.toFixed(2)} °C</td>
      <td>${row.start === null ? '--' : row.start.toFixed(2)} °C</td>
      <td>${row.end === null ? '--' : row.end.toFixed(2)} °C</td>
      <td class="${row.pass ? 'sensor-result-pass' : 'sensor-result-fail'}">${row.pass ? 'Réussite' : 'Échec'}</td>
    </tr>
  `).join('');

  statusPill.textContent = allPass ? 'Réussite' : 'Échec';
  statusPill.classList.toggle('pass', allPass);
  statusPill.classList.toggle('fail', !allPass);
  if (startEl) startEl.textContent = testStart.toLocaleString('fr-FR');
  if (endEl) endEl.textContent = testEnd.toLocaleString('fr-FR');
  if (durationEl) durationEl.textContent = formatDuration(durationMs);
  if (extRangeEl) extRangeEl.textContent = (ext.start === null || ext.end === null) ? '--' : `${ext.start.toFixed(1)} °C → ${ext.end.toFixed(1)} °C`;
  if (intRangeEl) intRangeEl.textContent = (interiorStart === null || interiorEnd === null) ? '--' : `${interiorStart.toFixed(1)} °C → ${interiorEnd.toFixed(1)} °C`;
  if (resultEl) resultEl.textContent = allPass ? 'Réussite' : 'Échec';

  return {
    generatedAt: new Date().toISOString(),
    status: allPass ? 'success' : 'failure',
    durationMs,
    testStart: testStart.toISOString(),
    testEnd: testEnd.toISOString(),
    exteriorStart: ext.start,
    exteriorEnd: ext.end,
    interiorStart,
    interiorEnd,
    sensors: rows
  };
}

async function exporterExcelDepuisServeur() {
  const report = await genererRapportTest();
  const rangeSelect = document.getElementById('report-range-select');
  const rangeStart = document.getElementById('report-range-start');
  const rangeEnd = document.getElementById('report-range-end');
  const payload = {
    chartImageBase64: captureGraphImage(),
    sensorLabels: Array.from({ length: NB_SONDES }, (_, index) => getSondeLabel(index)),
    colors: [...COULEURS],
    exportedAt: new Date().toISOString(),
    sensorTargets: getSondeTargetsCourants(),
    weatherContext: getContexteClimatiquePourSurplus(),
    report,
    reportRange: {
      mode: rangeSelect ? rangeSelect.value : '24h',
      start: rangeStart && rangeStart.value ? new Date(rangeStart.value).toISOString() : null,
      end: rangeEnd && rangeEnd.value ? new Date(rangeEnd.value).toISOString() : null
    }
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/export/excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      alert('Échec de génération de l’export Excel.');
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dispo = response.headers.get('Content-Disposition') || '';
    const match = dispo.match(/filename="([^"]+)"/);
    link.download = match ? match[1] : `temperatures_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.warn('Erreur export Excel serveur :', error);
    alert('Erreur lors de l’export Excel.');
  }
}

const MQTT_HOST = 'broker.hivemq.com';
const MQTT_PORT = 8884;  
const TOPIC_ROOT = 'temperatures';
const NB_SONDES = 5;     
const ENABLE_CLIENT_LOG_PUSH = false;
// When deployed on Render serve frontend and API from the same service.
// Use an empty string for same-origin API calls (e.g. fetch('/api/...')).
const API_BASE_URL = window.location.hostname === 'jsk75.github.io'
  ? 'https://iagona-dash-temp-1.onrender.com'
  : '';

const COULEURS = ['#4fc3f7', '#81c784', '#ffb74d', '#ba68c8', '#e57373'];
const NOMS = ["Sonde1", "Sonde2", "Sonde3", "Sonde4", "Sonde5"];
const SONDE_PREFIX = ["Sonde 1", "Sonde 2", "Sonde 3", "Sonde 4", "Sonde 5"];
const SONDE_CUSTOM_NAMES = Array(NB_SONDES).fill('');
const PROFIL_STORAGE_KEY = 'sonde_profiles';
const PROFIL_LAST_KEY = 'sonde_last_profile';
const TOTEM_IMAGE_LIBRARY_KEY = 'totem_image_library';
const TOTEM_SELECTED_IMAGE_KEY = 'totem_selected_image';
const TOTEM_DEFAULT_IMAGE = 'totem-clean.png';
const VENTILO_STORAGE_KEY = 'ventilo_config';
const RUNTIME_STATE_CONFIG_KEY = 'runtime_state';
const VENTILO_COLLAPSED_KEY = 'ventilo_collapsed';
const VENTILO_TAB_COLLAPSED_KEY = 'ventilo_tab_collapsed';
const VENTILO_ENTREE_COLLAPSED_KEY = 'ventilo_entree_collapsed';
const VENTILO_SORTIE_COLLAPSED_KEY = 'ventilo_sortie_collapsed';
const TOTEM_SPECS_KEY = 'totem_specs';
const SPECS_TAB_COLLAPSED_KEY = 'specs_tab_collapsed';
const DEFINITION_TAB_COLLAPSED_KEY = 'definition_tab_collapsed';
const PROFILS_TAB_COLLAPSED_KEY = 'profils_tab_collapsed';
const IMAGE_TAB_COLLAPSED_KEY = 'image_tab_collapsed';
const THERMAL_CALCULATOR_COLLAPSED_KEY = 'thermal_calculator_collapsed';
let profilsEnregistres = {};
let profilActuel = 'default';
let totemImageLibrary = [];
let totemSelectedImage = TOTEM_DEFAULT_IMAGE;
let _runtimeStateSaveDebounce = null;
let dernierEtatVentilos = null;

function getSondeLabel(idx) {
  return SONDE_CUSTOM_NAMES[idx] ? `${SONDE_PREFIX[idx]} - ${SONDE_CUSTOM_NAMES[idx]}` : SONDE_PREFIX[idx];
}

function getVentilationConfigCourante() {
  const config = {
    debit: parseFloat(document.getElementById('ventilo-debit-input')?.value) || 0,
    entree: [],
    sortie: []
  };

  for (let i = 0; i < 8; i++) {
    const checkbox = document.getElementById(`ventilo-entree-${i}`);
    const slider = document.getElementById(`ventilo-entree-${i}-speed`);
    config.entree.push({
      active: checkbox ? checkbox.checked : false,
      speed: slider ? parseInt(slider.value) || 50 : 50
    });
  }

  for (let i = 0; i < 8; i++) {
    const checkbox = document.getElementById(`ventilo-sortie-${i}`);
    const slider = document.getElementById(`ventilo-sortie-${i}-speed`);
    config.sortie.push({
      active: checkbox ? checkbox.checked : false,
      speed: slider ? parseInt(slider.value) || 50 : 50
    });
  }

  return config;
}

function getRuntimeStatePayload() {
  const reportRangeSelect = document.getElementById('report-range-select');
  const reportRangeStart = document.getElementById('report-range-start');
  const reportRangeEnd = document.getElementById('report-range-end');
  return {
    activeProfile: profilActuel,
    sensorNames: [...SONDE_CUSTOM_NAMES],
    sensorPositions: getCurrentPositions(),
    sensorTargets: getSondeTargetsCourants(),
    reportRange: {
      mode: reportRangeSelect ? reportRangeSelect.value : '24h',
      start: reportRangeStart ? reportRangeStart.value : '',
      end: reportRangeEnd ? reportRangeEnd.value : ''
    },
    ventilation: getVentilationConfigCourante()
  };
}

async function sauvegarderRuntimeStateSurServeur() {
  return await sendToServer(`/api/config/${encodeURIComponent(RUNTIME_STATE_CONFIG_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: getRuntimeStatePayload() })
  });
}

function planifierSauvegardeRuntimeState() {
  clearTimeout(_runtimeStateSaveDebounce);
  _runtimeStateSaveDebounce = setTimeout(() => {
    sauvegarderRuntimeStateSurServeur();
  }, 250);
}

async function chargerRuntimeStateDepuisServeur() {
  const response = await sendToServer(`/api/config/${encodeURIComponent(RUNTIME_STATE_CONFIG_KEY)}`);
  if (!response || !response.value) return false;
  const state = response.value;

  if (Array.isArray(state.sensorNames)) {
    state.sensorNames.forEach((value, idx) => {
      if (idx < NB_SONDES) {
        SONDE_CUSTOM_NAMES[idx] = value || '';
        const input = document.getElementById(`sonde-name-${idx}`);
        if (input) input.value = SONDE_CUSTOM_NAMES[idx];
      }
    });
  }

  if (Array.isArray(state.sensorPositions) && state.sensorPositions.length) {
    applyPositions(state.sensorPositions);
  }

  if (Array.isArray(state.sensorTargets)) {
    appliquerSondeTargets(state.sensorTargets);
  }

  if (state.reportRange) {
    const reportRangeSelect = document.getElementById('report-range-select');
    const reportRangeStart = document.getElementById('report-range-start');
    const reportRangeEnd = document.getElementById('report-range-end');
    if (reportRangeSelect && ['24h', 'current', 'custom'].includes(state.reportRange.mode)) {
      reportRangeSelect.value = state.reportRange.mode;
    }
    if (reportRangeStart && typeof state.reportRange.start === 'string') {
      reportRangeStart.value = state.reportRange.start;
    }
    if (reportRangeEnd && typeof state.reportRange.end === 'string') {
      reportRangeEnd.value = state.reportRange.end;
    }
  }

  if (state.ventilation) {
    appliquerConfigurationVentilateurs(state.ventilation);
  }

  if (state.activeProfile) {
    profilActuel = state.activeProfile;
    localStorage.setItem(PROFIL_LAST_KEY, state.activeProfile);
  }

  mettreAJourAffichageNomsSondes();
  basculerVisibilitePlagePersonnalisee();
  return true;
}

function captureGraphImage() {
  const canvas = document.getElementById('tempChart');
  return canvas ? canvas.toDataURL('image/png', 1.0) : null;
}

function getDefaultPositions() {
  return [
    { id: '1', left: '50%', top: '15%' },
    { id: '2', left: '50%', top: '32%' },
    { id: '3', left: '50%', top: '50%' },
    { id: '4', left: '50%', top: '68%' },
    { id: '5', left: '50%', top: '85%' }
  ];
}

function chargerBibliothequeImagesTotem() {
  try {
    const saved = localStorage.getItem(TOTEM_IMAGE_LIBRARY_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    totemImageLibrary = Array.isArray(parsed)
      ? parsed.filter(item => item && typeof item.id === 'string' && typeof item.src === 'string')
      : [];
  } catch {
    totemImageLibrary = [];
  }
}

function sauvegarderBibliothequeImagesTotem() {
  localStorage.setItem(TOTEM_IMAGE_LIBRARY_KEY, JSON.stringify(totemImageLibrary));
}

function getTotemImageItems() {
  return [{ id: 'default', src: TOTEM_DEFAULT_IMAGE, custom: false }, ...totemImageLibrary.map(item => ({ ...item, custom: true }))];
}

function appliquerImageTotem(src) {
  const img = document.getElementById('totem-image');
  if (img) img.src = src;
  totemSelectedImage = src;
  localStorage.setItem(TOTEM_SELECTED_IMAGE_KEY, src);
  renderVignettesTotem();
}

function supprimerImageTotem(id) {
  const item = totemImageLibrary.find(entry => entry.id === id);
  if (!item) return;
  totemImageLibrary = totemImageLibrary.filter(entry => entry.id !== id);
  sauvegarderBibliothequeImagesTotem();
  if (totemSelectedImage === item.src) {
    appliquerImageTotem(TOTEM_DEFAULT_IMAGE);
  } else {
    renderVignettesTotem();
  }
}

function renderVignettesTotem() {
  const grid = document.getElementById('totem-thumb-grid');
  if (!grid) return;
  grid.innerHTML = '';

  getTotemImageItems().forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `totem-thumb${item.custom ? ' custom' : ''}${totemSelectedImage === item.src ? ' active' : ''}`;
    button.title = item.custom ? 'Image importée' : 'Image par défaut';

    const image = document.createElement('img');
    image.src = item.src;
    image.alt = item.custom ? 'Totem personnalisé' : 'Totem par défaut';
    button.appendChild(image);

    button.addEventListener('click', () => appliquerImageTotem(item.src));

    if (item.custom) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'totem-thumb-remove';
      removeBtn.textContent = '×';
      removeBtn.title = 'Supprimer cette image';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        supprimerImageTotem(item.id);
      });
      button.appendChild(removeBtn);
    }

    grid.appendChild(button);
  });
}

function resetImageTotemParDefaut() {
  appliquerImageTotem(TOTEM_DEFAULT_IMAGE);
}

function ajouterImageTotemDepuisFichier(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    alert('Veuillez sélectionner un fichier image valide.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const src = typeof reader.result === 'string' ? reader.result : '';
    if (!src) return;
    const newEntry = { id: `custom_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`, src };
    totemImageLibrary.unshift(newEntry);
    if (totemImageLibrary.length > 18) totemImageLibrary = totemImageLibrary.slice(0, 18);
    sauvegarderBibliothequeImagesTotem();
    appliquerImageTotem(src);
  };
  reader.readAsDataURL(file);
}

function initialiserImagesTotem() {
  chargerBibliothequeImagesTotem();
  const savedImage = localStorage.getItem(TOTEM_SELECTED_IMAGE_KEY);
  const allowedSources = new Set([TOTEM_DEFAULT_IMAGE, ...totemImageLibrary.map(item => item.src)]);
  const source = savedImage && allowedSources.has(savedImage) ? savedImage : TOTEM_DEFAULT_IMAGE;
  const img = document.getElementById('totem-image');
  if (img) img.src = source;
  totemSelectedImage = source;
  renderVignettesTotem();
}

async function sendToServer(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    if (!response.ok) {
      console.warn('Serveur API retourné', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn('Erreur de communication avec l’API :', error);
    return null;
  }
}

async function logTempToServer(entry) {
  if (!ENABLE_CLIENT_LOG_PUSH) return;
  await sendToServer('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sondeIdx: entry.sondeIdx,
      label: getSondeLabel(entry.sondeIdx),
      temp: entry.temp,
      date: entry.date,
      heure: entry.heure,
      ts: entry.ts instanceof Date ? entry.ts.toISOString() : entry.ts
    })
  });
}

async function logFanEventToServer(event) {
  await sendToServer('/api/fan-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
}

function getFanLabel(group, index) {
  return group === 'entree' ? `Ventilateur ${index + 1}` : `Ventilateur ${index + 9}`;
}

function enregistrerEvenementsVentilateurs(previousConfig, nextConfig) {
  if (!previousConfig || !nextConfig) return;
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR');
  const heure = now.toLocaleTimeString('fr-FR');
  const ts = now.toISOString();

  ['entree', 'sortie'].forEach(group => {
    const previousFans = Array.isArray(previousConfig[group]) ? previousConfig[group] : [];
    const nextFans = Array.isArray(nextConfig[group]) ? nextConfig[group] : [];
    const maxLength = Math.max(previousFans.length, nextFans.length);

    for (let i = 0; i < maxLength; i++) {
      const previousFan = previousFans[i] || { active: false, speed: 50 };
      const nextFan = nextFans[i] || { active: false, speed: 50 };
      const fanLabel = getFanLabel(group, i);

      if (!!previousFan.active !== !!nextFan.active) {
        logFanEventToServer({
          fanGroup: group,
          fanIndex: i,
          fanLabel,
          eventType: nextFan.active ? 'activation' : 'désactivation',
          previousValue: previousFan.active ? 'actif' : 'inactif',
          nextValue: nextFan.active ? 'actif' : 'inactif',
          date,
          heure,
          ts
        });
      }

      if (Number(previousFan.speed) !== Number(nextFan.speed)) {
        logFanEventToServer({
          fanGroup: group,
          fanIndex: i,
          fanLabel,
          eventType: 'variation_vitesse',
          previousValue: `${Number(previousFan.speed) || 0}%`,
          nextValue: `${Number(nextFan.speed) || 0}%`,
          date,
          heure,
          ts
        });
      }
    }
  });
}

function clonerConfigVentilation(config) {
  return JSON.parse(JSON.stringify(config || { debit: 0, entree: [], sortie: [] }));
}

async function chargerProfilesDepuisServeur() {
  const profiles = await sendToServer('/api/profiles');
  if (!Array.isArray(profiles)) return;
  profiles.forEach(profile => {
    if (profile && profile.name) profilsEnregistres[profile.name] = profile;
  });
  enregistrerProfilesLocalement();
  renderProfiles();
}

async function sauvegarderProfilSurServeur(name) {
  const response = await sendToServer('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      names: [...SONDE_CUSTOM_NAMES],
      positions: getCurrentPositions(),
      targets: getSondeTargetsCourants()
    })
  });
  return !!(response && response.name);
}

async function supprimerProfilSurServeur(name) {
  const response = await sendToServer(`/api/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' });
  return !!(response && response.success);
}

async function chargerProfilDepuisServeur(name, enregistrerLast = true) {
  const profile = await sendToServer(`/api/profiles/${encodeURIComponent(name)}`);
  if (!profile || !profile.name) return false;
  profilsEnregistres[profile.name] = profile;
  enregistrerProfilesLocalement();
  renderProfiles();
  chargerProfil(profile.name, enregistrerLast);
  return true;
}

function changerNomSonde(idx, valeur) {
  SONDE_CUSTOM_NAMES[idx] = valeur.trim();
  const input = document.getElementById(`sonde-name-${idx}`);
  if (input) input.value = SONDE_CUSTOM_NAMES[idx];
  sauvegarderNomsSondes();
  mettreAJourAffichageNomsSondes();
  planifierSauvegardeRuntimeState();
}

function sauvegarderNomsSondes() {
  localStorage.setItem('sonde_custom_names', JSON.stringify(SONDE_CUSTOM_NAMES));
}

function chargerNomsSondes() {
  const saved = localStorage.getItem('sonde_custom_names');
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return;
    parsed.forEach((value, idx) => {
      if (idx < NB_SONDES) {
        SONDE_CUSTOM_NAMES[idx] = value || '';
        const input = document.getElementById(`sonde-name-${idx}`);
        if (input) input.value = SONDE_CUSTOM_NAMES[idx];
      }
    });
    mettreAJourAffichageNomsSondes();
  } catch (e) {}
}

function getCurrentPositions() {
  return Array.from(totemSensors).map(sensor => ({ id: sensor.dataset.id, left: sensor.style.left, top: sensor.style.top }));
}

function applyPositions(positions) {
  positions.forEach(pos => {
    const sensor = document.querySelector(`[data-id="${pos.id}"]`);
    if (sensor) { sensor.style.left = pos.left; sensor.style.top = pos.top; }
  });
}

function updateProfileButtons() {
  const deleteBtn = document.getElementById('profile-delete-btn');
  if (deleteBtn) deleteBtn.disabled = profilActuel === 'default';
}

function enregistrerProfilesLocalement() {
  localStorage.setItem(PROFIL_STORAGE_KEY, JSON.stringify(profilsEnregistres));
}

function chargerProfilesDepuisLocal() {
  try {
    const saved = localStorage.getItem(PROFIL_STORAGE_KEY);
    profilsEnregistres = saved ? JSON.parse(saved) : {};
  } catch (e) { profilsEnregistres = {}; }
}

function renderProfiles() {
  const select = document.getElementById('profile-select');
  if (!select) return;
  select.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = 'default';
  defaultOption.textContent = 'Par défaut';
  select.appendChild(defaultOption);

  Object.keys(profilsEnregistres).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  const last = localStorage.getItem(PROFIL_LAST_KEY);
  if (last && (last === 'default' || profilsEnregistres[last])) profilActuel = last; else profilActuel = 'default';
  select.value = profilActuel;
  updateProfileButtons();
}

function chargerProfil(nom, enregistrerLast = true) {
  if (nom !== 'default' && !profilsEnregistres[nom]) nom = 'default';
  profilActuel = nom;
  updateProfileButtons();
  if (nom === 'default') {
    SONDE_CUSTOM_NAMES.fill('');
    document.querySelectorAll('.rename-row input').forEach((input, idx) => input.value = '');
    applyPositions(getDefaultPositions());
    mettreAJourAffichageNomsSondes();
    if (enregistrerLast) localStorage.setItem(PROFIL_LAST_KEY, 'default');
    planifierSauvegardeRuntimeState();
    return;
  }
  const profil = profilsEnregistres[nom];
  if (!profil) return;
  if (Array.isArray(profil.names)) profil.names.forEach((value, idx) => { if (idx < NB_SONDES) { SONDE_CUSTOM_NAMES[idx] = value || ''; const input = document.getElementById(`sonde-name-${idx}`); if (input) input.value = SONDE_CUSTOM_NAMES[idx]; } });
  if (Array.isArray(profil.positions)) applyPositions(profil.positions);
  if (Array.isArray(profil.targets)) appliquerSondeTargets(profil.targets);
  mettreAJourAffichageNomsSondes();
  if (enregistrerLast) localStorage.setItem(PROFIL_LAST_KEY, nom);
  planifierSauvegardeRuntimeState();
}

async function sauvegarderProfil() {
  const libelle = document.getElementById('profile-name').value.trim();
  if (!libelle) { alert('Veuillez saisir un nom de profil.'); return; }
  profilsEnregistres[libelle] = {
    name: libelle,
    names: [...SONDE_CUSTOM_NAMES],
    positions: getCurrentPositions(),
    targets: getSondeTargetsCourants(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  enregistrerProfilesLocalement();
  renderProfiles();
  const select = document.getElementById('profile-select'); if (select) select.value = libelle;
  const synced = await sauvegarderProfilSurServeur(libelle);
  if (!synced) {
    alert('Profil enregistré localement uniquement. Synchronisation serveur impossible pour le moment.');
  }
  chargerProfil(libelle);
}

async function supprimerProfil() {
  if (profilActuel === 'default') return; if (!confirm(`Supprimer le profil « ${profilActuel} » ?`)) return;
  delete profilsEnregistres[profilActuel]; enregistrerProfilesLocalement();
  const deleted = await supprimerProfilSurServeur(profilActuel);
  if (!deleted) {
    alert('Suppression locale effectuée, mais la suppression serveur a échoué.');
  }
  renderProfiles(); const select = document.getElementById('profile-select'); if (select) select.value = 'default'; chargerProfil('default');
}

async function initialiserProfils() {
  chargerProfilesDepuisLocal(); renderProfiles(); await chargerProfilesDepuisServeur(); const last = localStorage.getItem(PROFIL_LAST_KEY);
  const hasLastProfile = !!(last && last !== 'default' && profilsEnregistres[last]);
  if (hasLastProfile) {
    await chargerProfil(last, false);
  }
  const runtimeLoaded = await chargerRuntimeStateDepuisServeur();
  if (!runtimeLoaded && !hasLastProfile) chargerNomsSondes();
}

function mettreAJourAffichageNomsSondes() {
  cardEls.forEach((card, idx) => {
    const labelEl = card.querySelector('.card-label'); if (labelEl) labelEl.textContent = getSondeLabel(idx);
  });
  const legendItems = legendEl.querySelectorAll('.legend-item');
  legendItems.forEach((item, idx) => { if (item) item.lastChild.textContent = getSondeLabel(idx); });
  const statLabels = document.querySelectorAll('.stat-box .stat-label');
  statLabels.forEach((labelEl, idx) => { const group = Math.floor(idx / 3); const suffix = idx % 3 === 0 ? 'Min' : idx % 3 === 1 ? 'Max' : 'Moy'; if (labelEl) labelEl.textContent = `${getSondeLabel(group)} — ${suffix}`; });
}

let fenetreSec = 30;
const donnees = Array.from({length: NB_SONDES}, () => []);
const donneesExterieures = [];

const cardsEl = document.getElementById('cards');
const cardEls = [];
const totemSensors = document.querySelectorAll(".sensor");

function initTotemSensors() {
  loadTotemPositions();

  totemSensors.forEach(sensor => {
    sensor.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;

      function move(ev) {
        const rect = document.getElementById("totem-container").getBoundingClientRect();

        let x = ((ev.clientX - rect.left) / rect.width) * 100;
        let y = ((ev.clientY - rect.top) / rect.height) * 100;

        if (x < 0) x = 0; if (x > 100) x = 100;
        if (y < 0) y = 0; if (y > 100) y = 100;

        sensor.style.left = x + "%";
        sensor.style.top = y + "%";
      }

      document.addEventListener("mousemove", move);

      document.onmouseup = function () {
        document.removeEventListener("mousemove", move);
        saveTotemPositions();
        document.onmouseup = null;
      };
    });
    
    sensor.addEventListener("touchstart", function (e) {
      function moveTouch(ev) {
        const rect = document.getElementById("totem-container").getBoundingClientRect();
        const touch = ev.touches[0];

        let x = ((touch.clientX - rect.left) / rect.width) * 100;
        let y = ((touch.clientY - rect.top) / rect.height) * 100;

        if (x < 0) x = 0; if (x > 100) x = 100;
        if (y < 0) y = 0; if (y > 100) y = 100;

        sensor.style.left = x + "%";
        sensor.style.top = y + "%";
      }

      document.addEventListener("touchmove", moveTouch);

      document.ontouchend = function () {
        document.removeEventListener("touchmove", moveTouch);
        saveTotemPositions();
        document.ontouchend = null;
      };
    });
  });
}

function saveTotemPositions() {
  let positions = [];
  totemSensors.forEach(sensor => {
    positions.push({ id: sensor.dataset.id, left: sensor.style.left, top: sensor.style.top });
  });
  localStorage.setItem("totem_positions", JSON.stringify(positions));
  planifierSauvegardeRuntimeState();
}

function loadTotemPositions() {
  let saved = localStorage.getItem("totem_positions");
  if (saved) {
    saved = JSON.parse(saved);
    saved.forEach(pos => { let sensor = document.querySelector(`[data-id="${pos.id}"]`); if (sensor) { sensor.style.left = pos.left; sensor.style.top = pos.top; } });
  } else {
    applyPositions(getDefaultPositions());
  }
}

function updateTotemTemp(idx, temp) {
  const el = document.getElementById(`totem-temp-${idx}`);
  if (el) el.textContent = temp.toFixed(2) + " °C";
}

for (let i = 0; i < NB_SONDES; i++) {
  const div = document.createElement('div');
  div.className = 'card';
  div.style.setProperty('--color', COULEURS[i]);
  div.innerHTML = `<div class="card-label">${getSondeLabel(i)}</div><div class="card-temp" id="temp-${i}">--<span class="card-unit">°C</span></div><div class="card-status" id="age-${i}">En attente...</div>`;
  cardsEl.appendChild(div);
  cardEls.push(div);
}

const divMeteo = document.createElement('div');
divMeteo.className = 'card card-meteo';
divMeteo.style.setProperty('--color', '#ffeb3b'); 
divMeteo.innerHTML = `<div class="card-label" id="meteo-ville">Extérieur (Météo)</div><div class="card-temp" id="meteo-temp">--<span class="card-unit">°C</span></div><div class="card-status" id="meteo-status">Recherche localisation...</div>`;
cardsEl.appendChild(divMeteo);

const legendEl = document.getElementById('legend');
for (let i = 0; i < NB_SONDES; i++) {
  legendEl.innerHTML += `<div class="legend-item"><div class="legend-dot" style="background:${COULEURS[i]}"></div>${getSondeLabel(i)}</div>`;
}

const statsEl = document.getElementById('stats');
for (let i = 0; i < NB_SONDES; i++) {
  statsEl.innerHTML += `
    <div class="stat-box"><div class="stat-label" style="color:${COULEURS[i]}">${getSondeLabel(i)} — Min</div><div class="stat-value" id="min-${i}" style="color:${COULEURS[i]}">--</div></div>
    <div class="stat-box"><div class="stat-label" style="color:${COULEURS[i]}">${getSondeLabel(i)} — Max</div><div class="stat-value" id="max-${i}" style="color:${COULEURS[i]}">--</div></div>
    <div class="stat-box"><div class="stat-label" style="color:${COULEURS[i]}">${getSondeLabel(i)} — Moy</div><div class="stat-value" id="moy-${i}" style="color:${COULEURS[i]}">--</div></div>`;
}

const ctx = document.getElementById('tempChart').getContext('2d');
const datasets = COULEURS.slice(0, NB_SONDES).map((c, i) => ({
  label: NOMS[i], data: [], borderColor: c, backgroundColor: c + '18', borderWidth: 2, pointRadius: 2, pointHoverRadius: 5, tension: 0.3, fill: false,
}));

const chart = new Chart(ctx, {
  type: 'line',
  data: { datasets },
  options: {
    animation: false, responsive: true,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { type: 'time', time: { tooltipFormat: 'HH:mm:ss', displayFormats: { second: 'HH:mm:ss', minute: 'HH:mm', hour: 'HH:mm', day: 'DD/MM HH:mm' } }, ticks: { color: '#666', maxTicksLimit: 8 }, grid: { color: '#1e2130' } },
      y: { ticks: { color: '#666', callback: v => v.toFixed(1) + ' °C' }, grid: { color: '#1e2130' } }
    },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1d27', borderColor: '#2a2d3a', borderWidth: 1, titleColor: '#aaa', bodyColor: '#fff', callbacks: { label: ctx => ` ${ctx.dataset.label} : ${ctx.parsed.y.toFixed(2)} °C` } } }
  }
});

function rafraichirGraphique() {
  const maintenant = new Date();
  const limiteDebut = new Date(maintenant - fenetreSec * 1000);

  for (let i = 0; i < NB_SONDES; i++) {
    const ptsAffiches = donnees[i].filter(p => p.t >= limiteDebut);
    chart.data.datasets[i].data = ptsAffiches.map(p => ({ x: p.t, y: p.v }));
    donnees[i] = donnees[i].filter(p => p.t >= new Date(maintenant - 86400 * 1000));

    if (ptsAffiches.length > 0) {
      const vals = ptsAffiches.map(p => p.v);
      document.getElementById(`min-${i}`).textContent = Math.min(...vals).toFixed(1) + ' °C';
      document.getElementById(`max-${i}`).textContent = Math.max(...vals).toFixed(1) + ' °C';
      document.getElementById(`moy-${i}`).textContent = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) + ' °C';
    }
  }
  chart.update('none');
}
setInterval(rafraichirGraphique, 1000);

document.getElementById('time-btns').addEventListener('click', e => {
  if (!e.target.dataset.s) return;
  fenetreSec = parseInt(e.target.dataset.s);
  document.querySelectorAll('#time-btns button').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
});

function demarrerMQTT() {
  const clientId = 'dashboard_' + Math.random().toString(16).slice(2, 8);
  clientMQTT = mqtt.connect(`wss://${MQTT_HOST}:${MQTT_PORT}/mqtt`, { clientId, clean: true, reconnectPeriod: 3000, connectTimeout: 10000 });

  clientMQTT.on('connect', () => {
    document.getElementById('dot').classList.add('connected');
    document.getElementById('status-text').textContent = 'Connecté à ' + MQTT_HOST;
    for (let i = 0; i < NB_SONDES; i++) clientMQTT.subscribe(`${TOPIC_ROOT}/${NOMS[i]}`);
    clientMQTT.subscribe("temperatures/ventilateurs");
  });

  clientMQTT.on('disconnect', () => {
    document.getElementById('dot').classList.remove('connected');
    document.getElementById('status-text').textContent = 'Déconnecté — reconnexion...';
  });

  clientMQTT.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (topic === "temperatures/ventilateurs") {
        document.getElementById("status-venti-mode").textContent = data.mode || "AUTO";
        document.getElementById("status-venti-mode").style.color = data.mode === "MANU" ? "#ffb74d" : "#4f4";
        document.getElementById("status-venti-pwm").textContent = data.pwm_pct + " %";
        document.getElementById("status-venti-tmax").textContent = data.temp_max.toFixed(1) + " °C";
        return;
      }

      const idx = NOMS.indexOf(data.nom);
      const temp = parseFloat(data.temp);
      const now = new Date();
      if (idx === -1 || isNaN(temp)) return;

      donnees[idx].push({ t: now, v: temp });
      ajouterAuLog(idx, temp, now);
      document.getElementById(`temp-${idx}`).innerHTML = temp.toFixed(2) + '<span class="card-unit">°C</span>';
      
      updateTotemTemp(idx, temp);
      
      document.getElementById(`age-${idx}`).textContent = 'Mis à jour ' + now.toLocaleTimeString('fr-FR');
      cardEls[idx].classList.add('active');
    } catch(e) { }
  });
}

async function recupererMeteo() {
  try {
    document.getElementById('meteo-ville').textContent = `Extérieur (${villeActuelle})`;
    document.getElementById('meteo-status').textContent = "Récupération météo...";
    const resMeteo = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latActuelle}&longitude=${lonActuelle}&current_weather=true`);
    if (!resMeteo.ok) throw new Error("Erreur API météo");
    const DonneesMeteo = await resMeteo.json();
    const tempExt = Number(DonneesMeteo.current_weather.temperature);
    document.getElementById('meteo-temp').innerHTML = `${tempExt.toFixed(1)}<span class="card-unit">°C</span>`;
    donneesExterieures.push({ t: new Date(), v: tempExt });
    while (donneesExterieures.length > 5000) donneesExterieures.shift();
    document.getElementById('meteo-status').textContent = `Mis à jour à ${new Date().toLocaleTimeString('fr-FR')}`;
    divMeteo.classList.add('active');
    await rafraichirContexteClimatiqueLocalisation(false);
  } catch (error) {
    document.getElementById('meteo-status').textContent = "Erreur météo";
  }
}

async function geolocalisationAutomatique() {
  try {
    document.getElementById('meteo-status').textContent = "Localisation par IP...";
    const resIp = await fetch('https://ipapi.co/json/');
    if (resIp.ok) {
      const DonneesIp = await resIp.json();
      if (DonneesIp && !DonneesIp.error) {
        latActuelle = DonneesIp.latitude; lonActuelle = DonneesIp.longitude; villeActuelle = DonneesIp.city;
      }
    }
  } catch (error) {}
  recupererMeteo();
}

async function chercherVilleManuelle() {
  const saisie = document.getElementById('input-ville').value.trim();
  if (saisie === "") return;
  document.getElementById('meteo-status').textContent = `Recherche de ${saisie}...`;
  try {
    const resGeocode = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(saisie)}&count=1&language=fr-FR`);
    const DonneesGeo = await resGeocode.json();
    if (DonneesGeo.results && DonneesGeo.results.length > 0) {
      const cible = DonneesGeo.results[0];
      latActuelle = cible.latitude; lonActuelle = cible.longitude; villeActuelle = cible.name;
      document.getElementById('input-ville').value = "";
      recupererMeteo();
    } else {
      document.getElementById('meteo-status').textContent = "Ville introuvable";
    }
  } catch (error) {
    document.getElementById('meteo-status').textContent = "Erreur de recherche";
  }
}

// Système de ventilation
function initialiserVentilateurs() {
  const entreeContainer = document.getElementById('ventilo-entree-container');
  const sortieContainer = document.getElementById('ventilo-sortie-container');

  if (entreeContainer) {
    for (let i = 0; i < 8; i++) {
      const item = document.createElement('div');
      item.className = 'ventilo-item';
      item.id = `ventilo-entree-${i}-item`;
      item.innerHTML = `
        <div class="ventilo-item-header">
          <input type="checkbox" id="ventilo-entree-${i}">
          <label for="ventilo-entree-${i}" class="ventilo-item-label">Ventilateur ${i + 1}</label>
        </div>
        <input type="range" id="ventilo-entree-${i}-speed" min="0" max="100" value="50" disabled>
        <div class="ventilo-item-speed"><span id="ventilo-entree-${i}-display">50</span>%</div>
      `;
      entreeContainer.appendChild(item);
      
      const checkbox = document.getElementById(`ventilo-entree-${i}`);
      const slider = document.getElementById(`ventilo-entree-${i}-speed`);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          if (slider) slider.disabled = !checkbox.checked;
          sauvegarderConfigVentilateurs();
          mettreAJourDebitTotal();
        });
      }
      if (slider) {
        slider.addEventListener('input', () => {
          const display = document.getElementById(`ventilo-entree-${i}-display`);
          if (display) display.textContent = slider.value;
        });
        slider.addEventListener('change', () => {
          sauvegarderConfigVentilateurs();
          mettreAJourDebitTotal();
        });
      }
    }
  }

  if (sortieContainer) {
    for (let i = 0; i < 8; i++) {
      const item = document.createElement('div');
      item.className = 'ventilo-item';
      item.id = `ventilo-sortie-${i}-item`;
      item.innerHTML = `
        <div class="ventilo-item-header">
          <input type="checkbox" id="ventilo-sortie-${i}">
          <label for="ventilo-sortie-${i}" class="ventilo-item-label">Ventilateur ${i + 9}</label>
        </div>
        <input type="range" id="ventilo-sortie-${i}-speed" min="0" max="100" value="50" disabled>
        <div class="ventilo-item-speed"><span id="ventilo-sortie-${i}-display">50</span>%</div>
      `;
      sortieContainer.appendChild(item);
      
      const checkbox = document.getElementById(`ventilo-sortie-${i}`);
      const slider = document.getElementById(`ventilo-sortie-${i}-speed`);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          if (slider) slider.disabled = !checkbox.checked;
          sauvegarderConfigVentilateurs();
          mettreAJourDebitTotal();
        });
      }
      if (slider) {
        slider.addEventListener('input', () => {
          const display = document.getElementById(`ventilo-sortie-${i}-display`);
          if (display) display.textContent = slider.value;
        });
        slider.addEventListener('change', () => {
          sauvegarderConfigVentilateurs();
          mettreAJourDebitTotal();
        });
      }
    }
  }

  chargerConfigVentilateurs();
  mettreAJourDebitTotal();
  restaurerEtatVentiloSection();
}

function chargerConfigVentilateurs() {
  try {
    const saved = localStorage.getItem(VENTILO_STORAGE_KEY);
    if (!saved) return;
    const config = JSON.parse(saved);
    
    if (config.debit) {
      const input = document.getElementById('ventilo-debit-input');
      if (input) input.value = config.debit;
    }

    if (config.entree) {
      config.entree.forEach((ventilo, i) => {
        const checkbox = document.getElementById(`ventilo-entree-${i}`);
        const slider = document.getElementById(`ventilo-entree-${i}-speed`);
        if (checkbox) {
          checkbox.checked = ventilo.active || false;
        }
        if (slider) {
          slider.value = ventilo.speed || 50;
          slider.disabled = !checkbox.checked;
          const display = document.getElementById(`ventilo-entree-${i}-display`);
          if (display) display.textContent = slider.value;
        }
      });
    }

    if (config.sortie) {
      config.sortie.forEach((ventilo, i) => {
        const checkbox = document.getElementById(`ventilo-sortie-${i}`);
        const slider = document.getElementById(`ventilo-sortie-${i}-speed`);
        if (checkbox) {
          checkbox.checked = ventilo.active || false;
        }
        if (slider) {
          slider.value = ventilo.speed || 50;
          slider.disabled = !checkbox.checked;
          const display = document.getElementById(`ventilo-sortie-${i}-display`);
          if (display) display.textContent = slider.value;
        }
      });
    }
  } catch (e) {
    console.warn('Erreur lors du chargement de la config ventilation', e);
  }
}

function appliquerConfigurationVentilateurs(config) {
    dernierEtatVentilos = clonerConfigVentilation(getVentilationConfigCourante());
  if (!config) return;

  if (config.debit !== undefined) {
    const input = document.getElementById('ventilo-debit-input');
    if (input) input.value = config.debit;
  }

  if (Array.isArray(config.entree)) {
    config.entree.forEach((ventilo, i) => {
      const checkbox = document.getElementById(`ventilo-entree-${i}`);
      const slider = document.getElementById(`ventilo-entree-${i}-speed`);
      if (checkbox) checkbox.checked = !!ventilo.active;
      if (slider) {
        slider.value = ventilo.speed || 50;
        slider.disabled = !(checkbox && checkbox.checked);
        const display = document.getElementById(`ventilo-entree-${i}-display`);
        if (display) display.textContent = slider.value;
      }
    });
  }

  if (Array.isArray(config.sortie)) {
    config.sortie.forEach((ventilo, i) => {
      const checkbox = document.getElementById(`ventilo-sortie-${i}`);
      const slider = document.getElementById(`ventilo-sortie-${i}-speed`);
      if (checkbox) checkbox.checked = !!ventilo.active;
      if (slider) {
        slider.value = ventilo.speed || 50;
        slider.disabled = !(checkbox && checkbox.checked);
        const display = document.getElementById(`ventilo-sortie-${i}-display`);
        if (display) display.textContent = slider.value;
      }
    });
  }

  mettreAJourDebitTotal();
}

function sauvegarderConfigVentilateurs() {
  const previousConfig = dernierEtatVentilos ? clonerConfigVentilation(dernierEtatVentilos) : null;
  const config = getVentilationConfigCourante();
  localStorage.setItem(VENTILO_STORAGE_KEY, JSON.stringify(config));
  enregistrerEvenementsVentilateurs(previousConfig, config);
  dernierEtatVentilos = clonerConfigVentilation(config);
  planifierSauvegardeRuntimeState();
}

function mettreAJourDebitTotal() {
  const debit = parseFloat(document.getElementById('ventilo-debit-input').value) || 0;
  let totalDebit = 0;

  for (let i = 0; i < 8; i++) {
    const checkbox = document.getElementById(`ventilo-entree-${i}`);
    const slider = document.getElementById(`ventilo-entree-${i}-speed`);
    if (checkbox && checkbox.checked && slider) {
      const speed = parseInt(slider.value) || 50;
      totalDebit += (debit * speed) / 100;
    }
  }

  for (let i = 0; i < 8; i++) {
    const checkbox = document.getElementById(`ventilo-sortie-${i}`);
    const slider = document.getElementById(`ventilo-sortie-${i}-speed`);
    if (checkbox && checkbox.checked && slider) {
      const speed = parseInt(slider.value) || 50;
      totalDebit += (debit * speed) / 100;
    }
  }

  const displayEl = document.getElementById('ventilo-debit-total');
  if (displayEl) {
    displayEl.textContent = totalDebit.toFixed(2);
  }
}

function toggleVentiloSection() {
  const content = document.getElementById('ventilo-content');
  const icon = document.getElementById('ventilo-toggle-icon');
  
  if (content && icon) {
    content.classList.toggle('collapsed');
    icon.classList.toggle('collapsed');
    
    const isCollapsed = content.classList.contains('collapsed');
    localStorage.setItem(VENTILO_COLLAPSED_KEY, isCollapsed ? 'true' : 'false');
  }
}

function restaurerEtatVentiloSection() {
  try {
    const isCollapsed = localStorage.getItem(VENTILO_COLLAPSED_KEY) === 'true';
    const content = document.getElementById('ventilo-content');
    const icon = document.getElementById('ventilo-toggle-icon');
    
    if (content && icon && isCollapsed) {
      content.classList.add('collapsed');
      icon.classList.add('collapsed');
    }
  } catch (e) {
    console.warn('Erreur lors de la restauration de l\'état ventilation', e);
  }
}

// Generic accordion toggle for all sidebar sections
function toggleAccordion(tabName) {
  const body = document.getElementById(`${tabName}-tab-body`);
  const icon = document.getElementById(`${tabName}-tab-icon`);
  if (body && icon) {
    body.classList.toggle('collapsed');
    icon.classList.toggle('collapsed');
    const isCollapsed = body.classList.contains('collapsed');
    
    // Map tab names to localStorage keys
    const keyMap = {
      'specs': SPECS_TAB_COLLAPSED_KEY,
      'ventilo': VENTILO_TAB_COLLAPSED_KEY,
      'definition': DEFINITION_TAB_COLLAPSED_KEY,
      'profils': PROFILS_TAB_COLLAPSED_KEY,
      'image': IMAGE_TAB_COLLAPSED_KEY
    };
    
    const key = keyMap[tabName];
    if (key) {
      localStorage.setItem(key, isCollapsed ? 'true' : 'false');
    }
  }
}

// Restore accordion states for all sections
function restaurerEtatAccordions() {
  try {
    const sections = ['specs', 'ventilo', 'definition', 'profils', 'image'];
    const keyMap = {
      'specs': SPECS_TAB_COLLAPSED_KEY,
      'ventilo': VENTILO_TAB_COLLAPSED_KEY,
      'definition': DEFINITION_TAB_COLLAPSED_KEY,
      'profils': PROFILS_TAB_COLLAPSED_KEY,
      'image': IMAGE_TAB_COLLAPSED_KEY
    };
    
    sections.forEach(tabName => {
      const key = keyMap[tabName];
      const isCollapsed = localStorage.getItem(key) === 'true';
      const body = document.getElementById(`${tabName}-tab-body`);
      const icon = document.getElementById(`${tabName}-tab-icon`);
      if (body && icon && isCollapsed) {
        body.classList.add('collapsed');
        icon.classList.add('collapsed');
      }
    });
  } catch (e) {
    console.warn('Erreur lors de la restauration des états accordéon', e);
  }
}

function toggleVentiloTab() {
  const body = document.getElementById('ventilo-tab-body');
  const icon = document.getElementById('ventilo-tab-icon');
  if (body && icon) {
    body.classList.toggle('collapsed');
    icon.classList.toggle('collapsed');
    const isCollapsed = body.classList.contains('collapsed');
    localStorage.setItem(VENTILO_TAB_COLLAPSED_KEY, isCollapsed ? 'true' : 'false');
  }
}

function restaurerEtatVentiloTab() {
  try {
    const isCollapsed = localStorage.getItem(VENTILO_TAB_COLLAPSED_KEY) === 'true';
    const body = document.getElementById('ventilo-tab-body');
    const icon = document.getElementById('ventilo-tab-icon');
    if (body && icon && isCollapsed) {
      body.classList.add('collapsed');
      icon.classList.add('collapsed');
    }
  } catch (e) {
    console.warn('Erreur lors de la restauration de l\'état onglet ventilation', e);
  }
}

function toggleVentiloGroup(group) {
  const container = document.getElementById(`ventilo-${group}-container`);
  const header = document.querySelector(`[data-ventilo-group="${group}"].ventilo-group-header`);
  const toggle = header ? header.querySelector('.ventilo-group-toggle') : null;
  if (container && toggle) {
    container.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
    const key = group === 'entree' ? VENTILO_ENTREE_COLLAPSED_KEY : VENTILO_SORTIE_COLLAPSED_KEY;
    const isCollapsed = container.classList.contains('collapsed');
    localStorage.setItem(key, isCollapsed ? 'true' : 'false');
  }
}

function restaurerEtatVentiloGroups() {
  try {
    const groups = ['entree', 'sortie'];
    groups.forEach(group => {
      const key = group === 'entree' ? VENTILO_ENTREE_COLLAPSED_KEY : VENTILO_SORTIE_COLLAPSED_KEY;
      const isCollapsed = localStorage.getItem(key) === 'true';
      const container = document.getElementById(`ventilo-${group}-container`);
      const header = document.querySelector(`[data-ventilo-group="${group}"].ventilo-group-header`);
      const toggle = header ? header.querySelector('.ventilo-group-toggle') : null;
      if (container && isCollapsed) {
        container.classList.add('collapsed');
        if (toggle) toggle.classList.add('collapsed');
      }
    });
  } catch (e) {
    console.warn('Erreur lors de la restauration de l\'état groupes ventilation', e);
  }
}

function toggleCalculateurThermique() {
  const content = document.getElementById('totem-calculator-content');
  const btn = document.getElementById('totem-calculator-toggle');
  if (!content || !btn) return;

  content.classList.toggle('collapsed');
  const isCollapsed = content.classList.contains('collapsed');
  btn.textContent = isCollapsed ? 'Afficher' : 'Réduire';
  btn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  localStorage.setItem(THERMAL_CALCULATOR_COLLAPSED_KEY, isCollapsed ? 'true' : 'false');
}

function restaurerEtatCalculateurThermique() {
  try {
    const storedValue = localStorage.getItem(THERMAL_CALCULATOR_COLLAPSED_KEY);
    const isCollapsed = storedValue === null ? true : storedValue === 'true';
    const content = document.getElementById('totem-calculator-content');
    const btn = document.getElementById('totem-calculator-toggle');
    if (!content || !btn) return;
    content.classList.toggle('collapsed', isCollapsed);
    btn.textContent = isCollapsed ? 'Afficher' : 'Réduire';
    btn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  } catch (e) {
    console.warn('Erreur lors de la restauration du calculateur thermique', e);
  }
}

let _specsTotemDebounce = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function moyenneNumerique(values = []) {
  const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function coefficientVentEurocodeEN1991_1_4(windKmh) {
  const vKmh = Number(windKmh);
  if (!Number.isFinite(vKmh) || vKmh <= 0) {
    return { factor: 1, qRef: null, qSite: null, source: 'EN 1991-1-4 (non disponible)' };
  }

  const rho = 1.225;
  const vSite = Math.max(0.5, vKmh / 3.6);
  const vRef = 25 / 3.6;
  const qSite = 0.5 * rho * vSite * vSite;
  const qRef = 0.5 * rho * vRef * vRef;
  const ratio = qSite / qRef;
  const factor = clamp(Math.pow(ratio, -0.12), 0.88, 1.08);
  return { factor, qRef, qSite, source: 'EN 1991-1-4 (q = 0.5*rho*v^2)' };
}

function getContexteClimatiquePourSurplus() {
  return {
    city: contexteClimatiqueSurplus.city || villeActuelle || '',
    latitude: Number.isFinite(Number(contexteClimatiqueSurplus.latitude)) ? Number(contexteClimatiqueSurplus.latitude) : null,
    longitude: Number.isFinite(Number(contexteClimatiqueSurplus.longitude)) ? Number(contexteClimatiqueSurplus.longitude) : null,
    solarMJm2Day: Number.isFinite(Number(contexteClimatiqueSurplus.solarMJm2Day)) ? Number(contexteClimatiqueSurplus.solarMJm2Day) : null,
    windKmh: Number.isFinite(Number(contexteClimatiqueSurplus.windKmh)) ? Number(contexteClimatiqueSurplus.windKmh) : null,
    source: contexteClimatiqueSurplus.source || 'fallback',
    updatedAt: contexteClimatiqueSurplus.updatedAt || null
  };
}

async function rafraichirContexteClimatiqueLocalisation(force = false) {
  const lat = Number(latActuelle);
  const lon = Number(lonActuelle);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const nowMs = Date.now();
  const previousTs = contexteClimatiqueSurplus.updatedAt ? new Date(contexteClimatiqueSurplus.updatedAt).getTime() : 0;
  const isSameSpot = Number(contexteClimatiqueSurplus.latitude) === lat && Number(contexteClimatiqueSurplus.longitude) === lon;
  if (!force && isSameSpot && previousTs && (nowMs - previousTs) < (6 * 60 * 60 * 1000)) {
    return;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=shortwave_radiation_sum,wind_speed_10m_max&timezone=auto&forecast_days=7`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Erreur API climat locale');
    const data = await res.json();
    const solarAvg = moyenneNumerique((data.daily && data.daily.shortwave_radiation_sum) || []);
    const windAvg = moyenneNumerique((data.daily && data.daily.wind_speed_10m_max) || []);

    contexteClimatiqueSurplus = {
      city: villeActuelle,
      latitude: lat,
      longitude: lon,
      solarMJm2Day: solarAvg,
      windKmh: windAvg,
      source: 'open-meteo forecast daily',
      updatedAt: new Date().toISOString()
    };
  } catch (e) {
    contexteClimatiqueSurplus = {
      city: villeActuelle,
      latitude: lat,
      longitude: lon,
      solarMJm2Day: contexteClimatiqueSurplus.solarMJm2Day,
      windKmh: contexteClimatiqueSurplus.windKmh,
      source: 'fallback (meteo city only)',
      updatedAt: new Date().toISOString()
    };
  }

  afficherDimensionsTotem(_lireSpecsDepuisDOM());
}

function calculerSurplusThermiqueIndicatif(specs = {}) {
  const parseMmToM = (value) => {
    const normalized = String(value ?? '').replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed / 1000 : null;
  };

  const baseWatt = Number(specs.watt);
  if (!Number.isFinite(baseWatt) || baseWatt <= 0) {
    return {
      baseWatt: null,
      coefficient: 1,
      surplusWatt: null,
      adjustedWatt: null,
      appliedRule: false,
      reason: 'Saisir une valeur de watt pour obtenir une estimation.'
    };
  }

  const environment = String(specs.environment || '').toLowerCase();
  const color = String(specs.color || '').toLowerCase();
  const sunExposure = String(specs.sunExposure || '').toLowerCase();

  if (environment !== 'outdoor') {
    const adjustedWatt = Number(baseWatt.toFixed(1));
    return {
      baseWatt,
      coefficient: 1,
      surplusWatt: 0,
      adjustedWatt,
      appliedRule: false,
      reason: 'Indoor: pas de correction climatique appliquée.',
      details: null
    };
  }

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
  const climate = getContexteClimatiquePourSurplus();

  const solar = Number(climate.solarMJm2Day);
  const wind = Number(climate.windKmh);
  const meanG = Number.isFinite(solar) ? (solar * 11.574) : null; // MJ/m2/day -> W/m2 average
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
  const hRad = 6; // Hypothese acier peint: ordre de grandeur 5-8 W/m2K
  const hTotal = hConv + hRad;

  let windMeta = null;
  if (Number.isFinite(wind)) {
    windMeta = coefficientVentEurocodeEN1991_1_4(wind);
  }

  const qSolar = Number.isFinite(gEffective) ? (alpha * gEffective * areaProjected) : 0;
  const transmissionToInternal = 0.35; // part du flux solaire absorbé convertie en charge interne (estimatif)
  const convectionAttenuation = clamp(11.7 / Math.max(8, hTotal), 0.45, 1.15);
  const projectedToTotalRatio = areaProjected / areaTotal;
  const geometricFactor = clamp(projectedToTotalRatio / 0.22, 0.70, 1.35);
  const rawSurplus = qSolar * transmissionToInternal * convectionAttenuation * geometricFactor;
  const surplusWatt = Number(Math.max(0, rawSurplus).toFixed(1));

  const adjustedWatt = Number((baseWatt + surplusWatt).toFixed(1));
  const coefficient = Number((adjustedWatt / baseWatt).toFixed(3));
  const climateBits = [
    Number.isFinite(solar) ? `irradiation ${solar.toFixed(1)} MJ/m²/j` : null,
    Number.isFinite(meanG) ? `G~${meanG.toFixed(0)} W/m²` : null,
    Number.isFinite(wind) ? `vent ${wind.toFixed(1)} km/h` : null,
    windMeta && Number.isFinite(windMeta.qSite) ? `qsite ${windMeta.qSite.toFixed(1)} N/m²` : null
  ].filter(Boolean);
  const climateTxt = climateBits.length ? climateBits.join(', ') : 'indices climatiques indisponibles';
  const reason = `Surplus basé sur Qsolaire=alpha*G*Aproj (acier), convection h=5.7+3.8V, hrad~6 et vent EN 1991-1-4. Params: alpha=${alpha.toFixed(2)}, Aproj=${areaProjected.toFixed(2)} m², ${climateTxt}, ville ${climate.city || villeActuelle}.`;
  return {
    baseWatt,
    coefficient,
    surplusWatt,
    adjustedWatt,
    appliedRule: coefficient > 1,
    reason,
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

function mettreAJourSurplusThermiqueIndicatif(specs = {}) {
  const valueEl = document.getElementById('totem-thermal-indicative-value');
  const noteEl = document.getElementById('totem-thermal-indicative-note');
  const solarEl = document.getElementById('totem-solar-indicative-value');
  const windEl = document.getElementById('totem-wind-indicative-value');
  const breakdownEl = document.getElementById('totem-thermal-breakdown-value');
  if (!valueEl || !noteEl || !solarEl || !windEl || !breakdownEl) return;

  const result = calculerSurplusThermiqueIndicatif(specs);
  const climate = getContexteClimatiquePourSurplus();
  const solar = Number(climate.solarMJm2Day);
  const wind = Number(climate.windKmh);
  const windMeta = Number.isFinite(wind) ? coefficientVentEurocodeEN1991_1_4(wind) : null;

  if (Number.isFinite(solar)) {
    const meanWm2 = solar * 11.574;
    solarEl.textContent = `Rayonnement solaire estimé: ${solar.toFixed(1)} MJ/m²/j (~${meanWm2.toFixed(0)} W/m² moyen) - ${climate.city || villeActuelle}`;
  } else {
    solarEl.textContent = 'Rayonnement solaire estimé: --';
  }

  if (windMeta && Number.isFinite(windMeta.qSite)) {
    windEl.textContent = `Indice vent (EN 1991-1-4): ${wind.toFixed(1)} km/h, q=${windMeta.qSite.toFixed(1)} N/m²`;
  } else {
    windEl.textContent = 'Indice vent (EN 1991-1-4): --';
  }

  if (result.adjustedWatt === null) {
    valueEl.textContent = 'Watt déclaré + surplus = total estimé: --';
    breakdownEl.textContent = 'Détail calcul: --';
    noteEl.textContent = 'Indicatif uniquement. Le débit nominal ventilateur reste manuel.';
    return;
  }

  const coeffTxt = result.coefficient.toFixed(2);
  const surplusTxt = result.surplusWatt > 0 ? `+${result.surplusWatt}` : '0.0';
  valueEl.textContent = `Watt déclaré + surplus = total estimé: ${result.baseWatt.toFixed(1)} W + ${surplusTxt} W = ${result.adjustedWatt} W (coef ${coeffTxt})`;
  if (result.details) {
    const d = result.details;
    const alphaTxt = Number.isFinite(d.alpha) ? d.alpha.toFixed(2) : '--';
    const meanGTxt = Number.isFinite(d.meanG) ? d.meanG.toFixed(0) : '--';
    const geffTxt = Number.isFinite(d.gEffective) ? d.gEffective.toFixed(0) : '--';
    const aprojTxt = Number.isFinite(d.areaProjected) ? d.areaProjected.toFixed(2) : '--';
    const atotTxt = Number.isFinite(d.areaTotal) ? d.areaTotal.toFixed(2) : '--';
    const geomTxt = Number.isFinite(d.geometricFactor) ? d.geometricFactor.toFixed(2) : '--';
    const widthTxt = Number.isFinite(d.widthM) ? d.widthM.toFixed(2) : '--';
    const heightTxt = Number.isFinite(d.heightM) ? d.heightM.toFixed(2) : '--';
    const depthTxt = Number.isFinite(d.depthM) ? d.depthM.toFixed(2) : '--';
    const hConvTxt = Number.isFinite(d.hConv) ? d.hConv.toFixed(1) : '--';
    const hRadTxt = Number.isFinite(d.hRad) ? d.hRad.toFixed(1) : '--';
    const qSolarTxt = Number.isFinite(d.qSolar) ? d.qSolar.toFixed(1) : '--';
    const attTxt = Number.isFinite(d.convectionAttenuation) ? d.convectionAttenuation.toFixed(2) : '--';
    breakdownEl.textContent = `Détail calcul: dims=${heightTxt}x${widthTxt}x${depthTxt} m, alpha=${alphaTxt}, G=${meanGTxt} W/m², Geff=${geffTxt} W/m², Aproj=${aprojTxt} m², Atot=${atotTxt} m², facteurGeom=${geomTxt}, h=${hConvTxt} W/m²K, hrad=${hRadTxt} W/m²K, Qsolaire=${qSolarTxt} W, atténuation=${attTxt}.`;
  } else {
    breakdownEl.textContent = 'Détail calcul: non applicable en indoor.';
  }
  noteEl.textContent = `${result.reason} Le débit nominal ventilateur reste modifiable manuellement.`;
}

function afficherDimensionsTotem(specs) {
  const overlay = document.getElementById('totem-dims-overlay');
  const h = specs.height ? `${specs.height}` : null;
  const w = specs.width ? `${specs.width}` : null;
  const d = specs.depth ? `${specs.depth}` : null;
  const parts = [];
  if (specs.name) parts.push(`<b>${specs.name}</b>`);
  if (h || w || d) parts.push(`${h||'?'} × ${w||'?'} × ${d||'?'} mm`);
  const thermal = calculerSurplusThermiqueIndicatif(specs);
  if (specs.watt) {
    parts.push(`Déclaré: ${specs.watt} W`);
    if (thermal.adjustedWatt !== null) {
      parts.push(`Surplus: +${Math.max(0, thermal.surplusWatt || 0).toFixed(1)} W`);
      parts.push(`Total estimé: ${thermal.adjustedWatt} W`);
    }
  }
  if (parts.length === 0) {
    if (overlay) overlay.classList.remove('visible');
    mettreAJourSurplusThermiqueIndicatif(specs);
    return;
  }
  if (overlay) {
    overlay.innerHTML = parts.join('<br>');
    overlay.classList.add('visible');
  }
  mettreAJourSurplusThermiqueIndicatif(specs);
}

function _appliquerSpecsTotem(specs) {
  const fields = [
    ['totem-spec-name', specs.name],
    ['totem-spec-height', specs.height],
    ['totem-spec-width', specs.width],
    ['totem-spec-depth', specs.depth],
    ['totem-spec-watt', specs.watt],
    ['totem-spec-environment', specs.environment],
    ['totem-spec-color', specs.color],
    ['totem-spec-sun-exposure', specs.sunExposure]
  ];
  fields.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
  });
  gererVisibiliteOptionsOutdoor(false);
  afficherDimensionsTotem(specs);
}

function gererVisibiliteOptionsOutdoor(persistIfCleared = false) {
  const environment = document.getElementById('totem-spec-environment')?.value || '';
  const outdoorOnlyIds = ['totem-outdoor-options', 'totem-sun-exposure-row'];
  const isOutdoor = environment === 'outdoor';

  outdoorOnlyIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('conditional-hidden', !isOutdoor);
  });

  if (!isOutdoor) {
    const color = document.getElementById('totem-spec-color');
    const sun = document.getElementById('totem-spec-sun-exposure');
    let changed = false;
    if (color && color.value) { color.value = ''; changed = true; }
    if (sun && sun.value) { sun.value = ''; changed = true; }
    if (persistIfCleared && changed) {
      sauvegarderSpecsTotem();
    }
  }
}

function _lireSpecsDepuisDOM() {
  return {
    name: document.getElementById('totem-spec-name')?.value || '',
    height: document.getElementById('totem-spec-height')?.value || '',
    width: document.getElementById('totem-spec-width')?.value || '',
    depth: document.getElementById('totem-spec-depth')?.value || '',
    watt: document.getElementById('totem-spec-watt')?.value || '',
    environment: document.getElementById('totem-spec-environment')?.value || '',
    color: document.getElementById('totem-spec-color')?.value || '',
    sunExposure: document.getElementById('totem-spec-sun-exposure')?.value || ''
  };
}

function sauvegarderSpecsTotem() {
  const specs = _lireSpecsDepuisDOM();
  // cache local immédiat
  localStorage.setItem(TOTEM_SPECS_KEY, JSON.stringify(specs));
  afficherDimensionsTotem(specs);
  // debounce pour ne pas spammer le serveur à chaque frappe
  clearTimeout(_specsTotemDebounce);
  _specsTotemDebounce = setTimeout(async () => {
    await sendToServer('/api/totem-specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(specs)
    });
  }, 800);
}

async function chargerSpecsTotem() {
  // 1. Afficher le cache local immédiatement pour éviter le flash vide
  try {
    const cached = localStorage.getItem(TOTEM_SPECS_KEY);
    if (cached) _appliquerSpecsTotem(JSON.parse(cached));
  } catch (e) {}
  // 2. Charger depuis le serveur (source de vérité)
  const specs = await sendToServer('/api/totem-specs');
  if (specs && typeof specs === 'object' && Object.keys(specs).length > 0) {
    localStorage.setItem(TOTEM_SPECS_KEY, JSON.stringify(specs));
    _appliquerSpecsTotem(specs);
  }
}

function getSpecsTotemCourants() {
  try {
    const cached = localStorage.getItem(TOTEM_SPECS_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch (e) { return {}; }
}
