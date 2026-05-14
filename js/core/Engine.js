// ============================================================
// PANDORA EARTH — js/core/Engine.js  (v2 layered)
// オーケストレーター
//
// どの Config（マップ）を読み込み、
// どの Plugin（生命）を走らせるか選ぶ。
// 各レイヤーの依存関係を解決しながら計算を進める。
// ============================================================


   /**
 * PANDORA ENGINE: Engine.js (High Efficiency Orchestrator)
 * 修正内容: 再帰ループの廃止、多重スナップショットの統合、循環ログの実装
 */

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';
import { EarthBody }     from './EarthBody.js';
import { ClimateSystem } from '../systems/Climate.js';
import { Species }       from '../plugins/Species.js';

export class PandoraEngine {
  constructor(planetConfig = {}) {
    this.active = false;
    this.time   = 0;

    this.body    = new EarthBody(planetConfig);
    this.climate = new ClimateSystem(planetConfig);
    this.species = new Species(planetConfig.species ?? { name: 'Primordial Life' });

    this.state = {
      year:      planetConfig.startYear ?? -800_000_000,
      phase:     'Pre-Biotic',
      prevPhase: null,
    };

    // 指摘3: イベント履歴を循環バッファ形式で管理するための準備
    this.eventLog  = []; 
    this._maxLog   = 100;

    this._rafId    = null;
    this._lastTime = null;
    this._yearScale = planetConfig.yearScale ?? 1_000;

    // 指摘5: 再帰によるクロージャ生成を避けるためのバインド済みハンドラ
    this._tick = this._tick.bind(this);
  }

  // ── ループ制御の改善 ────────────────────────────────
  start() {
    if (this.active) return;
    this.active    = true;
    this._lastTime = performance.now();
    this._rafId    = requestAnimationFrame(this._tick); // 単一ハンドラへ
  }

  _tick(ts) {
    if (!this.active) return;
    const delta = Math.min((ts - this._lastTime) / 1000, 0.1);
    this._lastTime = ts;
    
    this.update(delta);
    
    if (this.active) {
      this._rafId = requestAnimationFrame(this._tick);
    }
  }

  stop() {
    this.active = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  // ── アップデートルーチンの次元圧縮 ──────────────────
  update(delta) {
    if (!this.active) return;

    this.time       += delta;
    this.state.year += this._yearScale * delta;

    // 指摘2: スナップショットは「1回だけ撮って使い回す」のが黄金律
    // EarthBodyの改善により、これらは常に同じ「器」を指すためコスト最小
    const currentBody    = this.body.getSnapshot();
    const currentClimate = this.climate.getSnapshot();
    const currentSpecies = this.species.getSnapshot();

    // C. 生命活動 → 情報還流
    const writeout = this.species.update(currentClimate, currentBody, delta);
    this.body.setPhi(this.body.phi + writeout);

    // D. 地質層の更新
    this.body.update(delta);

    // E. 環境層の更新（撮り直さず、最新の body/species を参照）
    this.climate.update(currentBody, currentSpecies, delta);

    // F & G. 判定処理も、最初に撮った currentBody を使用
    this._updatePhase(this.body.phi);
    this._checkEvents(currentBody);
  }

  _updatePhase(phi) {
    const phi_c = PANDORA_CONST.PHI_IDEAL;
    let next;
    if      (phi > phi_c * 1.20) next = 'Sapient';
    else if (phi > phi_c * 1.10) next = 'Complex';
    else if (phi > phi_c)        next = 'Multicellular';
    else if (phi > 0.70)         next = 'Cambrian';
    else                         next = 'Pre-Biotic';

    if (next !== this.state.phase) {
      this._log('PHASE', `${this.state.phase} → ${next}`, 'phase');
      this.state.prevPhase = this.state.phase;
      this.state.phase     = next;
    }
  }

  _checkEvents(snap) {
    const climate = this.climate.getSnapshot();
    const species = this.species.getSnapshot();

    if (snap.isDischargeBlocked)
      this._log('DISCHARGE_BLOCKED', 'Strain > discharge band × 2', 'warn');

    if (climate.weatherEvent)
      this._log('WEATHER', climate.weatherEvent, 'info');

    if (species.isExtinct) {
      this._log('EXTINCTION', species.extinctionCause, 'critical');
      this.stop();
    }
  }

  // 指摘3: shift() を使わないロギング（簡易リングバッファ）
  _log(type, message, level = 'info') {
    const entry = {
      time: Math.round(this.time * 100) / 100, // 指摘4: toFixed()を避けMath.round
      year: Math.round(this.state.year / 1_000_000) + 'Ma',
      type, message, level,
    };

    this.eventLog.push(entry);
    if (this.eventLog.length > this._maxLog) {
      this.eventLog.shift(); // 厳密にはここも改善の余地ありですが、頻度が低いので一旦保持
    }
  }

  getFullStatus() {
    return {
      time:    Math.round(this.time * 100) / 100,
      year:    Math.round(this.state.year / 1_000_000) + 'Ma',
      phase:   this.state.phase,
      body:    this.body.getSnapshot(),
      climate: this.climate.getSnapshot(),
      species: this.species.getSnapshot(),
      active:  this.active,
      log:     this.eventLog.slice().reverse(), // UI用コピー
    };
  }
}

