import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

const STRAIN_RELEASE_MAX   = 10.0;
const STRAIN_RELEASE_MINOR = 7.0;
const STABILITY_PERIOD     = 300;

export class EarthBody {
    constructor(config = {}) {
        this.phi          = config.initialPhi       ?? PANDORA_CONST.PHI_EARTH;
        this.mantleDepth  = config.mantleDepth      ?? 2886;
        this.coreRadius   = config.coreRadius       ?? 3485;
        this.surfaceArea  = config.surfaceArea      ?? 5.1e14;
        this.gravityScale = config.gravityScale     ?? 1.0;

        this.strain           = 0;
        this.entropyInflow    = 0;
        this.entropyOutflow   = 0;
        this.netEntropy       = 0;
        this.mantleTemp       = config.initialMantleTemp ?? 1300;
        this.phiGap           = 0;
        this.dischargeRate    = 0;
        this.isDischargeBlocked = false;

        this.releaseEvent     = null;
        this.releaseCount     = 0;
        this.stabilityTimer   = 0;
        this.inStabilityPeriod = false;

        this._pendingEntropy  = 0;
        this._strainHistory   = [];
        this._maxHistory      = 60;
    }

    update(delta = 1) {
        if (this.inStabilityPeriod) {
            this.stabilityTimer -= delta;
            if (this.stabilityTimer <= 0) this.inStabilityPeriod = false;
        }

        this.entropyInflow = PANDORA_CONST.B * (1 - this.phi) * 0.01 * this.gravityScale;
        this.phi = Math.min(1.05, this.phi + this.entropyInflow * 0.0002 * delta);

        const PHI_IDEAL = PANDORA_CONST.PHI_IDEAL;
        const PHI_MAX   = 1.0;
        const depthFactor = this.mantleDepth / 2886;
        this.phiGap = Math.abs(this.phi - PHI_IDEAL);

        if (this.phi <= PHI_IDEAL) {
            this.strain = Math.max(0, this.strain - 0.01 * delta);
        } else {
            const overflow     = (this.phi - PHI_IDEAL) / (PHI_MAX - PHI_IDEAL);
            const targetStrain = Math.pow(overflow, 2) * 10.0 * depthFactor;
            // 🌟 爆発防止スタビライザー！
            const lerp = Math.min(1.0, 0.1 * delta);
            this.strain += (targetStrain - this.strain) * lerp;
        }
        this.strain = Math.max(0, Math.min(10.0, this.strain));

        this.dischargeRate = Math.min(1.0, PANDORA_DERIVED.DISCHARGE_BAND / Math.max(0.1, this.strain));
        this.entropyOutflow = this.strain * 0.05 * this.dischargeRate;
        this.netEntropy = this.entropyInflow - this.entropyOutflow;

        const bgfTemp  = PANDORA_DERIVED.BGF;
        const heatGain = this.netEntropy * 12.0;
        const heatLoss = (this.mantleTemp - bgfTemp) * 0.002;
        // 🌟 爆発防止スタビライザー！
        const tempLerp = Math.min(1.0, delta);
        this.mantleTemp += (heatGain - heatLoss) * tempLerp;
        this.mantleTemp  = Math.max(-50, Math.min(2000, this.mantleTemp));

        this.isDischargeBlocked = this.strain > PANDORA_DERIVED.DISCHARGE_BAND * 2;
        this.releaseEvent = this._checkStrainRelease();

        this._strainHistory.push(+this.strain.toFixed(3));
        if (this._strainHistory.length > this._maxHistory) this._strainHistory.shift();

        return this;
    }

    _checkStrainRelease() {
        if (this.inStabilityPeriod) return null;
        if (this.strain >= STRAIN_RELEASE_MAX) {
            this._executeRelease('cascade', 0.85);
            return 'cascade';
        }
        if (this.strain >= STRAIN_RELEASE_MINOR) {
            this._executeRelease('minor', 0.35);
            return 'minor';
        }
        return null;
    }

    _executeRelease(type, reduction) {
        this.releaseCount++;
        const phiRebound = type === 'cascade' ? 0.03 : 0.008;
        this.phi = Math.max(0.01, this.phi - phiRebound);
        this.mantleTemp += type === 'cascade' ? 150 : 40;
        this.inStabilityPeriod = true;
        this.stabilityTimer    = type === 'cascade' ? STABILITY_PERIOD : Math.floor(STABILITY_PERIOD * 0.3);
    }

    applyEntropy(entropyDelta) {
        if (isNaN(entropyDelta) || !isFinite(entropyDelta) || entropyDelta === 0) return;
        const phiDelta = -entropyDelta * 0.0005;
        this.phi = Math.max(0.01, Math.min(1.05, this.phi + phiDelta));
    }

    setPhi(phi) {
        if (isNaN(phi) || !isFinite(phi)) return;
        this.phi = Math.max(0.01, Math.min(1.05, phi));
    }

    get stability() {
        if (this.inStabilityPeriod) return 1.0;
        return Math.max(0, 1 - this.strain / STRAIN_RELEASE_MAX);
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
            stability:          +this.stability.toFixed(3),
            releaseEvent:       this.releaseEvent,
            releaseCount:       this.releaseCount,
            inStabilityPeriod:  this.inStabilityPeriod,
            stabilityTimer:     this.stabilityTimer,
            bgf:                PANDORA_DERIVED.BGF ?? 19.15,
        };
    }
}
