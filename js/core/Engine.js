// js/core/Engine.js
import { UNIVERSAL } from '../constants.js';
import { PLANET } from '../../config.js';

export class PandoraEngine {
    constructor() {
        this.universal = UNIVERSAL;
        this.planet = { ...PLANET };
        
        this.state = {
            phi: this.planet.initialPhi,
            strain: 4.2,
            temp: this.planet.initialTemp,
            drive: this.planet.initialDrive,
            phase: "Complex",
            biodiversity: 0.65,
            noise: this.planet.noise
        };

        this.active = false;
        this.time = 0;
    }

    update(delta = 16) {
        if (!this.active) return;

        const speed = delta / 16;

        // Φ増加（生命情報密度）
        this.state.phi += 0.0018 * speed * (1 + this.state.drive * 3);

        // Strain蓄積
        this.state.strain += 0.012 * speed + this.state.phi * 0.008;

        // Drive（文明負荷）
        this.state.drive = Math.min(0.085, this.state.drive + 0.00008 * speed);

        // 温度（bgf基準）
        const bgfTemp = this.universal.bgf;
        const heating = this.state.phi * 2.8 + this.state.drive * 18;
        const cooling = (this.state.temp - bgfTemp) * 0.045;
        this.state.temp += (heating - cooling) * 0.018 * speed;

        // Phase遷移
        const ratio = this.state.phi / this.universal.PHI_CRITICAL;
        if (ratio > 1.05 && this.state.phase === "Complex") {
            this.state.phase = "Sapient";
        }
        if (ratio > 1.35) {
            this.state.phase = "Post-Singularity";
        }

        // Strain Release Event
        if (this.state.strain > 18 && Math.random() < 0.025) {
            this.state.strain *= 0.48;
            this.state.temp -= 7.5;
            this.state.phi *= 0.93;
            window.addLog("MAJOR STRAIN RELEASE (Extinction / Reboot)");
        }

        // 自然減衰
        this.state.strain = Math.max(1.5, this.state.strain * 0.995);
    }

    getState() {
        return { ...this.state, bgf: this.universal.bgf };
    }
}
