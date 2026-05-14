// ============================================================
// PANDORA EARTH — js/main.js
// オーケストレーター統合エントリーポイント
//
// 1. 惑星 Config を読み込む
// 2. Engine を起動する
// 3. Visualizer にスナップショットを渡す
// 4. UI イベントを処理する
// ============================================================

import { PANDORA_CONST, PANDORA_DERIVED } from './constants.js';
import { PandoraEngine }     from './core/Engine.js';
import { SphereVisualizer }  from './visuals/Sphere.js';
import { PLANET_EARTH, PLANET_MARS, PLANET_OCEAN } from '../config/planets/earth.js';

// ============================================================
// GLOBALS
// ============================================================

let engine    = null;
let visualizer = null;

// 利用可能な惑星 Config マップ
const PLANETS = {
  earth: PLANET_EARTH,
  mars:  PLANET_MARS,
  ocean: PLANET_OCEAN,
};

// ============================================================
// INIT
// ============================================================

function init(planetId = 'earth') {

  // 既存エンジン停止
  if (engine)     engine.stop();
  if (visualizer) visualizer.stopLoop();

  const config = PLANETS[planetId] ?? PLANET_EARTH;

  // Engine 起動
  engine = new PandoraEngine(config);

  // Visualizer 起動
  visualizer = new SphereVisualizer('mainCanvas');
  visualizer.startLoop(() => engine.getFullStatus());

  // Engine ループ開始
  engine.start();

  console.log(`[PANDORA EARTH] ${config.name} loaded`);
  console.log(`[PANDORA EARTH] bgf = ${PANDORA_DERIVED.BGF.toFixed(4)}`);
  console.log(`[PANDORA EARTH] Φ_ideal = ${PANDORA_CONST.PHI_IDEAL.toFixed(4)}`);

  // UI 初期表示
  updatePlanetSelector(planetId);
  startUILoop();
}

// ============================================================
// UI LOOP — 500ms ごとにパネルを更新
// ============================================================

let _uiTimer = null;

function startUILoop() {
  if (_uiTimer) clearInterval(_uiTimer);
  _uiTimer = setInterval(() => {
    if (!engine) return;
    const snap = engine.getFullStatus();
    updateHeader(snap);
    updateBodyPanel(snap.body);
    updateClimatePanel(snap.climate);
    updateSpeciesPanel(snap.species);
    updateEventLog(snap.log);
  }, 500);
}

// ============================================================
// HEADER
// ============================================================

function updateHeader(snap) {
  setText('hYear',  snap.year);
  setText('hPhase', snap.phase);
  setText('hPhi',   snap.body.phi.toFixed(4));
  setText('hStrain', snap.body.strain.toFixed(2));

  const phaseColors = {
    'Pre-Biotic':    '#4a8aaa',
    'Cambrian':      '#00ff99',
    'Multicellular': '#88ffbb',
    'Complex':       '#ffcc44',
    'Sapient':       '#ff7744',
  };
  setColor('hPhase', phaseColors[snap.phase] ?? '#aaaaaa');
  setColor('hStrain', snap.body.strain >= 10 ? '#ff2244' : snap.body.strain >= 8.5 ? '#ffaa00' : '#00e5a0');
}

// ============================================================
// PANELS
// ============================================================

function updateBodyPanel(body) {
  setText('bPhi',         body.phi.toFixed(4));
  setText('bStrain',      body.strain.toFixed(3));
  setText('bInflow',      body.entropyInflow.toFixed(4));
  setText('bOutflow',     body.entropyOutflow.toFixed(4));
  setText('bNetEntropy',  body.netEntropy.toFixed(4));
  setText('bMantleTemp',  body.mantleTemp.toFixed(1) + '℃');
  setText('bDischarge',   body.isDischargeBlocked ? '⚠ BLOCKED' : 'OK');
  setColor('bDischarge',  body.isDischargeBlocked ? '#ff2244' : '#00e5a0');
}

function updateClimatePanel(climate) {
  setText('cTemp',        climate.surfaceTemp.toFixed(2) + '℃');
  setText('cStability',   (climate.stability * 100).toFixed(1) + '%');
  setText('cHumidity',    (climate.humidity  * 100).toFixed(1) + '%');
  setText('cAlbedo',      climate.albedo.toFixed(2));
  setText('cGreenhouse',  climate.greenhouse.toFixed(3));
  setText('cWeather',     climate.weatherEvent ?? '—');
  setColor('cWeather',    climate.weatherEvent ? '#ffaa00' : '#3a6a4a');
  setColor('cTemp',
    climate.surfaceTemp > 45 ? '#ff2244' :
    climate.surfaceTemp < -10 ? '#44aaff' : '#c8e8d8'
  );
}

function updateSpeciesPanel(species) {
  setText('sPop',     (species.population   * 100).toFixed(1) + '%');
  setText('sBio',     (species.biodiversity * 100).toFixed(1) + '%');
  setText('sTech',    (species.techLevel    * 100).toFixed(1) + '%');
  setText('sDrive',   species.drive.toFixed(4));
  setText('sStatus',  species.isExtinct ? '✕ ' + (species.extinctionCause ?? 'EXTINCT') : '● ALIVE');
  setColor('sStatus', species.isExtinct ? '#ff2244' : '#00e5a0');
}

// ============================================================
// EVENT LOG
// ============================================================

function updateEventLog(log) {
  const el = document.getElementById('eventLog');
  if (!el || !log?.length) return;

  el.innerHTML = log.slice(0, 20).map(entry => {
    const col = entry.level === 'critical' ? '#ff2244'
              : entry.level === 'warn'     ? '#ffaa00'
              : entry.level === 'phase'    ? '#00ff99'
              : '#3a7a5a';
    return `<div style="color:${col};font-size:0.65rem;line-height:1.8;border-bottom:1px solid #0a1f0a;padding:2px 0">
      <span style="color:#1a4a2a">[${entry.year}]</span> ${entry.type}: ${entry.message}
    </div>`;
  }).join('');
}

// ============================================================
// PLANET SELECTOR
// ============================================================

function updatePlanetSelector(activeId) {
  document.querySelectorAll('.planet-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.planet === activeId);
  });
}

// ============================================================
// DOM HELPERS
// ============================================================

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setColor(id, color) {
  const el = document.getElementById(id);
  if (el) el.style.color = color;
}

// ============================================================
// BOOT
// ============================================================

window.addEventListener('load', () => {

  // 惑星切り替えボタン
  document.querySelectorAll('.planet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      init(btn.dataset.planet);
    });
  });

  // 一時停止ボタン
  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (engine.active) {
        engine.stop();
        pauseBtn.textContent = '▶ RESUME';
      } else {
        engine.start();
        pauseBtn.textContent = '⏸ PAUSE';
      }
    });
  }

  // リセットボタン
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const active = document.querySelector('.planet-btn.active')?.dataset.planet ?? 'earth';
      init(active);
      if (pauseBtn) pauseBtn.textContent = '⏸ PAUSE';
    });
  }

  // 起動
  init('earth');
});
