// ============================================================
// PANDORA EARTH — js/environment/Climate.js
// 地表シミュレーター
//
// Physics層（EarthBody）からの Strain を受け取り、
// 温度・天候・気候安定度に変換する。
// Species（生命・文明）の Drive による温室効果も統合。
// ============================================================

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

export class ClimateSystem {

  constructor(config = {}) {

    // ── 初期状態 ──────────────────────────────────────────
    this.surfaceTemp = config.initialTemp ?? PANDORA_DERIVED.BGF; // ≈19.15℃
    this.albedo      = config.initialAlbedo     ?? 0.3;   // 反射率
    this.greenhouse  = 1.0;                               // 温室効果係数
    this.humidity    = 0.5;                               // 湿度
    this.stability   = 1.0;                               // 気候安定度（0〜1）

    // ── 惑星固有設定 ──────────────────────────────────────
    this.inertia     = config.inertia           ?? 0.01;  // 温度変化の慣性
    this.mantleScale = config.mantleScale       ?? 5.0;   // マントル熱→地表の変換係数
    this.driveScale  = config.driveScale        ?? 2.5;   // Drive→温室効果の係数

    // ── 気象イベント ──────────────────────────────────────
    this.weatherEvent  = null;    // 現在の気象イベント
    this._eventCooldown = 0;

    // ── 履歴 ──────────────────────────────────────────────
    this._tempHistory  = [];
    this._maxHistory   = 60;
  }

  // ── 1ステップ更新 ─────────────────────────────────────
  /**
   * @param {object} bodySnapshot  EarthBody.getSnapshot()
   * @param {object} speciesState  Species からの状態 { drive, population, techLevel }
   * @param {number} delta         時間スケール
   */
  update(bodySnapshot, speciesState = { drive: 0 }, delta = 1) {

    const {
      phi, phiGap,
      mantleTemp,
      entropyInflow, entropyOutflow,
      isDischargeBlocked,
      strain,
    } = bodySnapshot;

    const bgf = PANDORA_DERIVED.BGF; // ≈19.15

    // 1. 基本熱収支
    //    マントルからの伝熱 + エントロピー流の差分による表面加熱
    const thermalStress =
      (mantleTemp / 1300) * this.mantleScale;

    const flowStress =
      (entropyOutflow - entropyInflow) * 10.0;

    // 2. 文明負荷（Drive）による温室効果
    //    Drive が増えると温室効果係数が上昇
    //    → BGF(19.15) からの乖離を加速
    this.greenhouse =
      1.0 + (speciesState.drive ?? 0) * this.driveScale;

    // 3. 目標温度の算出
    //    Φ が理想値（5/6）に近いほど BGF に収束しようとする
    //    → Φ収束力（phiAlignment）が自己整合性として働く
    const phiAlignment =
      1.0 - Math.min(1.0, phiGap * 2.0);

    const targetTemp =
      bgf * phiAlignment                          // Φ収束引力
      + (thermalStress + flowStress) * this.greenhouse  // 熱収支
      + strain * 0.15;                            // Strainによる直接加熱

    // 4. 温度更新（慣性を持たせる）
    this.surfaceTemp +=
      (targetTemp - this.surfaceTemp) * this.inertia * delta;
    this.surfaceTemp =
      Math.max(-90, Math.min(100, this.surfaceTemp));

    // 5. 気候安定度
    //    排出ブロック（V9断崖）が発生していると安定度が激減
    if (isDischargeBlocked) {
      this.stability *= 0.95;
    } else {
      this.stability = Math.min(1.0, this.stability + 0.005 * delta);
    }

    // 6. 湿度とアルベドのフィードバック
    this.humidity = Math.max(0, Math.min(1.0,
      (this.surfaceTemp / 40) * this.stability
    ));

    // アルベド：高温→雲増加→冷却試行 / 低温→氷床→さらに冷却
    if (this.surfaceTemp > 35) {
      this.albedo = 0.4;   // 雲アルベド上昇
    } else if (this.surfaceTemp < 0) {
      this.albedo = 0.8;   // 氷床アルベド
    } else {
      this.albedo = 0.3;   // 通常
    }

    // 7. 気象イベント生成
    //    安定度が低い + Strain高 → 異常気象フラグ
    this._updateWeatherEvent(strain, this.stability);

    // 8. 履歴
    this._tempHistory.push(+this.surfaceTemp.toFixed(2));
    if (this._tempHistory.length > this._maxHistory) {
      this._tempHistory.shift();
    }

    return this;
  }

  // ── 気象イベント判定 ─────────────────────────────────
  _updateWeatherEvent(strain, stability) {

    if (this._eventCooldown > 0) {
      this._eventCooldown--;
      return;
    }

    const risk = (strain / PANDORA_CONST.PHASE.CRITICAL)
               * (1 - stability);

    if (risk > 0.7) {
      this.weatherEvent  = 'EXTREME_STORM';
      this._eventCooldown = 20;
    } else if (risk > 0.4) {
      this.weatherEvent  = 'HEAVY_RAIN';
      this._eventCooldown = 10;
    } else if (this.surfaceTemp < -5) {
      this.weatherEvent  = 'BLIZZARD';
      this._eventCooldown = 15;
    } else if (this.surfaceTemp > 40) {
      this.weatherEvent  = 'HEATWAVE';
      this._eventCooldown = 10;
    } else {
      this.weatherEvent  = null;
    }
  }

  // ── スナップショット ──────────────────────────────────
  getSnapshot() {
    return {
      surfaceTemp:  +this.surfaceTemp.toFixed(2),
      stability:    +this.stability.toFixed(3),
      humidity:     +this.humidity.toFixed(3),
      albedo:       +this.albedo.toFixed(2),
      greenhouse:   +this.greenhouse.toFixed(3),
      weatherEvent: this.weatherEvent,
      isExtreme:    this.surfaceTemp > 45 || this.surfaceTemp < -10,
      tempHistory:  [...this._tempHistory],
    };
  }
}
