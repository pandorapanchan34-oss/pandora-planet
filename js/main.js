// js/core/Engine.js
import { PLANET } from '../../config.js';

export class PandoraEngine {
    constructor() {
        this.active = false;
        // 宇宙定数と惑星の初期状態
        this.universal = {
            bgf: 19.15,
            B: 24,
            convergence: 3
        };
        
        this.state = {
            phi: 0.420,
            strain: 1.80,
            temp: 18.0,
            drive: 0.034,
            phase: "Pre-Biotic"
        };
    }

    update(delta) {
        if (!this.active) return;

        // デルタ時間に基づいた物理演算
        // 1. Φ (Density) の推移: 有限帯域 B の影響を受ける
        const growthRate = 0.0001 * (this.universal.B / 24) * delta;
        this.state.phi = Math.min(this.universal.convergence, this.state.phi + growthRate);

        // 2. Strain (歪み) の計算: n=3 への収束過程で発生する摩擦
        this.state.strain = 1.6 + (this.state.phi * 2.1) + Math.sin(Date.now() * 0.001) * 0.5;

        // 3. Drive (推進力) と温度の相関
        this.state.drive = Math.max(0, (this.state.phi * 0.08) - (this.state.strain * 0.01));
        this.state.temp = 12 + (this.state.phi * 18) + (this.state.drive * 5);

        // 4. フェーズ遷移判定
        this.checkPhase();
    }

    checkPhase() {
        if (this.state.phi > 1.4) {
            this.state.phase = "Sapient";
        } else if (this.state.phi > 0.85) {
            this.state.phase = "Cambrian";
        }
    }

    getState() {
        return { ...this.state };
    }
}
