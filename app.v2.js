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
  const totemUploadInput = document.getElementById('totem-image-upload');
  const totemDropzone = document.getElementById('totem-dropzone');
  const totemResetBtn = document.getElementById('totem-reset-image-btn');
  const modeAuto = document.getElementById('btn-mode-auto');
  const modeManu = document.getElementById('btn-mode-manu');

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

  // rename inputs
  for (let i = 0; i < 5; i++) {
    const inp = document.getElementById(`sonde-name-${i}`);
    if (inp) inp.addEventListener('input', (e) => changerNomSonde(i, e.target.value));
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
    ventiloTabToggle.addEventListener('click', () => toggleVentiloTab());
  }

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
    'totem-spec-color'
  ];
  specFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', sauvegarderSpecsTotem);
      field.addEventListener('change', sauvegarderSpecsTotem);
    }
  });

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

  initialiserProfils();
  initialiserVentilateurs();
  chargerSpecsTotem();
  restaurerEtatVentiloTab();
  restaurerEtatVentiloGroups();
  geolocalisationAutomatique();
  setInterval(recupererMeteo, 900000);
  demarrerMQTT();
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
  const wb = XLSX.utils.book_new();
  const dataGlobal = [['Date', 'Heure', 'Sonde', 'Température (°C)']];
  logComplet.forEach(e => dataGlobal.push([e.date, e.heure, getSondeLabel(e.sondeIdx), e.temp]));
  const wsGlobal = XLSX.utils.aoa_to_sheet(dataGlobal);
  wsGlobal['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsGlobal, 'Toutes sondes');

  const mesuresParSonde = Array.from({ length: NB_SONDES }, () => []);
  logComplet.forEach(e => {
    if (typeof e.sondeIdx === 'number' && e.sondeIdx >= 0 && e.sondeIdx < NB_SONDES) {
      mesuresParSonde[e.sondeIdx].push(e);
    }
  });
  mesuresParSonde.forEach((mesuresSonde, i) => {
    if (mesuresSonde.length === 0) return;
    const data = [['Date', 'Heure', 'Température (°C)']];
    mesuresSonde.forEach(e => data.push([e.date, e.heure, e.temp]));
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, getSondeLabel(i));
  });

  // Onglet Fiche Totem avec specs
  const specs = getSpecsTotemCourants();
  const envLabel = { indoor: 'Indoor', outdoor: 'Outdoor' }[specs.environment] || specs.environment || '--';
  const wsSpecs = XLSX.utils.aoa_to_sheet([
    ['Fiche Totem', ''],
    ['Nom', specs.name || '--'],
    ['Exporté le', new Date().toLocaleString('fr-FR')],
    ['', ''],
    ['Dimensions', ''],
    ['Hauteur (mm)', specs.height || '--'],
    ['Largeur (mm)', specs.width || '--'],
    ['Profondeur (mm)', specs.depth || '--'],
    ['', ''],
    ['Technique', ''],
    ['Watt à dissiper', specs.watt ? `${specs.watt} W` : '--'],
    ['Environnement', envLabel],
    ['Couleur', specs.color || '--'],
  ]);
  wsSpecs['!cols'] = [{ wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSpecs, 'Fiche Totem');

  XLSX.writeFile(wb, `temperatures_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.xlsx`);
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
const VENTILO_COLLAPSED_KEY = 'ventilo_collapsed';
const VENTILO_TAB_COLLAPSED_KEY = 'ventilo_tab_collapsed';
const VENTILO_ENTREE_COLLAPSED_KEY = 'ventilo_entree_collapsed';
const VENTILO_SORTIE_COLLAPSED_KEY = 'ventilo_sortie_collapsed';
const TOTEM_SPECS_KEY = 'totem_specs';
let profilsEnregistres = {};
let profilActuel = 'default';
let totemImageLibrary = [];
let totemSelectedImage = TOTEM_DEFAULT_IMAGE;

function getSondeLabel(idx) {
  return SONDE_CUSTOM_NAMES[idx] ? `${SONDE_PREFIX[idx]} - ${SONDE_CUSTOM_NAMES[idx]}` : SONDE_PREFIX[idx];
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
    body: JSON.stringify({ name, names: [...SONDE_CUSTOM_NAMES], positions: getCurrentPositions() })
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
    return;
  }
  const profil = profilsEnregistres[nom];
  if (!profil) return;
  if (Array.isArray(profil.names)) profil.names.forEach((value, idx) => { if (idx < NB_SONDES) { SONDE_CUSTOM_NAMES[idx] = value || ''; const input = document.getElementById(`sonde-name-${idx}`); if (input) input.value = SONDE_CUSTOM_NAMES[idx]; } });
  if (Array.isArray(profil.positions)) applyPositions(profil.positions);
  mettreAJourAffichageNomsSondes();
  if (enregistrerLast) localStorage.setItem(PROFIL_LAST_KEY, nom);
}

