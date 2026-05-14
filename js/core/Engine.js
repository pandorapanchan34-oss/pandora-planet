import { UNIVERSAL } from '../constants.js';

export class PandoraEngine {
    constructor() {
        this.state = {
            phi: 0.42,          // 初期密度
            strain: 1.8,
            temp: 18.0,
            drive: 0.0,         // 文明負荷/Tech
            phase: "Pre-Biotic",
            biodiversity: 0.0,
            year: -800000000    // 8億年前からスタート
        };
        this.active = false;
        this.ext_cooldown = 0;
    }

    // === パンドラ理論: 死による情報の書き出し演算 ===
    calculateDeathWriteout() {
        // Φc (5/6) を基準とした zeta 係数
        const zeta = Math.max(0, (this.state.phi / (5/6)) - 1);
        // 平均寿命の逆算（B=24, TAU=0.1194）
        const lifespan = Math.max(0.5, 24 * Math.pow(1 - 0.1194, zeta) / Math.max(0.2, this.state.biodiversity * 5));
        const turnover = 1 / lifespan;
        
        // 生物多様性とターンオーバーによる密度への寄与
        return zeta * turnover * (this.state.biodiversity * 0.1) * 0.002;
    }

    update(delta = 16) {
        if (!this.active) return;

        // 1. 年月の進行（8億年の旅）
        this.state.year += 1000 * (delta / 16); 

        // 2. 生命情報密度 Φ の更新
        const wo = this.calculateDeathWriteout();
        const geo = 0.00012; // 地質学的ベース
        const entropy = this.state.phi * 0.00008;
        
        // Φ の上昇（Techや生命活動が寄与）
        this.state.phi += (geo + (this.state.biodiversity * 0.001) + (this.state.drive * 0.002) + wo - entropy) * (delta / 16);

        // 3. Strain の動的計算（Φc = 5/6 への飽和ロジック）
        const ratio = this.state.phi / (5/6);
        const prox = Math.abs(5/6 - this.state.phi);
        const saturation = (1 / Math.max(0.002, prox)) * 0.025; // 5/6に近づくと急増
        this.state.strain = 1.5 + (ratio * 2.0) + saturation + (this.state.drive * 4.0);

        // 4. 温度のホメオスタシス（19.15度への回帰）
        const targetTemp = 19.15 + (this.state.phi * 2.5) + (this.state.drive * 5);
        this.state.temp += (targetTemp - this.state.temp) * 0.005;

        // 5. 絶滅イベントのチェック
        this.checkExtinctionEvents();

        // 6. フェーズ遷移
        this.updatePhase();
    }

    checkExtinctionEvents() {
        if (this.ext_cooldown > 0) {
            this.ext_cooldown -= 1000;
            return;
        }

        const threshold = 10.0; // Strain閾値
        const excess = Math.max(0, this.state.strain - threshold);
        
        if (excess > 0 && Math.random() < Math.tanh(excess / 5) * 0.02) {
            const release = this.state.strain * 0.4;
            this.state.phi *= 0.88;       // 密度の損失
            this.state.biodiversity *= 0.6; // 種の絶滅
            this.state.strain -= release;
            this.ext_cooldown = 5000000; // 冷却期間
            window.addLog(`!! MAJOR STRAIN RELEASE: EXTINCTION EVENT !!`);
        }
    }

    updatePhase() {
        const p = this.state.phi;
        if (p > 1.2) {
            if (this.state.phase !== "Sapient") window.addLog("PHASE SHIFT → Sapient");
            this.state.phase = "Sapient";
            this.state.drive = Math.min(1.0, this.state.drive + 0.001);
        } else if (p > 1.0) {
            this.state.phase = "Complex";
        } else if (p > 0.85) {
            if (this.state.phase === "Pre-Biotic") window.addLog("CAMBRIAN EXPLOSION");
            this.state.phase = "Cambrian";
            this.state.biodiversity = Math.min(1.0, this.state.biodiversity + 0.005);
        }
    }

    getState() {
        return this.state;
    }
}
