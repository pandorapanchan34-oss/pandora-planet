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
    // ── 惑星固有パラメータ ──────────────────
    this.phi            = config.initialPhi    ?? PANDORA_CONST.PHI_EARTH;
    this.mantleDepth    = config.mantleDepth   ?? 2886;
    this.coreRadius     = config.coreRadius    ?? 3485;
    this.surfaceArea    = config.surfaceArea   ?? 5.1e14;
    this.gravityScale   = config.gravityScale  ?? 1.0;

    // ── 状態変数 ──────────────────────────
    this.strain         = 0;
    this.entropyInflow  = 0;
    this.entropyOutflow = 0;
    this.netEntropy     = 0;
    this.mantleTemp     = config.initialMantleTemp ?? 1300;
    this.phiGap         = 0;
    this.dischargeRate  = 0;
    this.isDischargeBlocked = false;

    // ── 内部高速化用 ────────────────────────
    this._maxHistory    = 60;
    // 指摘3: shift()回避のための循環バッファ
    this._strainHistory = new Float32Array(this._maxHistory); 
    this._historyIdx    = 0;

    // 指摘1 & 2: スナップショット用の固定メモリ（プール）
    this._snapshot = {
      phi: 0, phiGap: 0, strain: 0, entropyInflow: 0,
      entropyOutflow: 0, netEntropy: 0, mantleTemp: 0,
      dischargeRate: 0, isDischargeBlocked: false,
      strainHistory: this._strainHistory // 参照のみ渡す
    };

    // 指摘6: 事前計算可能な定数
    this._depthFactor = this.mantleDepth / 2886;
  }

  update(delta = 1) {
    // 1. 北極からのエントロピー吸収
    this.entropyInflow = PANDORA_CONST.B * (1 - this.phi) * 0.01 * this.gravityScale;

    // 2. マントル内での Strain 変換
    this.phiGap = Math.abs(this.phi - PANDORA_CONST.PHI_IDEAL);
    const rawStrain = (this.phiGap / PANDORA_CONST.PHI_IDEAL) * 20.0;
    this.strain = rawStrain * this._depthFactor;

    // 3. 南極からの排出
    this.dischargeRate = Math.min(1.0, PANDORA_DERIVED.DISCHARGE_BAND / Math.max(0.1, this.strain));
    this.entropyOutflow = this.strain * 0.05 * this.dischargeRate;

    // 4. 正味エントロピー
    this.netEntropy = this.entropyInflow - this.entropyOutflow;

    // 5. 温度更新
    const heatGain = this.netEntropy * 12.0;
    const heatLoss = (this.mantleTemp - PANDORA_DERIVED.BGF) * 0.002;
    this.mantleTemp += (heatGain - heatLoss) * delta;
    this.mantleTemp = Math.max(-50, Math.min(2000, this.mantleTemp));

    // 6. 放電不足検出
    this.isDischargeBlocked = this.strain > PANDORA_DERIVED.DISCHARGE_BAND * 2;

    // 7. 履歴記録（循環バッファ: shift()を使わずO(1)で書き込み）
    this._strainHistory[this._historyIdx] = this.strain;
    this._historyIdx = (this._historyIdx + 1) % this._maxHistory;

    return this;
  }

  setPhi(phi) {
    this.phi = Math.max(0.01, Math.min(0.99, phi));
  }

  /**
   * 【Q.E.D.】最適化済みスナップショット
   * 指摘1, 4を解消。新しいオブジェクトを作らず、文字列変換もしない。
   */
  getSnapshot() {
    const s = this._snapshot;
    s.phi                = this.phi;
    s.phiGap             = this.phiGap;
    s.strain             = this.strain;
    s.entropyInflow      = this.entropyInflow;
    s.entropyOutflow     = this.entropyOutflow;
    s.netEntropy         = this.netEntropy;
    s.mantleTemp         = this.mantleTemp;
    s.dischargeRate      = this.dischargeRate;
    s.isDischargeBlocked = this.isDischargeBlocked;
    // strainHistory はコンストラクタで渡した参照がそのまま使える
    return s;
  }
}
