/* ═══════════════════════════════════════════════════
   UrbanPulse — dashboard.js
   Full map + heatmap + data management logic
═══════════════════════════════════════════════════ */

'use strict';

/* ── Constants ── */
const API_BASE     = '/api';
const MAP_CENTER   = [37.8, -96.9];   // USA center
const MAP_ZOOM     = 4;

/* ── State ── */
let allLocations    = [];
let markersLayer    = null;
let heatLayer       = null;
let heatVisible     = true;
let markersVisible  = true;
let filterMin       = 0;

/* ══════════════════════════════════════════════════
   MAP INIT
══════════════════════════════════════════════════ */
const map = L.map('map', {
  center: MAP_CENTER,
  zoom: MAP_ZOOM,
  zoomControl: true,
  attributionControl: true,
});

// Dark basemap tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
  maxZoom: 19,
  subdomains: 'abcd',
}).addTo(map);

markersLayer = L.layerGroup().addTo(map);

/* ══════════════════════════════════════════════════
   COLOUR HELPERS
══════════════════════════════════════════════════ */
function scoreColor(score) {
  if (score >= 7)  return '#2ecc71';
  if (score >= 4)  return '#f39c12';
  return '#e74c3c';
}

function scoreClass(score) {
  if (score >= 7)  return 'score-high';
  if (score >= 4)  return 'score-medium';
  return 'score-low';
}

function scoreLabel(score) {
  if (score >= 7)  return '▲ HIGH GROWTH';
  if (score >= 4)  return '◆ MEDIUM GROWTH';
  return '▼ LOW GROWTH';
}

function gradeColor(label) {
  if (label.includes('HIGH'))   return 'color:var(--green)';
  if (label.includes('MEDIUM')) return 'color:var(--yellow)';
  return 'color:var(--red)';
}

/* ══════════════════════════════════════════════════
   CUSTOM MARKER ICON
══════════════════════════════════════════════════ */
function makeIcon(score) {
  const color  = scoreColor(score);
  const size   = score >= 7 ? 14 : score >= 4 ? 11 : 9;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size+8}" height="${size+8}">
      <circle cx="${(size+8)/2}" cy="${(size+8)/2}" r="${size/2+1}"
        fill="${color}" fill-opacity="0.18" />
      <circle cx="${(size+8)/2}" cy="${(size+8)/2}" r="${size/2}"
        fill="${color}" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [size+8, size+8],
    iconAnchor: [(size+8)/2, (size+8)/2],
    popupAnchor:[0, -(size+8)/2],
  });
}

/* ══════════════════════════════════════════════════
   POPUP CONTENT
══════════════════════════════════════════════════ */
function buildPopup(loc) {
  const color = scoreColor(loc.growth_score);
  const cls   = scoreClass(loc.growth_score);
  const grade = scoreLabel(loc.growth_score);
  return `
    <div class="popup-card">
      <div class="popup-header">
        <div class="popup-area">${loc.area_name}</div>
        <div class="popup-score ${cls}">${loc.growth_score.toFixed(1)}</div>
      </div>
      <div class="popup-rows">
        <div class="popup-row">
          <span class="popup-key">Price / sqft</span>
          <span class="popup-val">$${loc.price_per_sqft.toLocaleString()}</span>
        </div>
        <div class="popup-row">
          <span class="popup-key">Rental Yield</span>
          <span class="popup-val">${loc.rental_yield.toFixed(1)}%</span>
        </div>
        <div class="popup-row">
          <span class="popup-key">Infra Score</span>
          <span class="popup-val">${loc.infra_score.toFixed(1)} / 10</span>
        </div>
        <div class="popup-row">
          <span class="popup-key">Listing Density</span>
          <span class="popup-val">${loc.listing_density}</span>
        </div>
      </div>
      <div class="popup-grade" style="${gradeColor(grade)}">${grade}</div>
    </div>`;
}

