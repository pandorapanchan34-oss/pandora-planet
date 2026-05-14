// ============================================================
// PANDORA EARTH — js/core/EarthBody.js
// マントル・エントロピー流・重力
//
// 北極吸収 / 南極排出の基本ロジック。
// 全惑星共通の「物理現象」。
// 惑星固有の値は config/planets/*.js から注入される。
// ============================================================

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

export class EarthBody {

  constructor(config = {}) {

    // ── 惑星固有パラメータ（config注入）──────────────────
    this.phi            = config.initialPhi    ?? PANDORA_CONST.PHI_EARTH;
    this.mantleDepth    = config.mantleDepth   ?? 2886;    // km（地球デフォルト）
    this.coreRadius     = config.coreRadius    ?? 3485;    // km
    this.surfaceArea    = config.surfaceArea   ?? 5.1e14;  // m²
    this.gravityScale   = config.gravityScale  ?? 1.0;     // 地球=1.0

    // ── 状態変数 ──────────────────────────────────────────
    this.strain         = 0;     // マントル歪み
    this.entropyInflow  = 0;     // 北極からの吸収フラックス
    this.entropyOutflow = 0;     // 南極への排出フラックス
    this.netEntropy     = 0;     // 正味エントロピー蓄積
    this.mantleTemp     = config.initialMantleTemp ?? 1300; // ℃
    this.phiGap         = 0;     // Φ乖離量
    this.dischargeRate  = 0;     // 放電効率

    // ── 内部 ──────────────────────────────────────────────
    this._strainHistory = [];
    this._maxHistory    = 60;
  }

  // ── 1ステップ更新 ─────────────────────────────────────
  update(delta = 1) {

    // 1. 北極からのエントロピー吸収（重力勾配）
    //    B(24.0) と現在の Φ の差分から流入量を計算
    //    重力スケールで惑星ごとに調整
    this.entropyInflow =
      PANDORA_CONST.B * (1 - this.phi) * 0.01 * this.gravityScale;

    // 2. マントル内での Strain 変換
    //    Φ が Φ_IDEAL(5/6) から乖離しているほど Strain が蓄積
    this.phiGap =
      Math.abs(this.phi - PANDORA_CONST.PHI_IDEAL);

    const rawStrain =
      (this.phiGap / PANDORA_CONST.PHI_IDEAL) * 20.0;

    // マントル深さで増幅（深いほど蓄積しやすい）
    const depthFactor =
      this.mantleDepth / 2886;  // 地球を1.0として正規化

    this.strain = rawStrain * depthFactor;

    // 3. 南極からの排出
    //    蓄積された Strain の一部が熱エントロピーとして排出
    //    放電効率は Pandora_DERIVED.DISCHARGE_BAND で制限される
    this.dischargeRate =
      Math.min(1.0, PANDORA_DERIVED.DISCHARGE_BAND / Math.max(0.1, this.strain));

    this.entropyOutflow =
      this.strain * 0.05 * this.dischargeRate;

    // 4. 正味エントロピー蓄積
    this.netEntropy =
      this.entropyInflow - this.entropyOutflow;

    // 5. マントル温度更新
    //    bgf（≈19.15℃）を基底として Strain と net エントロピーで変動
    const bgfTemp   = PANDORA_DERIVED.BGF;
    const heatGain  = this.netEntropy * 12.0;
    const heatLoss  = (this.mantleTemp - bgfTemp) * 0.002;
    this.mantleTemp += (heatGain - heatLoss) * delta;
    this.mantleTemp  = Math.max(-50, Math.min(2000, this.mantleTemp));

    // 6. 放電不足検出（V9断崖ロジック）
    //    Strain が DISCHARGE_BAND の2倍を超えると「飽和放電不能」
    this.isDischargeBlocked =
      this.strain > PANDORA_DERIVED.DISCHARGE_BAND * 2;

    // 7. 履歴記録
    this._strainHistory.push(this.strain);
    if (this._strainHistory.length > this._maxHistory) {
      this._strainHistory.shift();
    }

    return this;
  }

  // ── Φ を外部から更新（Engine.js から呼ぶ）────────────
  setPhi(phi) {
    this.phi = Math.max(0.01, Math.min(0.99, phi));
  }

  // ── スナップショット ──────────────────────────────────
  getSnapshot() {
    return {
      phi:                +this.phi.toFixed(4),
      phiGap:             +this.phiGap.toFixed(4),
      strain:             +this.strain.toFixed(4),
      entropyInflow:      +this.entropyInflow.toFixed(4),
      entropyOutflow:     +this.entropyOutflow.toFixed(4),
      netEntropy:         +this.netEntropy.toFixed(4),
      mantleTemp:         +this.mantleTemp.toFixed(2),
      dischargeRate:      +this.dischargeRate.toFixed(4),
      isDischargeBlocked: this.isDischargeBlocked,
      strainHistory:      [...this._strainHistory],
    };
  }
}
