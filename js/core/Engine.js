// ============================================================
// PANDORA EARTH — js/core/Engine.js  (v2 layered)
// オーケストレーター
//
// どの Config（マップ）を読み込み、
// どの Plugin（生命）を走らせるか選ぶ。
// 各レイヤーの依存関係を解決しながら計算を進める。
// ============================================================

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';
import { EarthBody }     from './EarthBody.js';
import { ClimateSystem } from '../systems/Climate.js';
import { Species }       from '../plugins/Species.js';

export class PandoraEngine {

  constructor(planetConfig = {}) {

    this.active = false;
    this.time   = 0;

    // ── 各レイヤーのインスタンス化 ────────────────────────
    this.body    = new EarthBody(planetConfig);
    this.climate = new ClimateSystem(planetConfig);
    this.species = new Species(
      planetConfig.species ?? { name: 'Primordial Life' }
    );

    // ── 統合状態（UI表示用）──────────────────────────────
    this.state = {
      year:      planetConfig.startYear ?? -800_000_000,
      phase:     'Pre-Biotic',
      prevPhase: null,
    };

    // ── イベント履歴 ──────────────────────────────────────
    this.eventLog  = [];
    this._maxLog   = 100;

    // ── ループ制御 ────────────────────────────────────────
    this._rafId    = null;
    this._lastTime = null;
    this._yearScale = planetConfig.yearScale ?? 1_000; // delta あたりの年数
  }

  // ── 起動 / 停止 / リセット ────────────────────────────
  start() {
    if (this.active) return;
    this.active    = true;
    this._lastTime = performance.now();
    this._loop();
  }

  stop() {
    this.active = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  reset(planetConfig = {}) {
    this.stop();
    Object.assign(this, new PandoraEngine(planetConfig));
  }

  // ── requestAnimationFrame ループ ─────────────────────
  _loop() {
    if (!this.active) return;
    this._rafId = requestAnimationFrame(ts => {
      const delta = Math.min((ts - this._lastTime) / 1000, 0.1);
      this._lastTime = ts;
      this.update(delta);
      this._loop();
    });
  }

  // ── メインアップデートルーチン ────────────────────────
  /**
   * 更新順序（依存関係を解決）:
   *   1. species.update  → writeout（死による情報還流）
   *   2. body.setPhi     → Φ更新
   *   3. body.update     → マントル・Strain計算
   *   4. climate.update  → 地表温度・天候変換
   *   5. _updatePhase    → フェーズ遷移判定
   */
  update(delta) {
    if (!this.active) return;

    // A. 時間進行
    this.time       += delta;
    this.state.year += this._yearScale * delta;

    // B. 前ステップのスナップショット（依存関係解決用）
    const bodySnap    = this.body.getSnapshot();
    const climateSnap = this.climate.getSnapshot();

    // C. 生命活動 → 情報還流（Death Writeout）
    //    生命の「死」が惑星の Φ を押し上げる ← Pandora核心
    const writeout = this.species.update(climateSnap, bodySnap, delta);
    this.body.setPhi(this.body.phi + writeout);

    // D. 地質層の更新（マントル・エントロピー流）
    this.body.update(delta);

    // E. 環境層の更新（地表温度・天候）
    //    地質の Strain + 生命の Drive を気候に反映
    this.climate.update(
      this.body.getSnapshot(),
      this.species.getSnapshot(),
      delta
    );

    // F. フェーズ遷移判定
    this._updatePhase(this.body.phi);

    // G. イベント検出
    this._checkEvents(bodySnap);
  }

  // ── フェーズ遷移判定 ──────────────────────────────────
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

  // ── イベント検出 ──────────────────────────────────────
  _checkEvents(prevBodySnap) {
    const body    = this.body.getSnapshot();
    const climate = this.climate.getSnapshot();
    const species = this.species.getSnapshot();

    if (body.isDischargeBlocked && !prevBodySnap.isDischargeBlocked)
      this._log('DISCHARGE_BLOCKED', 'Strain > discharge band × 2', 'warn');

    if (climate.weatherEvent)
      this._log('WEATHER', climate.weatherEvent, 'info');

    if (species.isExtinct) {
      this._log('EXTINCTION', species.extinctionCause, 'critical');
      this.stop();
    }
  }

  // ── ログ ──────────────────────────────────────────────
  _log(type, message, level = 'info') {
    this.eventLog.push({
      time:    +this.time.toFixed(2),
      year:    Math.round(this.state.year / 1_000_000) + 'Ma',
      type, message, level,
    });
    if (this.eventLog.length > this._maxLog) this.eventLog.shift();
  }

  // ── 全レイヤー統合スナップショット（UI / Visuals 用）─
  getFullStatus() {
    return {
      time:    +this.time.toFixed(2),
      year:    Math.round(this.state.year / 1_000_000) + 'Ma',
      phase:   this.state.phase,
      body:    this.body.getSnapshot(),
      climate: this.climate.getSnapshot(),
      species: this.species.getSnapshot(),
      active:  this.active,
      log:     [...this.eventLog].reverse(),
    };
  }
}