/* ══════════════════════════════════════════════════
   RENDER MAP
══════════════════════════════════════════════════ */
function renderMap(locations) {
  // Clear existing
  markersLayer.clearLayers();
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }

  // Remove empty state if any
  document.getElementById('mapEmpty')?.remove();

  if (!locations || locations.length === 0) {
    const empty = document.createElement('div');
    empty.id        = 'mapEmpty';
    empty.className = 'map-empty';
    empty.innerHTML = `
      <div class="map-empty-icon">🏙</div>
      <div class="map-empty-text">No location data found</div>
      <div class="map-empty-sub">Upload a CSV or add locations manually to get started</div>`;
    document.querySelector('.main').appendChild(empty);
    return;
  }

  // Apply filter
  const visible = locations.filter(l => l.growth_score >= filterMin);

  // ── Heatmap layer ──
  const heatPoints = visible.map(loc => [
    loc.latitude,
    loc.longitude,
    loc.growth_score / 10,   // Leaflet.heat expects 0–1 intensity
  ]);

  heatLayer = L.heatLayer(heatPoints, {
    radius:  40,
    blur:    30,
    maxZoom: 10,
    max:     1.0,
    gradient: {
      0.0: '#1a1a2e',
      0.2: '#e74c3c',
      0.5: '#f39c12',
      0.8: '#2ecc71',
      1.0: '#00ff88',
    },
  });

  if (heatVisible) heatLayer.addTo(map);

  // ── Marker layer ──
  visible.forEach(loc => {
    const marker = L.marker([loc.latitude, loc.longitude], {
      icon: makeIcon(loc.growth_score),
    });

    marker.bindPopup(buildPopup(loc), {
      maxWidth: 260,
      className: '',
    });

    marker.on('click', () => showInfoStrip(loc));
    markersLayer.addLayer(marker);
  });

  if (!markersVisible) markersLayer.remove();
  else if (!map.hasLayer(markersLayer)) markersLayer.addTo(map);

  // Fit bounds if data available
  if (visible.length > 0) {
    const bounds = L.latLngBounds(visible.map(l => [l.latitude, l.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }
}

/* ══════════════════════════════════════════════════
   INFO STRIP (bottom panel)
══════════════════════════════════════════════════ */
function showInfoStrip(loc) {
  const strip = document.getElementById('infoStrip');
  document.getElementById('stripArea').textContent   = loc.area_name;
  document.getElementById('stripPrice').textContent  = `$${loc.price_per_sqft.toLocaleString()}`;
  document.getElementById('stripYield').textContent  = `${loc.rental_yield.toFixed(1)}%`;
  document.getElementById('stripInfra').textContent  = `${loc.infra_score.toFixed(1)}/10`;
  document.getElementById('stripScore').textContent  = loc.growth_score.toFixed(2);
  document.getElementById('stripDensity').textContent = loc.listing_density;

  const scoreEl = document.getElementById('stripScore');
  scoreEl.style.color = scoreColor(loc.growth_score);

  strip.style.display = 'flex';
}

document.getElementById('stripClose').addEventListener('click', () => {
  document.getElementById('infoStrip').style.display = 'none';
});

/* ══════════════════════════════════════════════════
   API CALLS
══════════════════════════════════════════════════ */
async function fetchLocations() {
  showLoading(true);
  try {
    const res  = await fetch(`${API_BASE}/locations/`);
    const data = await res.json();
    allLocations = data.locations || [];
    renderMap(allLocations);
    renderStats();
    setLastUpdated();
  } catch (err) {
    showToast('Failed to fetch locations: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function fetchStats() {
  try {
    const res  = await fetch(`${API_BASE}/stats/`);
    const data = await res.json();
    applyStats(data);
  } catch (_) {}
}

function renderStats() {
  fetchStats();
}

function applyStats(data) {
  if (!data || data.message) {
    document.getElementById('statTotalVal').textContent = '0';
    document.getElementById('statAvgVal').textContent   = '—';
    document.getElementById('statHighVal').textContent  = '0';
    document.getElementById('statLowVal').textContent   = '0';
    return;
  }
  animateCount('statTotalVal', data.total_locations);
  animateCount('statAvgVal',   data.avg_growth_score,  1);
  animateCount('statHighVal',  data.high_growth_zones);
  animateCount('statLowVal',   data.low_growth_zones);
}

function animateCount(elId, target, decimals = 0) {
  const el    = document.getElementById(elId);
  const start = parseFloat(el.textContent) || 0;
  const diff  = target - start;
  const steps = 24;
  let   step  = 0;
  const id = setInterval(() => {
    step++;
    const val = start + diff * (step / steps);
    el.textContent = decimals ? val.toFixed(decimals) : Math.round(val);
    if (step >= steps) { el.textContent = decimals ? target.toFixed(decimals) : target; clearInterval(id); }
  }, 20);
}

async function addLocation(payload) {
  const res  = await fetch(`${API_BASE}/locations/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}

async function uploadCSV(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_BASE}/upload-csv/`, { method: 'POST', body: fd });
  return res.json();
}

async function clearAll() {
  const res = await fetch(`${API_BASE}/clear/`, { method: 'DELETE' });
  return res.json();
}

/* ══════════════════════════════════════════════════
   SIDEBAR TOGGLE
══════════════════════════════════════════════════ */
const sidebar = document.getElementById('sidebar');
const main    = document.querySelector('.main');

document.getElementById('sidebarToggle').addEventListener('click', () => {
  sidebar.classList.toggle('hidden');
  main.classList.toggle('expanded');
  setTimeout(() => map.invalidateSize(), 200);
});

/* ══════════════════════════════════════════════════
   LAYER TOGGLES
══════════════════════════════════════════════════ */
document.getElementById('toggleHeatmap').addEventListener('change', e => {
  heatVisible = e.target.checked;
  if (heatLayer) {
    if (heatVisible) heatLayer.addTo(map);
    else             map.removeLayer(heatLayer);
  }
});

document.getElementById('toggleMarkers').addEventListener('change', e => {
  markersVisible = e.target.checked;
  if (markersVisible) markersLayer.addTo(map);
  else                map.removeLayer(markersLayer);
});

/* ══════════════════════════════════════════════════
   FILTER SLIDER
══════════════════════════════════════════════════ */
const filterSlider  = document.getElementById('filterMin');
const filterValEl   = document.getElementById('filterMinVal');

filterSlider.addEventListener('input', e => {
  filterMin           = parseFloat(e.target.value);
  filterValEl.textContent = filterMin.toFixed(1);
  renderMap(allLocations);
});

/* ══════════════════════════════════════════════════
   BUTTONS
══════════════════════════════════════════════════ */
document.getElementById('btnRefresh').addEventListener('click', () => {
  fetchLocations();
  showToast('Map refreshed ↻', 'success');
});

document.getElementById('csvInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  showLoading(true);
  try {
    const data = await uploadCSV(file);
    if (data.created !== undefined) {
      showToast(`✓ Imported ${data.created} location(s)`, 'success');
      if (data.errors && data.errors.length) {
        console.warn('CSV import warnings:', data.errors);
      }
      await fetchLocations();
    } else {
      showToast('Upload error: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    showLoading(false);
    e.target.value = '';
  }
});

document.getElementById('btnSample').addEventListener('click', async () => {
  showLoading(true);
  try {
    // Generate sample data inline (no server seed needed from UI)
    const samples = generateSampleData();
    let created = 0;
    for (const s of samples) {
      try { await addLocation(s); created++; } catch (_) {}
    }
    showToast(`✓ Added ${created} sample locations`, 'success');
    await fetchLocations();
  } catch (err) {
    showToast('Error loading samples: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
});

document.getElementById('btnClear').addEventListener('click', async () => {
  if (!confirm('Delete ALL location data? This cannot be undone.')) return;
  showLoading(true);
  try {
    const data = await clearAll();
    showToast(`✓ ${data.message}`, 'success');
    allLocations = [];
    renderMap([]);
    applyStats({});
    document.getElementById('infoStrip').style.display = 'none';
  } catch (err) {
    showToast('Clear failed: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
});

/* ══════════════════════════════════════════════════
   ADD LOCATION FORM
══════════════════════════════════════════════════ */
document.getElementById('addLocationForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd      = new FormData(e.target);
  const payload = Object.fromEntries(
    [...fd.entries()].map(([k, v]) => [k, isNaN(v) || v === '' ? v : parseFloat(v)])
  );
  try {
    await addLocation(payload);
    showToast(`✓ Added "${payload.area_name}"`, 'success');
    e.target.reset();
    await fetchLocations();
  } catch (err) {
    showToast('Add failed: ' + err.message, 'error');
  }
});

/* ══════════════════════════════════════════════════
   UTILITY: LOADING OVERLAY
══════════════════════════════════════════════════ */
let loadingEl = null;

function showLoading(show) {
  if (show) {
    if (loadingEl) return;
    loadingEl = document.createElement('div');
    loadingEl.className = 'map-loading';
    loadingEl.innerHTML = '<div class="spinner"></div><span>Loading data…</span>';
    document.querySelector('.main').appendChild(loadingEl);
  } else {
    if (loadingEl) { loadingEl.remove(); loadingEl = null; }
  }
}

/* ══════════════════════════════════════════════════
   UTILITY: TOAST
══════════════════════════════════════════════════ */
let toastTimer = null;

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3200);
}

/* ══════════════════════════════════════════════════
   UTILITY: LAST UPDATED
══════════════════════════════════════════════════ */
function setLastUpdated() {
  const now = new Date();
  document.getElementById('lastUpdated').textContent =
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ══════════════════════════════════════════════════
   SAMPLE DATA GENERATOR (fallback for "Load Sample")
══════════════════════════════════════════════════ */
function generateSampleData() {
  return [
    { area_name:"Downtown Austin TX",    latitude:30.267,  longitude:-97.743, price_per_sqft:420,  rental_yield:7.2, infra_score:8.5, listing_density:340 },
    { area_name:"Midtown Atlanta GA",    latitude:33.784,  longitude:-84.383, price_per_sqft:280,  rental_yield:8.1, infra_score:7.8, listing_density:290 },
    { area_name:"Uptown Dallas TX",      latitude:32.797,  longitude:-96.806, price_per_sqft:310,  rental_yield:7.5, infra_score:8.1, listing_density:310 },
    { area_name:"Wynwood Miami FL",      latitude:25.801,  longitude:-80.199, price_per_sqft:480,  rental_yield:7.8, infra_score:7.6, listing_density:280 },
    { area_name:"SoHo New York NY",      latitude:40.723,  longitude:-74.003, price_per_sqft:1850, rental_yield:4.2, infra_score:9.5, listing_density:620 },
    { area_name:"Capitol Hill Seattle",  latitude:47.624,  longitude:-122.319,price_per_sqft:680,  rental_yield:5.8, infra_score:8.4, listing_density:390 },
    { area_name:"Mission District SF",   latitude:37.760,  longitude:-122.415,price_per_sqft:1200, rental_yield:4.5, infra_score:8.0, listing_density:510 },
    { area_name:"NoDa Charlotte NC",     latitude:35.231,  longitude:-80.812, price_per_sqft:210,  rental_yield:8.9, infra_score:7.2, listing_density:195 },
    { area_name:"River North Denver CO", latitude:39.762,  longitude:-104.985,price_per_sqft:390,  rental_yield:6.4, infra_score:8.3, listing_density:320 },
    { area_name:"East Nashville TN",     latitude:36.175,  longitude:-86.762, price_per_sqft:250,  rental_yield:6.8, infra_score:6.5, listing_density:220 },
    { area_name:"Short North Columbus",  latitude:39.978,  longitude:-83.003, price_per_sqft:195,  rental_yield:7.1, infra_score:6.8, listing_density:230 },
    { area_name:"Montrose Houston TX",   latitude:29.745,  longitude:-95.389, price_per_sqft:230,  rental_yield:6.9, infra_score:6.7, listing_density:260 },
    { area_name:"Midtown Memphis TN",    latitude:35.142,  longitude:-90.049, price_per_sqft:140,  rental_yield:9.2, infra_score:5.5, listing_density:180 },
    { area_name:"Eastside Detroit MI",   latitude:42.354,  longitude:-82.982, price_per_sqft:60,   rental_yield:11.0,infra_score:2.5, listing_density:80  },
    { area_name:"North Tulsa OK",        latitude:36.182,  longitude:-95.991, price_per_sqft:75,   rental_yield:10.2,infra_score:3.0, listing_density:95  },
    { area_name:"South Loop Chicago IL", latitude:41.850,  longitude:-87.626, price_per_sqft:360,  rental_yield:6.9, infra_score:8.9, listing_density:450 },
    { area_name:"Rust Belt Erie PA",     latitude:42.129,  longitude:-80.085, price_per_sqft:70,   rental_yield:10.8,infra_score:3.5, listing_density:90  },
    { area_name:"Broad Ripple Indy IN",  latitude:39.867,  longitude:-86.141, price_per_sqft:175,  rental_yield:7.5, infra_score:6.0, listing_density:160 },
    { area_name:"West End Birmingham AL",latitude:33.515,  longitude:-86.858, price_per_sqft:85,   rental_yield:9.8, infra_score:3.5, listing_density:110 },
    { area_name:"North Milwaukee WI",    latitude:43.084,  longitude:-87.950, price_per_sqft:110,  rental_yield:9.5, infra_score:4.2, listing_density:130 },
  ];
}

/* ══════════════════════════════════════════════════
   CSV DOWNLOAD HELPER (sample template)
══════════════════════════════════════════════════ */
function downloadSampleCSV() {
  const header = 'area_name,latitude,longitude,price_per_sqft,rental_yield,infra_score,listing_density\n';
  const rows   = generateSampleData().map(d =>
    `${d.area_name},${d.latitude},${d.longitude},${d.price_per_sqft},${d.rental_yield},${d.infra_score},${d.listing_density}`
  ).join('\n');
  const blob   = new Blob([header + rows], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = 'sample_urban_data.csv';
  a.click();
  URL.revokeObjectURL(url);
}
// Expose for optional console use
window.downloadSampleCSV = downloadSampleCSV;

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
(async function init() {
  await fetchLocations();

  // Auto-refresh every 60 seconds
  setInterval(() => {
    fetchLocations();
  }, 60_000);
})();
