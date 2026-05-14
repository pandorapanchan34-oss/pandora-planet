import { PLANET } from '../../config.js';
import { UNIVERSAL } from '../constants.js';

export class PandoraEngine {
    constructor() {
        this.active = false;
        
        // 宇宙定数
        this.B = UNIVERSAL.B || 24.0;
        this.TAU = 0.1194; // 合言葉「TAU」に紐づく位相定数
        this.PHI_CRITICAL = 5/6; // システムの特異点 (約0.833)

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
     */
    calculateDeathWriteout() {
        const zeta = Math.max(0, (this.state.phi / this.PHI_CRITICAL) - 1);
        const lifespan = Math.max(0.5, this.B * Math.pow(1 - this.TAU, zeta) / Math.max(0.2, this.state.biodiversity * 5));
        const turnover = 1 / lifespan;
        return zeta * turnover * (this.state.biodiversity * 0.1) * 0.002;
    }

    update(delta) {
        if (!this.active) return;

        // 1. 時間の進行
        this.state.year += 1000 * (delta / 16);

        // 2. 生命情報密度 Φ の更新
        const wo = this.calculateDeathWriteout();
        const geoBase = 0.00012;
        const entropy = this.state.phi * 0.00008;
        
        const growth = (geoBase + (this.state.biodiversity * 0.001) + (this.state.drive * 0.002) + wo - entropy);
        this.state.phi += growth * (delta / 16);

        // 3. Strain (歪み) の基準計算
        // ※ ここで一度計算してから、後段のイベント判定で上書き・解放を可能にする
        const ratio = this.state.phi / this.PHI_CRITICAL;
        const proximity = Math.abs(this.PHI_CRITICAL - this.state.phi);
        const saturation = (1 / Math.max(0.002, proximity)) * 0.025;
        
        // 一旦、基準値をセット
        this.state.strain = 1.5 + (ratio * 2.0) + saturation + (this.state.drive * 4.0);

        // 4. Strain放出イベント（絶滅イベント）の判定と上書き
        // 計算の「後」に判定を置くことで、解放された数値が次フレームまで保持される
        this.checkExtinctionEvents(delta);

        // 5. 温度のホメオスタシス (19.15度への回帰)
        const targetTemp = 19.15 + (this.state.phi * 2.5) + (this.state.drive * 5);
        this.state.temp += (targetTemp - this.state.temp) * 0.005;

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
        
        // Strainが閾値を超えている場合、確率的に放出（絶滅）
        if (excess > 0 && Math.random() < Math.tanh(excess / 5) * 0.02) {
            // 解放プロセス
            const release = this.state.strain * 0.45;
            
            this.state.phi *= 0.88;       // 蓄積された密度の損失
            this.state.biodiversity *= 0.6; // 種の絶滅
            this.state.strain -= release;   // 歪みの解放
            this.state.temp -= 5.0;         // 急激な冷却（火山灰などによる寒冷化イメージ）
            
            this.ext_cooldown = 10000000; // 1000万年の冷却期間（この間は平和）
            
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
            this.state.drive = Math.min(1.0, this.state.drive + 0.0005);
        } else if (p > 0.85) {
            if (this.state.phase === "Pre-Biotic") window.addLog?.("CAMBRIAN EXPLOSION: Φ > 0.85");
            this.state.phase = "Cambrian";
            this.state.biodiversity = Math.min(1.0, this.state.biodiversity + 0.005);
        }
    }

    getState() {
        return { ...this.state };
    }
}
