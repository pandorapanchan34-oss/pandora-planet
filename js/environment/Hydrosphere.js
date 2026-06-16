import { convertRaw } from '../core/Entropy.js';
import { PANDORA_CONST } from '../constants.js';

const BGF = PANDORA_CONST.BGF;
const OCEAN_HEAT_CAPACITY = 4.2;
const WATER_CYCLE_PERIOD  = 500;

export class Hydrosphere {
    constructor(config = {}) {
        this.oceanCoverage  = config.oceanCoverage  ?? 0.71;
        this.oceanTemp      = config.initialOceanTemp ?? 18.0;
        this.cycleIntensity = 0.5;
        this._cyclePhase    = 0;
        this.pH             = config.initialPH ?? 8.1;
        this.iceCap         = config.initialIceCap ?? 0.1;
        this._contribution  = 0;
        this.bufferEffect   = 0;
    }

    update(bodySnap, bioSnap, climateSnap, delta) {
        const { phi, strain, mantleTemp } = bodySnap;
        const { surfaceTemp = 15 }        = climateSnap;
        const { co2Level = 0.4 }          = bioSnap; 

        // 1. 海洋温度更新（熱容量で緩やかに変化）
        // 🌟 【時空加速スタビライザー】海洋温度の爆発（NaN化）を防ぐ
        const targetTemp = surfaceTemp * 0.8 + mantleTemp * 0.001;
        const lerp  = Math.min(1.0, (0.1 / OCEAN_HEAT_CAPACITY) * delta);
        this.oceanTemp  += (targetTemp - this.oceanTemp) * lerp;
        this.oceanTemp   = Math.max(-2, Math.min(40, this.oceanTemp));

        this._cyclePhase    = (this._cyclePhase + delta / WATER_CYCLE_PERIOD) % 1;
        this.cycleIntensity = 0.4 + 0.6 * Math.abs(Math.sin(this._cyclePhase * Math.PI));

        const co2Absorption = (co2Level - 0.4) * 0.01 * delta;
        this.pH = Math.max(7.0, Math.min(9.0, this.pH - co2Absorption));

        const iceTarget = this.oceanTemp < 5 ? 0.3 : this.oceanTemp > 20 ? 0.02 : 0.1;
        this.iceCap += (iceTarget - this.iceCap) * Math.min(1.0, 0.001 * delta);

        this.bufferEffect = this.oceanCoverage * this.cycleIntensity * 0.4;

        const bgfFriction  = Math.abs(this.oceanTemp - BGF) / BGF;
        const rawThermal   = bgfFriction * this.cycleIntensity * 1.5;
        const rawAcid      = Math.max(0, 8.1 - this.pH) * 0.5;
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
