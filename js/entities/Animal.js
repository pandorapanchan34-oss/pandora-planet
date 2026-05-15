/**
 * PANDORA EARTH — js/entities/Animal.js
 *
 * 動物（Drive生成者・情報消費者）
 *
 * Pandora Theory における動物の意味：
 *   植物のデフラグで生まれた「演算リソースの貯金（S_margin）」を
 *   消費して高次の情報処理（行動・学習・社会）を行う存在。
 *   死によるwriteoutがΦを押し上げ、過飽和→Cascadeを加速する。
 *   Drive = 「情報を時間軸に書き出す速度」の加速装置。
 *
 * ─────────────────────────────────────────────────────
 * エントロピーフロー：
 *   Animal.getEntropyContribution() → 正値（消費）
 *   → Engine集約 → EarthBody.applyEntropy()
 *   → S_local上昇 → 次のCascadeサイクルへ
 * ─────────────────────────────────────────────────────
 */

import { Individual, ENTITY_TYPE } from './Individual.js';
import { calcSLocal }              from '../core/Entropy.js';
import { PANDORA_CONST }           from '../constants.js';

const BGF = PANDORA_CONST.BGF; // 19.15

// 動物の種別
export const ANIMAL_TYPE = Object.freeze({
    MICROBE:    'microbe',      // 微生物（最初期）
    INVERTEBRATE: 'invertebrate', // 無脊椎動物
    VERTEBRATE: 'vertebrate',   // 脊椎動物
    MAMMAL:     'mammal',       // 哺乳類
});

const ANIMAL_CONFIG = {
    [ANIMAL_TYPE.MICROBE]: {
        lifespan:       200,
        entropyRate:    0.008,   // エントロピー消費率（低）
        driveRate:      0.002,   // Drive生成率
        reproRate:      0.15,    // 繁殖速度
        oxygenNeeded:   0.001,   // 必要酸素濃度
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

        // Drive（情報処理加速度）
        this.drive           = 0;
        this.driveAccum      = 0;  // 累積Drive

        // 繁殖
        this._reproAccumulator = 0;
        this.readyToReproduce  = false; // Biosphere.jsが検知

        // 捕食関係（将来のPredation.js用）
        this.satiation       = 1.0;  // 満腹度（0〜1）
    }

    // ── _onUpdate ────────────────────────────────────────
    _onUpdate(env, delta, stress) {
        const {
            phi        = 0.82,
            strain     = 0,
            oxygenLevel = 0.01,
        } = env;

        // 1. 酸素不足チェック（酸素が足りないと活性低下）
        const oxygenEff = Math.min(1, oxygenLevel / Math.max(this.oxygenNeeded, 0.001));

        // 2. Drive生成
        //    成熟度 × 酸素効率 × bgf摩擦の逆数
        const bgfFriction = Math.abs((env.temp ?? 15) - BGF) / BGF;
        const driveFactor = this.maturity * oxygenEff * Math.max(0, 1 - bgfFriction);
        this.drive        = this.driveRate * driveFactor;
        this.driveAccum  += this.drive * delta;

        // 3. 満腹度（時間とともに低下、将来のPredation.jsで更新）
        this.satiation = Math.max(0, this.satiation - 0.001 * delta);

        // 4. 繁殖判定
        const effectiveReproRate = this.reproRate * oxygenEff * this.maturity;
        this._reproAccumulator  += effectiveReproRate * delta;
        if (this._reproAccumulator >= 1.0 && this.satiation > 0.3) {
            this._reproAccumulator = 0;
            this.readyToReproduce  = true;
        }
    }

    // ── _onDeath ─────────────────────────────────────────
    _onDeath(cause) {
        // 死亡時にDriveを解放（writeoutとして情報場に還元）
        // → Biosphere._calcWriteoutで集約される
        this.driveAccum *= 0.8; // 20%は消散
    }

    // ── _calcStress（動物固有）───────────────────────────
    _calcStress(env) {
        const {
            temp       = 15,
            bgf        = BGF,
            stability  = 1.0,
            strain     = 0,
            oxygenLevel = 0.01,
        } = env;

        // bgf摩擦ストレス
        const bgfFriction    = Math.abs(temp - bgf) / bgf;
        const frictionStress = Math.pow(bgfFriction, 1.8) * 1.6;

        // Strainストレス（種別耐性あり）
        const strainStress = Math.max(0,
            (strain - this.strainTolerance) / (10 - this.strainTolerance)
        );

        // 酸素欠乏ストレス（動物は植物より酸素依存が高い）
        const oxygenStress = Math.max(0,
            1 - oxygenLevel / Math.max(this.oxygenNeeded * 2, 0.01)
        ) * 0.8;

        // 飢餓ストレス（将来のPredation.js連携）
        const hungerStress = Math.max(0, 1 - this.satiation) * 0.3;

        const stabilityStress = Math.max(0, 1 - stability) * 0.4;

        return Math.min(1.0,
            frictionStress + strainStress * 0.8
            + oxygenStress + hungerStress + stabilityStress
        );
    }

    // ── エントロピー貢献 ──────────────────────────────────
    /**
     * 動物は正のエントロピーを消費（S_localを上げる）
     * 死体は大きなエントロピーを放出
     */
    getEntropyContribution(phi, strain) {
        const base = calcSLocal(phi, strain);

        if (!this.alive) {
            // 死体：大きなエントロピー放出（分解）
            return base * 0.02 * (1 + this.driveAccum * 0.1);
        }

        const oxyEff = Math.min(1, (this._lastOxygenLevel ?? 0.01) / this.oxygenNeeded);
        return base * this.entropyRate * this.maturity * oxyEff;
    }

    // ── スナップショット ───────────────────────────────────
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
 * 酸素濃度・bgf摩擦・Strainで判定
 *
 * @param {object} env - { oxygenLevel, temp, strain }
 * @returns {string} ANIMAL_TYPE
 */
export function selectAnimalType(env) {
    const { oxygenLevel = 0.01, temp = 15, strain = 0 } = env;
    const bgfFriction = Math.abs(temp - BGF) / BGF;

    // 酸素極少 or 高Strain or 高摩擦 → 微生物
    if (oxygenLevel < 0.05 || strain >= 7 || bgfFriction > 0.5) {
        return ANIMAL_TYPE.MICROBE;
    }
    // 酸素少 → 無脊椎
    if (oxygenLevel < 0.12) return ANIMAL_TYPE.INVERTEBRATE;
    // 酸素中 → 脊椎
    if (oxygenLevel < 0.18) return ANIMAL_TYPE.VERTEBRATE;
    // 酸素十分 + bgf近 → 哺乳類
    return ANIMAL_TYPE.MAMMAL;
}