async function sauvegarderProfil() {
  const libelle = document.getElementById('profile-name').value.trim();
  if (!libelle) { alert('Veuillez saisir un nom de profil.'); return; }
  profilsEnregistres[libelle] = { name: libelle, names: [...SONDE_CUSTOM_NAMES], positions: getCurrentPositions(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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
  if (last && last !== 'default' && profilsEnregistres[last]) await chargerProfil(last, false); else chargerNomsSondes();
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
    document.getElementById('meteo-temp').innerHTML = `${DonneesMeteo.current_weather.temperature.toFixed(1)}<span class="card-unit">°C</span>`;
    document.getElementById('meteo-status').textContent = `Mis à jour à ${new Date().toLocaleTimeString('fr-FR')}`;
    divMeteo.classList.add('active');
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

function sauvegarderConfigVentilateurs() {
  const config = {
    debit: parseFloat(document.getElementById('ventilo-debit-input').value) || 0,
    entree: [],
    sortie: []
  };

  for (let i = 0; i < 8; i++) {
    const checkbox = document.getElementById(`ventilo-entree-${i}`);
    const slider = document.getElementById(`ventilo-entree-${i}-speed`);
    config.entree.push({
      active: checkbox ? checkbox.checked : false,
      speed: slider ? parseInt(slider.value) : 50
    });
  }

  for (let i = 0; i < 8; i++) {
    const checkbox = document.getElementById(`ventilo-sortie-${i}`);
    const slider = document.getElementById(`ventilo-sortie-${i}-speed`);
    config.sortie.push({
      active: checkbox ? checkbox.checked : false,
      speed: slider ? parseInt(slider.value) : 50
    });
  }

  localStorage.setItem(VENTILO_STORAGE_KEY, JSON.stringify(config));
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

let _specsTotemDebounce = null;

function afficherDimensionsTotem(specs) {
  const overlay = document.getElementById('totem-dims-overlay');
  if (!overlay) return;
  const h = specs.height ? `${specs.height}` : null;
  const w = specs.width ? `${specs.width}` : null;
  const d = specs.depth ? `${specs.depth}` : null;
  const parts = [];
  if (specs.name) parts.push(`<b>${specs.name}</b>`);
  if (h || w || d) parts.push(`${h||'?'} × ${w||'?'} × ${d||'?'} mm`);
  if (specs.watt) parts.push(`${specs.watt} W`);
  if (parts.length === 0) {
    overlay.classList.remove('visible');
    return;
  }
  overlay.innerHTML = parts.join('<br>');
  overlay.classList.add('visible');
}

function _appliquerSpecsTotem(specs) {
  const fields = [
    ['totem-spec-name', specs.name],
    ['totem-spec-height', specs.height],
    ['totem-spec-width', specs.width],
    ['totem-spec-depth', specs.depth],
    ['totem-spec-watt', specs.watt],
    ['totem-spec-environment', specs.environment],
    ['totem-spec-color', specs.color]
  ];
  fields.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
  });
  afficherDimensionsTotem(specs);
}

function _lireSpecsDepuisDOM() {
  return {
    name: document.getElementById('totem-spec-name')?.value || '',
    height: document.getElementById('totem-spec-height')?.value || '',
    width: document.getElementById('totem-spec-width')?.value || '',
    depth: document.getElementById('totem-spec-depth')?.value || '',
    watt: document.getElementById('totem-spec-watt')?.value || '',
    environment: document.getElementById('totem-spec-environment')?.value || '',
    color: document.getElementById('totem-spec-color')?.value || ''
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
