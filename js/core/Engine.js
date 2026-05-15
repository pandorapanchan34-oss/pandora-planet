// ============================================================
// PANDORA EARTH — js/core/Engine.js
// オーケストレーター（統合版）
// ============================================================

import { PANDORA_CONST } from '../constants.js';
import { Events, EVENT, HistoryManager } from './Events.js';
import { EarthBody }     from './EarthBody.js';
import { Biosphere }     from './Biosphere.js';
import { ClimateSystem } from '../environment/Climate.js';
import { Species }       from '../plugins/Species.js';

export class PandoraEngine {

  constructor(planetConfig = {}) {
    this.active = false;
    this.time   = 0;

    // ── 各レイヤーのインスタンス化 ────────────────────────
    // 物理：地殻・歪み・Φ管理
    this.body = new EarthBody(planetConfig);

    // 生命：個体管理・エントロピー冷却
    this.biosphere = new Biosphere();

    // 環境：気候・温度（EarthBodyのスナップショットに依存）
    this.climate = new ClimateSystem(planetConfig);

    // ── 統合状態 ──────────────────────────────────────
    this.state = {
      year:      planetConfig.startYear ?? -800_000_000,
      phase:     'Pre-Biotic',
      prevPhase: null,
    };

    this.eventLog = [];
    this._maxLog  = 100;
    this._yearScale = 1000; // 1秒あたりの経過年数

    // ── グローバルイベントの購読 ────────────────────────
    this._initGlobalListeners();
  }

  _initGlobalListeners() {
    // ブラックホール化イベント受信時：システム全停止
    Events.on(EVENT.BLACK_HOLE, (payload) => {
      this._log('SINGULARITY', payload.message, 'critical');
      this.stop();
      // Biosphere側でもデータ破棄等の処理が必要ならここで呼ぶ
    });
  }

  start() {
    this.active = true;
    this._log('SYSTEM', 'Engine started.', 'info');
  }

  stop() {
    this.active = false;
    this._log('SYSTEM', 'Engine stopped.', 'warn');
  }

  /**
   * メインアップデートループ (main.js から呼ばれる)
   * @param {number} delta - 前フレームからの経過時間
   */
  update(delta) {
    if (!this.active) return;

    // 1. 時間の進行
    this.time += delta;
    this.state.year += this._yearScale * delta;

    // 2. 各層のスナップショット取得（計算用）
    const bodySnap    = this.body.getSnapshot();
    const climateSnap = this.climate.getSnapshot();

    // 3. Biosphere（生命圏）の更新
    //    物理・環境状態を受け取り、エントロピーの変動(delta)と
    //    個体の死による情報還流(writeout)を算出する
    const bioResult = this.biosphere.update(bodySnap, climateSnap, delta);

    // 4. EarthBody（物理層）へのフィードバック
    //    生命活動による「冷却」と「還流」を Φ に反映
    const nextPhi = this.body.phi + bioResult.entropyDelta + bioResult.writeout;
    this.body.setPhi(nextPhi);

    // 5. 物理層の内的更新（Strainの蓄積・解放、Φの境界チェック）
    this.body.update(delta);

    // 6. 環境層の更新（新しい物理状態を反映）
    this.climate.update(this.body.getSnapshot(), bioResult, delta);

    // 7. 臨界状態の監視 (HistoryManagerによる一元監視)
    //    内部で EVENT.BLACK_HOLE や EVENT.STRAIN_CRITICAL を発行
    HistoryManager.checkCriticalStates(this);

    // 8. フェーズ遷移管理
    this._updatePhase(this.body.phi);
  }

  // ── フェーズ遷移判定 ──────────────────────────────────
  _updatePhase(phi) {
    let next = 'Pre-Biotic';
    if (phi > 0.6)  next = 'Primordial';
    if (phi > 0.8)  next = 'Synchronized';
    if (phi > 0.95) next = 'Unstable';
    if (this.body.isBlackHole) next = 'Singularity';

    if (next !== this.state.phase) {
      this._log('PHASE', `${this.state.phase} → ${next}`, 'phase');
      this.state.prevPhase = this.state.phase;
      this.state.phase     = next;
    }
  }

  // ── ログ出力 ──────────────────────────────────────────
  _log(type, message, level = 'info') {
    const entry = {
      time:  +this.time.toFixed(2),
      year:  Math.round(this.state.year / 1_000_000) + 'Ma',
      type, message, level,
    };
    this.eventLog.push(entry);
    if (this.eventLog.length > this._maxLog) this.eventLog.shift();
    
    // 開発用コンソール出力
    if (level === 'critical') console.error(`[${type}] ${message}`);
  }

  /**
   * 全レイヤーの統合状態取得（UI / Visuals 用）
   */
  getFullStatus() {
    return {
      engine: {
        time:  +this.time.toFixed(2),
        year:  this.state.year,
        phase: this.state.phase,
        active: this.active
      },
      body:    this.body.getSnapshot(),
      bio:     this.biosphere.getSnapshot(),
      climate: this.climate.getSnapshot(),
      events:  [...this.eventLog].reverse()
    };
  }
}
