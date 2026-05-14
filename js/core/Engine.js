// js/core/Engine.js
import { PLANET } from '../../config.js';
import { UNIVERSAL } from '../constants.js';

export class PandoraEngine {
    constructor() {
        this.active = false;
        
        // 宇宙定数 (constants.js からの引き継ぎ想定)
        this.B = UNIVERSAL.B || 24.0;
        this.TAU = 0.1194; // 合言葉「TAU」に紐づく位相定数
        this.PHI_CRITICAL = 5/6; // システムの特異点

        // 惑星の動的状態
        this.state = {
            phi: PLANET.initialPhi || 0.42,
            strain: 1.80,
            temp: PLANET.initialTemp || 18.0,
            drive: PLANET.initialDrive || 0.0,
            phase: "Pre-Biotic",
            biodiversity: 0.0,
            year: -800000000 // 8億年前からスタート
        };

        this.ext_cooldown = 0;
    }

    /**
     * パンドラ理論：死による情報の書き出し演算
     * 寿命が尽きることで情報が宇宙へ還元（密度へ加算）される
     */
    calculateDeathWriteout() {
        // Φc を基準とした zeta 係数
        const zeta = Math.max(0, (this.state.phi / this.PHI_CRITICAL) - 1);
        
        // 平均寿命の計算: 帯域Bと密度の相関
        // 密度が上がると寿命が縮まり、書き出しが加速する
        const lifespan = Math.max(0.5, this.B * Math.pow(1 - this.TAU, zeta) / Math.max(0.2, this.state.biodiversity * 5));
        const turnover = 1 / lifespan;
        
        // 書き出し量 (Death Writeout)
        return zeta * turnover * (this.state.biodiversity * 0.1) * 0.002;
    }

    update(delta) {
        if (!this.active) return;

        // 1. 時間の進行 (8億年の歴史を刻む)
        // deltaを基準に、1ステップで約1000年〜のスケールで進む
        this.state.year += 1000 * (delta / 16);

        // 2. 生命情報密度 Φ の更新
        const wo = this.calculateDeathWriteout();
        const geoBase = 0.00012; // 地質学的成長
        const entropy = this.state.phi * 0.00008; // 情報の散逸
        
        // Φの上昇: 地質 + 生物多様性 + 推進力 + 死による還元 - エントロピー
        const growth = (geoBase + (this.state.biodiversity * 0.001) + (this.state.drive * 0.002) + wo - entropy);
        this.state.phi += growth * (delta / 16);

        // 3. Strain (歪み) の動的計算
        // Φc (5/6) に近づくと分母が小さくなり、Strainが爆発的に上昇する
        const ratio = this.state.phi / this.PHI_CRITICAL;
        const proximity = Math.abs(this.PHI_CRITICAL - this.state.phi);
        const saturation = (1 / Math.max(0.002, proximity)) * 0.025;
        
        this.state.strain = 1.5 + (ratio * 2.0) + saturation + (this.state.drive * 4.0);

        // 4. 温度のホメオスタシス
        // BGF(19.15) を基底とし、密度と文明負荷で上昇
        const targetTemp = 19.15 + (this.state.phi * 2.5) + (this.state.drive * 5);
        this.state.temp += (targetTemp - this.state.temp) * 0.005;

        // 5. 絶滅イベントのチェック
        this.checkExtinctionEvents(delta);

        // 6. フェーズ遷移判定
        this.updatePhase();
    }

    checkExtinctionEvents(delta) {
        if (this.ext_cooldown > 0) {
            this.ext_cooldown -= 1000 * (delta / 16);
            return;
        }

        const threshold = PLANET.strainThresh || 10.0;
        const excess = Math.max(0, this.state.strain - threshold);
        
        // Strainが閾値を超えている場合、確率的に発火
        if (excess > 0 && Math.random() < Math.tanh(excess / 5) * 0.02) {
            const release = this.state.strain * 0.45;
            
            // 絶滅によるリセット
            this.state.phi *= 0.88;
            this.state.biodiversity *= 0.6;
            this.state.strain -= release;
            this.state.temp -= 5.0; // 急激な冷却
            
            this.ext_cooldown = 10000000; // 1000万年の冷却期間
            
            if (window.addLog) {
                window.addLog(`!! MAJOR STRAIN RELEASE: YEAR ${Math.round(this.state.year/1000000)}Ma !!`);
            }
        }
    }

    updatePhase() {
        const p = this.state.phi;
        if (p > 1.25) {
            if (this.state.phase !== "Sapient") window.addLog?.("PHASE SHIFT → Sapient");
            this.state.phase = "Sapient";
            // 知性フェーズでは文明負荷(Drive)が自動成長
            this.state.drive = Math.min(1.0, this.state.drive + 0.0005);
        } else if (p > 0.85) {
            if (this.state.phase === "Pre-Biotic") window.addLog?.("CAMBRIAN EXPLOSION: Φ > 0.85");
            this.state.phase = "Cambrian";
            // 生命の多様性が拡大
            this.state.biodiversity = Math.min(1.0, this.state.biodiversity + 0.005);
        }
    }

    getState() {
        // 参照渡しを防ぐためコピーを返す
        return { ...this.state };
    }
}
