/**
 * PANDORA EARTH — js/environment/Hydrosphere.js
 *
 * 水圏・海洋・水循環
 *
 * 役割：
 *   - 海洋面積・深度管理
 *   - 水循環によるエントロピー輸送
 *   - 海洋温度（bgf摩擦の緩衝材）
 *   - 海洋エントロピーをEngineに渡す
 *
 * Pandora Theory との関係：
 *   水は「情報の輸送媒体」として機能する。
 *   海洋面積が大きいほどエントロピーの拡散が速く、
 *   局所的な過飽和を和らげる緩衝効果を持つ。
 */

import { convertRaw } from '../core/Entropy.js';
import { PANDORA_CONST } from '../constants.js';

const BGF = PANDORA_CONST.BGF;

// 海洋の熱容量（大きいほど温度変化が遅い）
const OCEAN_HEAT_CAPACITY = 4.2;
// 蒸発・降水サイクル
const WATER_CYCLE_PERIOD  = 500;

export class Hydrosphere {

    constructor(config = {}) {
        // 海洋カバー率（0〜1、地球≈0.71）
        this.oceanCoverage  = config.oceanCoverage  ?? 0.71;
        // 海洋温度
        this.oceanTemp      = config.initialOceanTemp ?? 18.0;
        // 水循環強度（0〜1）
        this.cycleIntensity = 0.5;
        this._cyclePhase    = 0;

        // 酸性度（CO2吸収で変化）
        this.pH             = config.initialPH ?? 8.1;

        // 氷冠（高緯度、将来用）
        this.iceCap         = config.initialIceCap ?? 0.1;

        // エントロピー寄与
        this._contribution  = 0;

        // 緩衝効果（エントロピー吸収量）
        this.bufferEffect   = 0;
    }

    // ── 更新 ──────────────────────────────────────────────
    update(bodySnap, bioSnap, climateSnap, delta) {
        const { phi, strain, mantleTemp } = bodySnap;
        const { surfaceTemp = 15 }        = climateSnap;
        const { co2Level = 0.4 }          = bioSnap; // Atmosphereから将来受け取る

        // 1. 海洋温度更新（熱容量で緩やかに変化）
        const targetTemp = surfaceTemp * 0.8 + mantleTemp * 0.001;
        const heatDelta  = (targetTemp - this.oceanTemp) / OCEAN_HEAT_CAPACITY;
        this.oceanTemp  += heatDelta * delta * 0.1;
        this.oceanTemp   = Math.max(-2, Math.min(40, this.oceanTemp));

        // 2. 水循環サイクル
        this._cyclePhase    = (this._cyclePhase + delta / WATER_CYCLE_PERIOD) % 1;
        this.cycleIntensity = 0.4 + 0.6 * Math.abs(Math.sin(this._cyclePhase * Math.PI));

        // 3. pH更新（CO2吸収で酸性化）
        const co2Absorption = (co2Level - 0.4) * 0.01 * delta;
        this.pH = Math.max(7.0, Math.min(9.0, this.pH - co2Absorption));

        // 4. 氷冠（海洋温度で変化）
        const iceTarget = this.oceanTemp < 5  ? 0.3
                        : this.oceanTemp > 20 ? 0.02
                        : 0.1;
        this.iceCap += (iceTarget - this.iceCap) * 0.001 * delta;

        // 5. 緩衝効果
        //    海洋面積が大きく・循環が活発なほどエントロピーを吸収
        this.bufferEffect = this.oceanCoverage * this.cycleIntensity * 0.4;

        // 6. 海洋エントロピー
        //    bgf摩擦（海洋温度とbgfの乖離）
        const bgfFriction  = Math.abs(this.oceanTemp - BGF) / BGF;
        const rawThermal   = bgfFriction * this.cycleIntensity * 1.5;
        const rawAcid      = Math.max(0, 8.1 - this.pH) * 0.5; // 酸性化ストレス
        const raw          = Math.max(0, rawThermal + rawAcid - this.bufferEffect);
        this._contribution = convertRaw(raw, { phi, strain });
    }

    getEntropyContribution() { return this._contribution; }

    getSnapshot() {
        return {
            oceanCoverage:  +this.oceanCoverage.toFixed(3),
            oceanTemp:      +this.oceanTemp.toFixed(2),
            cycleIntensity: +this.cycleIntensity.toFixed(3),
            pH:             +this.pH.toFixed(2),
            iceCap:         +this.iceCap.toFixed(3),
            bufferEffect:   +this.bufferEffect.toFixed(3),
            contribution:   +this._contribution.toFixed(4),
        };
    }
}
