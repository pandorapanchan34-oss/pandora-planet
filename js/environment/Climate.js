/**
 * PANDORA EARTH — js/environment/Climate.js
 *
 * 気候統合システム（三圏データ反映版）
 *
 * 変更点（旧版からの差分）：
 *   - co2Level（Atmosphere）→ 温室効果に直接反映
 *   - oxygenLevel（Atmosphere）→ 生命活性補正
 *   - oceanTemp（Hydrosphere）→ surfaceTempの緩衝材
 *   - bufferEffect（Hydrosphere）→ 温度変化の慣性に加算
 *
 * ─────────────────────────────────────────────────────
 * 更新はEngine.jsから呼ばれる。
 * Engine.update()ステップ7でclimatInputに三圏データを注入済み。
 * ─────────────────────────────────────────────────────
 */

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

export class ClimateSystem {

    constructor(config = {}) {
        this.surfaceTemp  = config.initialTemp   ?? PANDORA_DERIVED.BGF; // ≈19.15℃
        this.albedo       = config.initialAlbedo ?? 0.3;
        this.greenhouse   = 1.0;
        this.humidity     = 0.5;
        this.stability    = 1.0;

        this.inertia      = config.inertia      ?? 0.01;
        this.mantleScale  = config.mantleScale  ?? 5.0;
        this.driveScale   = config.driveScale   ?? 2.5;

        this.weatherEvent  = null;
        this._eventCooldown = 0;

        this._tempHistory  = [];
        this._maxHistory   = 60;
    }

    // ── 1ステップ更新 ─────────────────────────────────────
    /**
     * @param {object} bodySnapshot  - EarthBody.getSnapshot()
     * @param {object} climateInput  - biosphere + 三圏データ注入済み
     *   { drive, co2Level, oxygenLevel, oceanTemp, bufferEffect, ... }
     * @param {number} delta
     */
    update(bodySnapshot, climateInput = {}, delta = 1) {
        const {
            phi, phiGap,
            mantleTemp,
            entropyInflow, entropyOutflow,
            isDischargeBlocked,
            strain,
        } = bodySnapshot;

        const bgf = PANDORA_DERIVED.BGF; // ≈19.15

        // 三圏データ（注入されなければデフォルト値）
        const co2Level    = climateInput.co2Level    ?? 0.8;
        const oxygenLevel = climateInput.oxygenLevel ?? 0.01;
        const oceanTemp   = climateInput.oceanTemp   ?? 18.0;
        const bufferEffect = climateInput.bufferEffect ?? 0.3;
        const drive        = climateInput.drive       ?? 0;

        // 1. 基本熱収支
        const thermalStress = (mantleTemp / 1300) * this.mantleScale;
        const flowStress    = (entropyOutflow - entropyInflow) * 10.0;

        // 2. 温室効果
        //    旧：Drive係数のみ
        //    新：CO2濃度を直接反映（CO2が高いほど温室効果↑）
        const co2Factor   = 1.0 + (co2Level - 0.4) * 0.8; // 基準CO2=0.4
        const driveFactor = 1.0 + drive * this.driveScale;
        this.greenhouse   = co2Factor * driveFactor;

        // 3. Φ収束力
        const phiAlignment = 1.0 - Math.min(1.0, phiGap * 2.0);

        // 4. 目標温度
        //    旧：bgf収束 + 熱収支 + Strain
        //    新：海洋温度を緩衝材として加算（oceanTempが引き寄せる）
        const oceanPull   = (oceanTemp - this.surfaceTemp) * bufferEffect * 0.3;
        const targetTemp  =
            bgf * phiAlignment
            + (thermalStress + flowStress) * this.greenhouse
            + strain * 0.15
            + oceanPull; // 海洋による緩衝

        // 5. 温度更新
        //    海洋緩衝が大きいほど慣性が強くなる（変化が遅くなる）
        const effectiveInertia = this.inertia * (1 + bufferEffect * 2);
        this.surfaceTemp +=
            (targetTemp - this.surfaceTemp) * effectiveInertia * delta;
        this.surfaceTemp = Math.max(-90, Math.min(100, this.surfaceTemp));

        // 6. 気候安定度
        if (isDischargeBlocked) {
            this.stability *= 0.95;
        } else {
            // 酸素濃度が高いほど安定しやすい（植物の恩恵）
            const oxygenBonus = Math.min(0.01, oxygenLevel * 0.02);
            this.stability = Math.min(1.0,
                this.stability + (0.005 + oxygenBonus) * delta
            );
        }

        // 7. 湿度（海洋温度・安定度・酸素で補正）
        const humidBase   = (this.surfaceTemp / 40) * this.stability;
        const humidOcean  = oceanTemp / 80; // 海洋温度が高いほど蒸発↑
        this.humidity     = Math.max(0, Math.min(1.0,
            humidBase * 0.7 + humidOcean * 0.3
        ));

        // 8. アルベド
        if      (this.surfaceTemp > 35) this.albedo = 0.4;
        else if (this.surfaceTemp <  0) this.albedo = 0.8;
        else                            this.albedo = 0.3;

        // 9. 気象イベント（三圏データを加味）
        this._updateWeatherEvent(strain, this.stability, co2Level);

        // 10. 履歴
        this._tempHistory.push(+this.surfaceTemp.toFixed(2));
        if (this._tempHistory.length > this._maxHistory) {
            this._tempHistory.shift();
        }

        return this;
    }

    // ── 気象イベント ──────────────────────────────────────
    _updateWeatherEvent(strain, stability, co2Level = 0.4) {
        if (this._eventCooldown > 0) {
            this._eventCooldown--;
            return;
        }

        // CO2が高いほどリスク上昇（温暖化による気象悪化）
        const co2Risk = Math.max(0, co2Level - 0.4) * 0.3;
        const risk    = (strain / PANDORA_CONST.PHASE.CRITICAL)
                      * (1 - stability)
                      + co2Risk;

        if (risk > 0.7) {
            this.weatherEvent   = 'EXTREME_STORM';
            this._eventCooldown = 20;
        } else if (risk > 0.4) {
            this.weatherEvent   = 'HEAVY_RAIN';
            this._eventCooldown = 10;
        } else if (this.surfaceTemp < -5) {
            this.weatherEvent   = 'BLIZZARD';
            this._eventCooldown = 15;
        } else if (this.surfaceTemp > 40) {
            this.weatherEvent   = 'HEATWAVE';
            this._eventCooldown = 10;
        } else {
            this.weatherEvent   = null;
        }
    }

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
