/**
 * PANDORA EARTH — js/entities/Plant.js
 *
 * 植物（負エントロピー生成者）
 *
 * 過飽和した情報場を「デフラグ」する最初の生命体。
 * 光合成により負エントロピーを生成し、S_localを下げる。
 *
 * Pandora Theory における植物の意味：
 *   「一生（時間軸）」という外部メモリに情報を書き出すことで
 *   物理空間のΦを擬似的に臨界点以下に抑え込む存在。
 *
 * 温度 = bgf摩擦として扱う（Individual.jsと統一）
 * bgf=19.15 に近いほど光合成効率が高い。
 */

import { Individual, ENTITY_TYPE } from './Individual.js';
import { calcSLocal } from '../core/Entropy.js';
import { PANDORA_CONST } from '../constants.js';

const BGF = PANDORA_CONST.BGF; // 19.15

export const PLANT_TYPE = Object.freeze({
    ALGAE: 'algae',
    MOSS:  'moss',
    FERN:  'fern',
    TREE:  'tree',
});

const PLANT_CONFIG = {
    [PLANT_TYPE.ALGAE]: {
        lifespan:       800,
        negentropyRate: 0.012,
        spreadRate:     0.08,
        nutrientYield:  0.4,
        strainTolerance: 9.0,  // 高Strainに強い（最初期）
    },
    [PLANT_TYPE.MOSS]: {
        lifespan:       1200,
        negentropyRate: 0.018,
        spreadRate:     0.05,
        nutrientYield:  0.5,
        strainTolerance: 7.5,
    },
    [PLANT_TYPE.FERN]: {
        lifespan:       2000,
        negentropyRate: 0.028,
        spreadRate:     0.04,
        nutrientYield:  0.6,
        strainTolerance: 6.5,
    },
    [PLANT_TYPE.TREE]: {
        lifespan:       8000,
        negentropyRate: 0.045,
        spreadRate:     0.02,
        nutrientYield:  0.8,
        strainTolerance: 6.0,
    },
};

export class Plant extends Individual {

    constructor(config = {}) {
        const plantType = config.plantType ?? PLANT_TYPE.ALGAE;
        const preset    = PLANT_CONFIG[plantType];

        super({
            type:           ENTITY_TYPE.PLANT,
            lifespan:       preset.lifespan,
            negentropyRate: preset.negentropyRate,
            entropyRate:    0,
            x: config.x ?? 0,
            y: config.y ?? 0,
        });

        this.plantType       = plantType;
        this.spreadRate      = preset.spreadRate;
        this.nutrientYield   = preset.nutrientYield;
        this.strainTolerance = preset.strainTolerance;

        this.photosynthesisEff  = 0;
        this._spreadAccumulator = 0;
        this.readyToSpread      = false; // Biosphere.jsが検知
        this.nutrientReleased   = false; // NutrientCycle.jsが処理
    }

    // ── _onUpdate ────────────────────────────────────────
    _onUpdate(env, delta, stress) {
        const { temp = 15, stability = 1.0 } = env;

        this.photosynthesisEff = this._calcPhotosynthesis(temp, stability);

        // 繁殖
        this._spreadAccumulator += this.spreadRate * this.photosynthesisEff * delta;
        if (this._spreadAccumulator >= 1.0) {
            this._spreadAccumulator = 0;
            this.readyToSpread = true;
        }
    }

    // ── _onDeath ─────────────────────────────────────────
    _onDeath(cause) {
        this.nutrientReleased = false; // NutrientCycle.jsがtrueにする
    }

    // ── 光合成効率（bgf摩擦ベース）───────────────────────
    /**
     * bgf=19.15 に近いほど摩擦が小さく、光合成効率が高い。
     * bgfFriction が大きいと効率が急激に低下する。
     */
    _calcPhotosynthesis(temp, stability) {
        const bgfFriction = Math.abs(temp - BGF) / BGF;
        const tempEff     = Math.max(0, 1 - bgfFriction * 2.5);
        return tempEff * stability * this.maturity;
    }

    // ── _calcStress（植物固有）────────────────────────────
    _calcStress(env) {
        const {
            temp      = 15,
            bgf       = BGF,
            stability = 1.0,
            strain    = 0,
        } = env;

        // bgf摩擦ストレス
        const bgfFriction    = Math.abs(temp - bgf) / bgf;
        const frictionStress = Math.pow(bgfFriction, 1.8) * 1.6;

        // Strainストレス（種別ごとの耐性で変化）
        const strainStress = Math.max(0,
            (strain - this.strainTolerance) / (10 - this.strainTolerance)
        );

        const stabilityStress = Math.max(0, 1 - stability) * 0.4;

        return Math.min(1.0, frictionStress + strainStress * 0.8 + stabilityStress);
    }

    // ── エントロピー貢献 ──────────────────────────────────
    getEntropyContribution(phi, strain) {
        if (!this.alive) {
            return calcSLocal(phi, strain) * 0.005 * this.nutrientYield;
        }
        const base = calcSLocal(phi, strain);
        return -base * this.negentropyRate * this.photosynthesisEff * this.maturity;
    }

    // ── スナップショット ───────────────────────────────────
    getSnapshot() {
        return {
            ...super.getSnapshot(),
            plantType:         this.plantType,
            photosynthesisEff: +this.photosynthesisEff.toFixed(3),
            spreadRate:        this.spreadRate,
            nutrientYield:     this.nutrientYield,
            readyToSpread:     this.readyToSpread,
        };
    }
}

/**
 * 環境に応じて最適な植物種別を選択
 * bgf摩擦が小さい（temp≈19.15）ほど高等植物が選ばれる
 *
 * @param {object} env - { temp, strain }
 * @returns {string} PLANT_TYPE
 */
export function selectPlantType(env) {
    const { temp = 15, strain = 0 } = env;
    const bgfFriction = Math.abs(temp - BGF) / BGF;

    // 高Strain or 高摩擦 → 藻類（最も耐性が高い）
    if (strain >= 7 || bgfFriction > 0.6) return PLANT_TYPE.ALGAE;

    // 中摩擦 → 蘚類
    if (bgfFriction > 0.35) return PLANT_TYPE.MOSS;

    // 低摩擦 → シダ
    if (bgfFriction > 0.15) return PLANT_TYPE.FERN;

    // bgfに最も近い → 樹木
    return PLANT_TYPE.TREE;
}
