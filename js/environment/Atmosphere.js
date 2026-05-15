/**
 * PANDORA EARTH — js/environment/Atmosphere.js
 *
 * 大気・気象・酸素濃度
 *
 * 役割：
 *   - 酸素濃度管理（植物誕生後に上昇）
 *   - 気象イベント（嵐・雷・干ばつ）
 *   - 温室効果によるbgf摩擦への影響
 *   - 大気エントロピーをEngineに渡す
 *
 * 植物との連動：
 *   植物が負エントロピーを生成 → 酸素増加
 *   酸素増加 → 動物誕生条件の一部
 */

import { convertRaw } from '../core/Entropy.js';
import { PANDORA_CONST } from '../constants.js';

const BGF = PANDORA_CONST.BGF;

// 気象イベントの閾値
const STORM_THRESHOLD   = 0.65;
const DROUGHT_THRESHOLD = 0.30;

export class Atmosphere {

    constructor(config = {}) {
        // 酸素濃度（0〜1、初期は原始大気≈0.01）
        this.oxygenLevel    = config.initialOxygen ?? 0.01;
        // CO2濃度（温室効果）
        this.co2Level       = config.initialCO2    ?? 0.8;
        // 大気圧（0〜1正規化）
        this.pressure       = config.pressure      ?? 1.0;

        // 気象状態
        this.weatherState   = 'calm'; // calm | storm | drought | lightning
        this.weatherTimer   = 0;
        this.lightningEvent = false;

        // エントロピー寄与
        this._contribution  = 0;
        this._stormIntensity = 0;
    }

    // ── 更新 ──────────────────────────────────────────────
    update(bodySnap, bioSnap, climateSnap, delta) {
        const { phi, strain }    = bodySnap;
        const { plantTriggered, plantCount = 0 } = bioSnap;
        const { surfaceTemp = 15 } = climateSnap;

        // 1. 酸素濃度更新
        //    植物誕生後：植物数に応じて増加
        //    植物なし：微量のみ（光化学反応）
        if (plantTriggered && plantCount > 0) {
            const plantBoost = (plantCount / 50) * 0.002 * delta;
            this.oxygenLevel = Math.min(0.35, this.oxygenLevel + plantBoost);
        } else {
            // 原始大気の微量酸素
            this.oxygenLevel = Math.max(0.001,
                this.oxygenLevel - 0.00005 * delta
            );
        }

        // 2. CO2濃度更新
        //    植物が吸収 → CO2減少
        //    火山活動 → CO2増加（Geosphereからは直接取らず、strainで代替）
        const co2Sink   = plantTriggered ? plantCount * 0.0001 * delta : 0;
        const co2Source = strain * 0.002 * delta;
        this.co2Level   = Math.max(0.05, Math.min(2.0,
            this.co2Level - co2Sink + co2Source
        ));

        // 3. 気象イベント
        this._updateWeather(surfaceTemp, strain, delta);

        // 4. 雷イベント（気象+酸素で原始生命誕生に影響）
        this.lightningEvent = this.weatherState === 'storm'
            && Math.random() < 0.02 * this._stormIntensity;

        // 5. 大気エントロピー（嵐・雷が主な発生源）
        const rawStorm     = this._stormIntensity * 1.8;
        const rawGreenhous = this.co2Level * 0.3;
        const raw          = rawStorm + rawGreenhous;
        this._contribution = convertRaw(raw, { phi, strain });
    }

    // ── 気象更新 ──────────────────────────────────────────
    _updateWeather(temp, strain, delta) {
        if (this.weatherTimer > 0) {
            this.weatherTimer -= delta;
            return;
        }

        // bgf摩擦 + Strainで気象確率を計算
        const bgfFriction   = Math.abs(temp - BGF) / BGF;
        const stormProb     = bgfFriction * 0.4 + strain / 20;
        const droughtProb   = Math.max(0, 0.3 - bgfFriction) * 0.3;

        const roll = Math.random();
        if (roll < stormProb && stormProb > STORM_THRESHOLD * 0.5) {
            this.weatherState    = 'storm';
            this._stormIntensity = 0.3 + Math.random() * 0.7;
            this.weatherTimer    = 30 + Math.random() * 60;
        } else if (roll < droughtProb + stormProb) {
            this.weatherState    = 'drought';
            this._stormIntensity = 0;
            this.weatherTimer    = 50 + Math.random() * 80;
        } else {
            this.weatherState    = 'calm';
            this._stormIntensity = 0;
            this.weatherTimer    = 20 + Math.random() * 40;
        }
    }

    getEntropyContribution() { return this._contribution; }

    getSnapshot() {
        return {
            oxygenLevel:    +this.oxygenLevel.toFixed(4),
            co2Level:       +this.co2Level.toFixed(3),
            pressure:       +this.pressure.toFixed(3),
            weatherState:   this.weatherState,
            stormIntensity: +this._stormIntensity.toFixed(3),
            lightningEvent: this.lightningEvent,
            contribution:   +this._contribution.toFixed(4),
        };
    }
}
