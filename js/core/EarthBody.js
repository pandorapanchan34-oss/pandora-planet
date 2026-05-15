// ============================================================
// PANDORA EARTH — js/core/EarthBody.js（修正版）
// ============================================================

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

const PHI_IDEAL = 0.8333;
const PHI_MAX   = 1.0000;

export class EarthBody {

  constructor(config = {}) {
    this.phi            = config.initialPhi    ?? PANDORA_CONST.PHI_EARTH;
    this.mantleDepth    = config.mantleDepth   ?? 2886;
    this.coreRadius     = config.coreRadius    ?? 3485;
    this.surfaceArea    = config.surfaceArea   ?? 5.1e14;
    this.gravityScale   = config.gravityScale  ?? 1.0;

    this.strain         = 0;
    this.entropyInflow  = 0;
    this.entropyOutflow = 0;
    this.netEntropy     = 0;
    this.mantleTemp     = config.initialMantleTemp ?? 1300;
    this.phiGap         = 0;
    this.dischargeRate  = 0;

    this._strainHistory = [];
    this._maxHistory    = 60;
  }

  update(delta = 1) {

    // Step 1: 北極エントロピー吸収（変更なし）
    this.entropyInflow =
      PANDORA_CONST.B * (1 - this.phi) * 0.01 * this.gravityScale;

    // ── Step 2: Φ×Strain 非線形相関（ここを全面改訂）────
    const depthFactor = this.mantleDepth / 2886;

    if (this.phi <= PHI_IDEAL) {
      // 【安定領域】理想値以下 → 歪みは自然減衰
      this.phiGap = PHI_IDEAL - this.phi;
      this.strain = Math.max(0, this.strain - 0.01 * delta);

    } else {
      // 【過飽和領域】0.833超 → 爆増モード
      this.phiGap = this.phi - PHI_IDEAL;
      const overflow    = (this.phi - PHI_IDEAL) / (PHI_MAX - PHI_IDEAL);
      const targetStrain = Math.pow(overflow, 2) * 10.0 * depthFactor;

      // 慣性付きで追従（衝撃感）
      this.strain += (targetStrain - this.strain) * 0.1 * delta;
    }
    // ──────────────────────────────────────────────────────

    // Step 3: 南極排出（変更なし）
    this.dischargeRate =
      Math.min(1.0, PANDORA_DERIVED.DISCHARGE_BAND / Math.max(0.1, this.strain));
    this.entropyOutflow =
      this.strain * 0.05 * this.dischargeRate;

    // Step 4-5: 正味エントロピー＋マントル温度（変更なし）
    this.netEntropy = this.entropyInflow - this.entropyOutflow;

    const bgfTemp  = PANDORA_DERIVED.BGF;
    const heatGain = this.netEntropy * 12.0;
    const heatLoss = (this.mantleTemp - bgfTemp) * 0.002;
    this.mantleTemp += (heatGain - heatLoss) * delta;
    this.mantleTemp  = Math.max(-50, Math.min(2000, this.mantleTemp));

    // Step 6: 放電飽和検出
    this.isDischargeBlocked =
      this.strain > PANDORA_DERIVED.DISCHARGE_BAND * 2;

    // Step 7: 履歴
    this._strainHistory.push(this.strain);
    if (this._strainHistory.length > this._maxHistory)
      this._strainHistory.shift();

    return this;
  }

  // リミッター解放（0.99→1.05）
  setPhi(phi) {
    this.phi = Math.max(0.01, Math.min(1.05, phi));
  }

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
