// ============================================================
// PANDORA EARTH — js/core/Engine.js
// 統合オーケストレーター（因果律管理版）
// ============================================================

import { PANDORA_CONST } from '../constants.js';
import { EarthBody }     from './EarthBody.js';
import { Biosphere }     from './Biosphere.js';
import { ClimateSystem } from '../environment/Climate.js';
import { Events, EVENT, HistoryManager } from './Events.js';

export class PandoraEngine {

  constructor(planetConfig = {}) {
    this.active = false;
    this.time   = 0;

    // ── 各レイヤーのインスタンス化（独立性を維持） ──────────
    this.body      = new EarthBody(planetConfig);
    this.biosphere = new Biosphere();
    this.climate   = new ClimateSystem(planetConfig);

    // ── 統合状態 ──────────────────────────────────────
    this.state = {
      year:      planetConfig.startYear ?? -800_000_000,
      phase:     'Pre-Biotic',
      prevPhase: null,
    };

    this.eventLog   = [];
    this._maxLog    = 100;
    this._yearScale = planetConfig.yearScale ?? 1000;

    this._initGlobalListeners();
  }

  _initGlobalListeners() {
    // 特異点（ブラックホール）到達時の全停止
    Events.on(EVENT.BLACK_HOLE, (payload) => {
      this._log('SINGULARITY', payload.message, 'critical');
      this.stop();
    });
  }

  start() { this.active = true; }
  stop()  { this.active = false; }

  reset(planetConfig = {}) {
    this.stop();
    // 既存のリスナーをクリアして再生成
    Events.clear();
    Object.assign(this, new PandoraEngine(planetConfig));
  }

  /**
   * メインアップデートルーチン
   * 因果の流れ： 生命(Entropy消費) → 物理(Φ変動/Strain積算) → 衝撃検知 → 生命反映
   */
  update(delta) {
    if (!this.active) return;

    // A. 時間進行
    this.time       += delta;
    this.state.year += this._yearScale * delta;

    // B. 事前状態のキャプチャ（因果計算用）
    const oldStrain = this.body.strain;
    const bodySnap  = this.body.getSnapshot();
    const climSnap  = this.climate.getSnapshot();

    // C. Biosphereの更新（生命活動の計算）
    //    冷却効果(entropyDelta)と死による還流(writeout)を取得
    const bioResult = this.biosphere.update(bodySnap, climSnap, delta);

    // D. 物理層（EarthBody）へのフィードバック
    //    生命によるΦの直接操作
    this.body.setPhi(this.body.phi + bioResult.entropyDelta + bioResult.writeout);

    // E. 物理層の更新（Strainの計算）
    this.body.update(delta);

    // ── ⚡ 因果の翻訳（Engine Logic Hub） ────────────────
    const currentStrain = this.body.strain;
    const strainRelease = oldStrain - currentStrain;

    // 物理的なStrain解放（地震等）を生命への「物理的衝撃」として伝える
    if (strainRelease > 0.1) {
      this.biosphere.onPhysicalShock(strainRelease);
      this._log('GEOLOGICAL', `Crustal Shift: ${strainRelease.toFixed(2)}`, 'info');
    }
    // ──────────────────────────────────────────────────

    // F. 環境層の更新
    this.climate.update(this.body.getSnapshot(), bioResult, delta);

    // G. 臨界監視（HistoryManagerによる一元チェック）
    HistoryManager.checkCriticalStates(this);

    // H. フェーズ遷移判定
    this._updatePhase(this.body.phi);
  }

  // ── フェーズ遷移判定 ──────────────────────────────────
  _updatePhase(phi) {
    let next = 'Pre-Biotic';
    if (this.body.isBlackHole) next = 'Singularity';
    else if (phi > 0.90)       next = 'Synchronized';
    else if (phi > 0.70)       next = 'Primordial';

    if (next !== this.state.phase) {
      this._log('PHASE', `${this.state.phase} → ${next}`, 'phase');
      this.state.prevPhase = this.state.phase;
      this.state.phase     = next;
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
    const bodySnap = this.body.getSnapshot();
    return {
      engine: {
        year:  Math.round(this.state.year / 1_000_000) + 'Ma',
        phase: this.state.phase,
        active: this.active
      },
      body:    bodySnap,
      bio:     this.biosphere.getSnapshot(),
      climate: this.climate.getSnapshot(),
      log:     [...this.eventLog].reverse(),
    };
  }
}
