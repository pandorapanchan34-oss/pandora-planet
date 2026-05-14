// js/core/Engine.js
import { UNIVERSAL } from '../constants.js';

export class PandoraEngine {
    constructor() {
        this.state = {
            phi: 0.82,
            strain: 4.2,
            temp: 18.8,
            drive: 0.031,
            phase: "Complex"
        };
        this.active = false;
    }

    update() {
        if (!this.active) return;

        this.state.phi += 0.0017 * (1 + this.state.drive * 4);
        this.state.strain += 0.015 + this.state.phi * 0.009;
        this.state.drive = Math.min(0.09, this.state.drive + 0.0001);

        // 温度
        this.state.temp += (this.state.phi * 2.2 - (this.state.temp - 19) * 0.05) * 0.022;

        // === Strain解放イベント（重要）===
        if (this.state.strain > 16 && Math.random() < 0.028) {
            const release = this.state.strain * 0.62;
            this.state.strain -= release;
            this.state.temp -= 8.5;
            this.state.phi *= 0.92;
            window.addLog(`MAJOR STRAIN RELEASE! (-${release.toFixed(1)})`);
        }

        // Phase
        if (this.state.phi > 1.15 && this.state.phase === "Complex") {
            this.state.phase = "Sapient";
            window.addLog("PHASE SHIFT → Sapient");

    

    // 1. 生命情報密度 Φ の更新（geo + bio + neural + tech + wo - entropy）
    // 死の回転（Lifespan）が Φ を押し上げるパンドラ特有のロジック
    const wo = this.calculateDeathWriteout(); 
    this.state.phi += (0.00012 + (this.state.drive * 0.0015) + wo) * (delta / 16);

    // 2. Strain の動的計算
    // Φc (5/6) への接近による飽和（Sat）と文明負荷（Civ）の加算
    const ratio = this.state.phi / (5/6);
    const saturation = (1 / Math.max(0.002, Math.abs(5/6 - this.state.phi))) * 0.025;
    this.state.strain = 1.5 + (ratio * 2.0) + saturation + (this.state.drive * 4.0);

    // 3. 絶滅イベント（Strain起因のランダム発火）
    this.checkExtinctionEvents();
}

        }
    }

    getState() {
        return this.state;
    }
}
