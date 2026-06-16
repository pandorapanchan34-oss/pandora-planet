/**
 * PANDORA EARTH — js/entities/Animal.js
 * 動物圏（Drive生成者・情報消費者 ＋ 文明特異点モジュール統合版）
 */

import { Individual, ENTITY_TYPE } from './Individual.js';
import { calcSLocal }              from '../core/Entropy.js';
import { PANDORA_CONST }           from '../constants.js';

const BGF = PANDORA_CONST.BGF; // 19.15

// 動物の種別（オリジナル ＋ SAPIENTの融合）
export const ANIMAL_TYPE = Object.freeze({
    MICROBE:      'microbe',      // 微生物（最初期）
    INVERTEBRATE: 'invertebrate', // 無脊椎動物
    VERTEBRATE:   'vertebrate',   // 脊椎動物
    MAMMAL:       'mammal',       // 哺乳類
    SAPIENT:      'sapient',      // 🌟 NEW: 知的生命体（文明）
});

const ANIMAL_CONFIG = {
    [ANIMAL_TYPE.MICROBE]: {
        lifespan:       200,
        entropyRate:    0.008,
        driveRate:      0.002,
        reproRate:      0.15,
        oxygenNeeded:   0.001,
        strainTolerance: 8.5,
    },
    [ANIMAL_TYPE.INVERTEBRATE]: {
        lifespan:       600,
        entropyRate:    0.018,
        driveRate:      0.008,
        reproRate:      0.06,
        oxygenNeeded:   0.05,
        strainTolerance: 7.5,
    },
    [ANIMAL_TYPE.VERTEBRATE]: {
        lifespan:       1500,
        entropyRate:    0.035,
        driveRate:      0.020,
        reproRate:      0.025,
        oxygenNeeded:   0.15,
        strainTolerance: 6.5,
    },
    [ANIMAL_TYPE.MAMMAL]: {
        lifespan:       3000,
        entropyRate:    0.055,
        driveRate:      0.045,
        reproRate:      0.010,
        oxygenNeeded:   0.20,
        strainTolerance: 6.0,
    },
    // 🌟 統合ゲノム: 短命だが凄まじい負荷とDriveを叩き出す文明
    [ANIMAL_TYPE.SAPIENT]: {
        lifespan:       800,
        entropyRate:    0.150, // 地球を汚染するレベルの正エントロピー
        driveRate:      0.080, // 要塞の極上の餌
        reproRate:      0.005, // 繁殖は極めて遅い
        oxygenNeeded:   0.20,
        strainTolerance: 5.5,  // 環境変化に弱い
    },
};

export class Animal extends Individual {

    constructor(config = {}) {
        const animalType = config.animalType ?? ANIMAL_TYPE.MICROBE;
        const preset     = ANIMAL_CONFIG[animalType];

        super({
            type:           ENTITY_TYPE.ANIMAL,
            lifespan:       preset.lifespan,
            negentropyRate: 0,
            entropyRate:    preset.entropyRate,
            x: config.x ?? 0,
            y: config.y ?? 0,
        });

        this.animalType      = animalType;
        this.driveRate       = preset.driveRate;
        this.reproRate       = preset.reproRate;
        this.oxygenNeeded    = preset.oxygenNeeded;
        this.strainTolerance = preset.strainTolerance;
        
        // 🌟 文明フラグ
        this.isSapient       = (animalType === ANIMAL_TYPE.SAPIENT);

        // Drive（情報処理加速度）
        this.drive           = 0;
        this.driveAccum      = 0;

        // 繁殖
        this._reproAccumulator = 0;
        this.readyToReproduce  = false;

        // 捕食関係
        this.satiation       = 1.0;
    }

