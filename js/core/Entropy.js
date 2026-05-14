/**
 * PANDORA EARTH — js/core/Entropy.js
 * エントロピー管理システム（最終調整版）
 */

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

const B          = PANDORA_CONST.B;           // 24.0
const BGF        = PANDORA_CONST.BGF;         // 19.15
const PHI_C      = PANDORA_DERIVED.PHI_IDEAL; // 5/6 ≈ 0.8333

const STRAIN_PLANT_THRESHOLD = 5.0;
const S_CRITICAL_FLOOR       = 0.12;
const COOLING_PERIOD         = 180;           // 植物根付く期間（ステップ）

export class EntropySystem {

    constructor() {
        this.s_local     = 0;      // 現在のエントロピー
        this.s_critical  = 0;      // 臨界値
        this.s_margin    = 0;      // 動物誕生用の余裕リソース
        this.coolingMode = false;
        this.coolingTimer = 0;

        this.plantTriggered  = false;
        this.animalTriggered = false;
        this.phase = 'accumulation'; // accumulation | plant_trigger | cooling | animal_ready
    }

    update(phi, strain, delta = 1) {
        // 1. S_local計算
        this.s_local = this._calcSLocal(phi, strain);

        // 2. S_critical計算
        this.s_critical = this._calcSCritical(strain);

        // 3. 植物誕生判定
        if (!this.plantTriggered && this._isPlantTrigger(strain)) {
            this.plantTriggered = true;
            this._onPlantGenesis(phi);
            return { triggered: true, type: 'plant' };
        }

        // 4. 冷却期間（植物根付く期間）
        if (this.coolingMode && this.coolingTimer > 0) {
            this.coolingTimer--;
            this._applyCoolingEffect(phi);

            // 冷却期間中も植物は少しずつエントロピーを排出
            if (this.coolingTimer < COOLING_PERIOD * 0.7) {
                this.s_local += 0.006 * phi * delta;
            }
        }

        // 5. S_margin（余裕）の蓄積
        if (this.plantTriggered && this.s_local < this.s_critical) {
            this.s_margin += (this.s_critical - this.s_local) * 0.8 * delta;
        }

        // 6. 動物誕生判定
        if (this.plantTriggered && !this.animalTriggered && 
            this.s_margin >= 2.2) {   // 閾値は調整可能
            this.animalTriggered = true;
            this.phase = 'animal_ready';
            return { triggered: true, type: 'animal' };
        }

        // フェーズ更新
        this._updatePhase();

        return { triggered: false, type: null };
    }

    _calcSLocal(phi, strain) {
        if (strain <= 0) return 0;
        const gap = Math.max(Math.abs(phi - PHI_C), 1e-6);
        return B * Math.log(BGF / gap) * strain;
    }

    _calcSCritical(strain) {
        const safeStrain = Math.max(strain, 0.5);
        let s = B * Math.log(BGF) * (1 / Math.sqrt(safeStrain));
        return Math.max(s, S_CRITICAL_FLOOR);
    }

    _isPlantTrigger(strain) {
        return strain >= STRAIN_PLANT_THRESHOLD && this.s_local > this.s_critical;
    }

    _onPlantGenesis(phi) {
        this.s_local *= 0.28;           // 72%急落（情報整理効果）
        this.coolingMode = true;
        this.coolingTimer = COOLING_PERIOD;
        this.phase = 'plant_trigger';
    }

    _applyCoolingEffect(phi) {
        // 徐々に弱まる冷却効果
        const rate = 0.018 * (this.coolingTimer / COOLING_PERIOD);
        this.s_local -= rate * this.s_local;
    }

    _updatePhase() {
        if (this.animalTriggered) {
            this.phase = 'animal_ready';
        } else if (this.coolingMode && this.coolingTimer > 0) {
            this.phase = 'cooling';
        } else if (this.plantTriggered) {
            this.phase = 'plant_stable';
        }
    }

    getSnapshot() {
        return {
            s_local:        +this.s_local.toFixed(4),
            s_critical:     +this.s_critical.toFixed(4),
            s_margin:       +this.s_margin.toFixed(3),
            phase:          this.phase,
            plantTriggered: this.plantTriggered,
            animalTriggered:this.animalTriggered,
            saturation:     this.s_critical > 0 ? 
                           +(this.s_local / this.s_critical).toFixed(3) : 0
        };
    }

    reset() {
        Object.assign(this, new EntropySystem());
    }
}
