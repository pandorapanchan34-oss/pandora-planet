import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

export class ClimateSystem {
    constructor(config = {}) {
        this.surfaceTemp  = config.initialTemp   ?? PANDORA_DERIVED.BGF;
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

    update(bodySnapshot, climateInput = {}, delta = 1) {
        const { phi, phiGap, mantleTemp, entropyInflow, entropyOutflow, isDischargeBlocked, strain } = bodySnapshot;
        const bgf = PANDORA_DERIVED.BGF;

        const co2Level    = climateInput.co2Level    ?? 0.8;
        const oxygenLevel = climateInput.oxygenLevel ?? 0.01;
        const oceanTemp   = climateInput.oceanTemp   ?? 18.0;
        const bufferEffect = climateInput.bufferEffect ?? 0.3;
        const drive        = climateInput.drive       ?? 0;

        const thermalStress = (mantleTemp / 1300) * this.mantleScale;
        const flowStress    = (entropyOutflow - entropyInflow) * 10.0;

        const co2Factor   = 1.0 + (co2Level - 0.4) * 0.8;
        const driveFactor = 1.0 + drive * this.driveScale;
        this.greenhouse   = co2Factor * driveFactor;

        const phiAlignment = 1.0 - Math.min(1.0, phiGap * 2.0);
        const oceanPull   = (oceanTemp - this.surfaceTemp) * bufferEffect * 0.3;
        const targetTemp  = bgf * phiAlignment + (thermalStress + flowStress) * this.greenhouse + strain * 0.15 + oceanPull;

        // 5. 温度更新
        // 🌟 【時空加速スタビライザー】1万倍速（x10K）での数値爆発を完全に防ぐ
        const effectiveInertia = this.inertia * (1 + bufferEffect * 2);
        const lerp = Math.min(1.0, effectiveInertia * delta);
        this.surfaceTemp += (targetTemp - this.surfaceTemp) * lerp;
        this.surfaceTemp = Math.max(-90, Math.min(100, this.surfaceTemp));

        if (isDischargeBlocked) {
            this.stability *= 0.95;
        } else {
            const oxygenBonus = Math.min(0.01, oxygenLevel * 0.02);
            this.stability = Math.min(1.0, this.stability + (0.005 + oxygenBonus) * delta);
        }

        const humidBase   = (this.surfaceTemp / 40) * this.stability;
        const humidOcean  = oceanTemp / 80;
        this.humidity     = Math.max(0, Math.min(1.0, humidBase * 0.7 + humidOcean * 0.3));

        if      (this.surfaceTemp > 35) this.albedo = 0.4;
        else if (this.surfaceTemp <  0) this.albedo = 0.8;
        else                            this.albedo = 0.3;

        this._updateWeatherEvent(strain, this.stability, co2Level);

        this._tempHistory.push(+this.surfaceTemp.toFixed(2));
        if (this._tempHistory.length > this._maxHistory) this._tempHistory.shift();

        return this;
    }

    _updateWeatherEvent(strain, stability, co2Level = 0.4) {
        if (this._eventCooldown > 0) {
            this._eventCooldown--;
            return;
        }
        const co2Risk = Math.max(0, co2Level - 0.4) * 0.3;
        const risk    = (strain / PANDORA_CONST.PHASE.CRITICAL) * (1 - stability) + co2Risk;

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