    _onUpdate(env, delta, stress) {
        const { phi = 0.82, strain = 0, oxygenLevel = 0.01 } = env;

        // 1. 酸素不足チェック
        const oxygenEff = Math.min(1, oxygenLevel / Math.max(this.oxygenNeeded, 0.001));

        // 2. Drive生成（🌟 融合ハック：Sapientは成熟すると演算力が爆発する！）
        const bgfFriction = Math.abs((env.temp ?? 15) - BGF) / BGF;
        const intelligenceFactor = this.isSapient ? (1.0 + this.maturity * 4.0) : 1.0;
        
        const driveFactor = this.maturity * oxygenEff * Math.max(0, 1 - bgfFriction) * intelligenceFactor;
        this.drive        = this.driveRate * driveFactor;
        this.driveAccum  += this.drive * delta;

        // 3. 満腹度
        this.satiation = Math.max(0, this.satiation - 0.001 * delta);

        // 4. 繁殖判定
        const effectiveReproRate = this.reproRate * oxygenEff * this.maturity;
        this._reproAccumulator  += effectiveReproRate * delta;
        if (this._reproAccumulator >= 1.0 && this.satiation > 0.3) {
            this._reproAccumulator = 0;
            this.readyToReproduce  = true;
        }
    }

    _onDeath(cause) {
        // 死亡時にDriveを解放（Biosphere._calcWriteoutで集約され、要塞の餌になる！）
        this.driveAccum *= 0.8;
    }

    _calcStress(env) {
        const { temp = 15, bgf = BGF, stability = 1.0, strain = 0, oxygenLevel = 0.01 } = env;

        const bgfFriction    = Math.abs(temp - bgf) / bgf;
        const frictionStress = Math.pow(bgfFriction, 1.8) * 1.6;

        const strainStress = Math.max(0, (strain - this.strainTolerance) / (10 - this.strainTolerance));
        
        // 🌟 Sapientは酸素欠乏に最も弱い（致命的）
        const o2Penalty = this.isSapient ? 3.0 : 2.0;
        const oxygenStress = Math.max(0, 1 - oxygenLevel / Math.max(this.oxygenNeeded * o2Penalty, 0.01)) * 0.8;

        const hungerStress = Math.max(0, 1 - this.satiation) * 0.3;
        const stabilityStress = Math.max(0, 1 - stability) * 0.4;

        return Math.min(1.0, frictionStress + strainStress * 0.8 + oxygenStress + hungerStress + stabilityStress);
    }

    getEntropyContribution(phi, strain) {
        const base = calcSLocal(phi, strain);

        if (!this.alive) {
            return base * 0.02 * (1 + this.driveAccum * 0.1);
        }

        const oxyEff = Math.min(1, (this._lastOxygenLevel ?? 0.01) / this.oxygenNeeded);
        
        // 🌟 文明による情報場への強烈な汚染（自己崩壊リスク）
        const sapientPenalty = this.isSapient ? 2.5 : 1.0;
        return base * this.entropyRate * this.maturity * oxyEff * sapientPenalty;
    }

    getSnapshot() {
        return {
            ...super.getSnapshot(),
            animalType:       this.animalType,
            drive:            +this.drive.toFixed(4),
            driveAccum:       +this.driveAccum.toFixed(4),
            satiation:        +this.satiation.toFixed(3),
            readyToReproduce: this.readyToReproduce,
            oxygenNeeded:     this.oxygenNeeded,
        };
    }
}

/**
 * 環境に応じて最適な動物種別を選択
 * @param {object} env - { oxygenLevel, temp, strain, phase }
 */
export function selectAnimalType(env) {
    const { oxygenLevel = 0.01, temp = 15, strain = 0, phase = 'Cambrian' } = env;
    const bgfFriction = Math.abs(temp - BGF) / BGF;

    if (oxygenLevel < 0.05 || strain >= 7 || bgfFriction > 0.5) {
        return ANIMAL_TYPE.MICROBE;
    }
    if (oxygenLevel < 0.12) return ANIMAL_TYPE.INVERTEBRATE;
    if (oxygenLevel < 0.18) return ANIMAL_TYPE.VERTEBRATE;
    
    // 🌟 融合ハック：酸素20%以上かつ、フェーズが進んでいるか確率で「文明（Sapient）」が誕生！
    if (oxygenLevel >= 0.20 && (phase === 'Sapient' || phase === 'Singularity' || Math.random() < 0.1)) {
        return ANIMAL_TYPE.SAPIENT;
    }

    return ANIMAL_TYPE.MAMMAL;
}
