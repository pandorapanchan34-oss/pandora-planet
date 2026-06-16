/**
 * PANDORA EARTH — js/environment/Atmosphere.js
 */
import { convertRaw } from '../core/Entropy.js';
import { PANDORA_CONST } from '../constants.js';

const BGF = PANDORA_CONST.BGF;
const STORM_THRESHOLD   = 0.65;
const DROUGHT_THRESHOLD = 0.30;

export class Atmosphere {
    constructor(config = {}) {
        this.oxygenLevel    = config.initialOxygen ?? 0.01;
        this.co2Level       = config.initialCO2    ?? 0.8;
        this.pressure       = config.pressure      ?? 1.0;
        this.weatherState   = 'calm';
        this.weatherTimer   = 0;
        this.lightningEvent = false;
        this._contribution  = 0;
        this._stormIntensity = 0;
    }

    update(bodySnap, bioSnap, climateSnap, delta) {
        const { phi, strain }    = bodySnap;
        const { plantTriggered, plantCount = 0 } = bioSnap;
        const { surfaceTemp = 15 } = climateSnap;

        // 1. 酸素濃度上昇（バフ）
        if (plantTriggered && plantCount > 0) {
            const plantBoost = (plantCount / 50) * 0.005 * delta;
            this.oxygenLevel = Math.min(0.35, this.oxygenLevel + plantBoost);
        } else {
            this.oxygenLevel = Math.max(0.001, this.oxygenLevel - 0.00005 * delta);
        }

        // 2. CO2濃度更新（🌟 FIX: 植物の吸収力を大幅強化、地殻からの排出をデバフ！）
        const co2Sink   = plantTriggered ? plantCount * 0.002 * delta : 0;
        const co2Source = strain * 0.0005 * delta;
        this.co2Level   = Math.max(0.05, Math.min(2.0, this.co2Level - co2Sink + co2Source));

        this._updateWeather(surfaceTemp, strain, delta);

        this.lightningEvent = this.weatherState === 'storm' && Math.random() < 0.02 * this._stormIntensity;

        const rawStorm     = this._stormIntensity * 1.8;
        const rawGreenhous = this.co2Level * 0.3;
        this._contribution = convertRaw(rawStorm + rawGreenhous, { phi, strain });
    }

    _updateWeather(temp, strain, delta) {
        if (this.weatherTimer > 0) { this.weatherTimer -= delta; return; }
        const bgfFriction   = Math.abs(temp - BGF) / BGF;
        const stormProb     = bgfFriction * 0.4 + strain / 20;
        const droughtProb   = Math.max(0, 0.3 - bgfFriction) * 0.3;
        const roll = Math.random();
        if (roll < stormProb && stormProb > STORM_THRESHOLD * 0.5) {
            this.weatherState    = 'storm'; this._stormIntensity = 0.3 + Math.random() * 0.7; this.weatherTimer = 30 + Math.random() * 60;
        } else if (roll < droughtProb + stormProb) {
            this.weatherState    = 'drought'; this._stormIntensity = 0; this.weatherTimer = 50 + Math.random() * 80;
        } else {
            this.weatherState    = 'calm'; this._stormIntensity = 0; this.weatherTimer = 20 + Math.random() * 40;
        }
    }

    getEntropyContribution() { return this._contribution; }

    getSnapshot() {
        return { oxygenLevel: +this.oxygenLevel.toFixed(4), co2Level: +this.co2Level.toFixed(3), pressure: +this.pressure.toFixed(3), weatherState: this.weatherState, stormIntensity: +this._stormIntensity.toFixed(3), lightningEvent: this.lightningEvent, contribution: +this._contribution.toFixed(4) };
    }
}
