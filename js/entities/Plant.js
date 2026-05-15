/**
 * PANDORA EARTH — js/entities/Plant.js
 *
 * 植物（負エントロピー生成者）
 *
 * 役割：
 *   過飽和した情報場を「デフラグ」する最初の生命体。
 *   光合成により負エントロピーを生成し、S_localを下げる。
 *   死後は分解されてNutrientCycleに還元される。
 *
 * Pandora Theory における植物の意味：
 *   「一生（時間軸）」という外部メモリに情報を書き出すことで
 *   物理空間のΦを擬似的に臨界点以下に抑え込む存在。
 *
 * ─────────────────────────────────────────────────────
 * エントロピーフロー：
 *   S_local過飽和
 *     → Plant誕生（Biosphere.jsがトリガー）
 *     → getEntropyContribution() → 負値
 *     → Engine集約 → EarthBody.applyEntropy()
 *     → S_local低下（デフラグ進行）
 *     → S_margin蓄積 → 動物誕生へ
 * ─────────────────────────────────────────────────────
 */

import { Individual, ENTITY_TYPE } from './Individual.js';
import { calcSLocal } from '../core/Entropy.js';

// 植物の種別
export const PLANT_TYPE = Object.freeze({
    ALGAE:       'algae',        // 藻類（最初期・水中）
    MOSS:        'moss',         // 蘚類（陸上初期）
    FERN:        'fern',         // シダ（中期）
    TREE:        'tree',         // 樹木（安定期）
});

// 種別ごとのデフォルト設定
const PLANT_CONFIG = {
    [PLANT_TYPE.ALGAE]: {
        lifespan:       800,
        negentropyRate: 0.012,   // 負エントロピー生成率（低め）
        tempOptimal:    20,      // 最適温度
        tempTolerance:  25,      // 許容温度幅
        spreadRate:     0.08,    // 繁殖速度
        nutrientYield:  0.4,     // 死後の栄養還元率
    },
    [PLANT_TYPE.MOSS]: {
        lifespan:       1200,
        negentropyRate: 0.018,
        tempOptimal:    15,
        tempTolerance:  20,
        spreadRate:     0.05,
        nutrientYield:  0.5,
    },
    [PLANT_TYPE.FERN]: {
        lifespan:       2000,
        negentropyRate: 0.028,
        tempOptimal:    18,
        tempTolerance:  22,
        spreadRate:     0.04,
        nutrientYield:  0.6,
    },
    [PLANT_TYPE.TREE]: {
        lifespan:       8000,
        negentropyRate: 0.045,
        tempOptimal:    15,
        tempTolerance:  18,
        spreadRate:     0.02,
        nutrientYield:  0.8,
    },
};

export class Plant extends Individual {

    /**
     * @param {object} config
     * @param {string} [config.plantType] - PLANT_TYPE
     * @param {number} [config.x]
     * @param {number} [config.y]
     */
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

        this.plantType     = plantType;
        this.tempOptimal   = preset.tempOptimal;
        this.tempTolerance = preset.tempTolerance;
        this.spreadRate    = preset.spreadRate;
        this.nutrientYield = preset.nutrientYield;

        // 光合成効率（環境・成熟度で変動）
        this.photosynthesisEff = 0;

        // 繁殖カウンター
        this._spreadAccumulator = 0;
        this.readyToSpread      = false;   // Biosphere.jsが読む

        // 栄養還元（死後）
        this.nutrientReleased = false;
    }

    // ── Individual._onUpdate オーバーライド ───────────────
    _onUpdate(env, delta, stress) {
        const { temp = 15, stability = 1.0, phi = 0.82 } = env;

        // 光合成効率を計算（温度・安定度・成熟度）
        this.photosynthesisEff = this._calcPhotosynthesis(temp, stability);

        // 繁殖判定
        this._spreadAccumulator += this.spreadRate * this.photosynthesisEff * delta;
        if (this._spreadAccumulator >= 1.0) {
            this._spreadAccumulator = 0;
            this.readyToSpread = true;  // Biosphere.jsが検知して新個体を生成
        }
    }

    // ── Individual._onDeath オーバーライド ────────────────
    _onDeath(cause) {
        // 死後の栄養還元フラグ（NutrientCycle.jsが処理）
        this.nutrientReleased = false; // NutrientCycle.jsがtrueにする
    }

    // ── 光合成効率（0〜1）────────────────────────────────
    _calcPhotosynthesis(temp, stability) {
        // 温度効率（最適温度から離れると低下）
        const tempDiff = Math.abs(temp - this.tempOptimal);
        const tempEff  = Math.max(0, 1 - tempDiff / this.tempTolerance);

        // 成熟度込み効率
        return tempEff * stability * this.maturity;
    }

    // ── Individual._calcStress オーバーライド ─────────────
    _calcStress(env) {
        const { temp = 15, stability = 1.0, strain = 0 } = env;

        const tempDiff    = Math.abs(temp - this.tempOptimal);
        const tempStress  = Math.max(0, tempDiff / (this.tempTolerance * 1.5));
        const strainStress = Math.max(0, (strain - 8) / 2); // Strain>8で急激にストレス
        const stabStress  = Math.max(0, 1 - stability) * 0.4;

        return Math.min(1, tempStress + strainStress + stabStress);
    }

    // ── エントロピー貢献（オーバーライド）────────────────
    getEntropyContribution(phi, strain) {
        if (!this.alive) {
            // 死体：分解でエントロピー放出（小さい）
            return calcSLocal(phi, strain) * 0.005 * this.nutrientYield;
        }

        // 光合成による負エントロピー生成
        // 成熟・高光合成効率ほど強力にS_localを下げる
        const base = calcSLocal(phi, strain);
        return -base * this.negentropyRate * this.photosynthesisEff * this.maturity;
    }

    // ── スナップショット ───────────────────────────────────
    getSnapshot() {
        return {
            ...super.getSnapshot(),
            plantType:        this.plantType,
            photosynthesisEff: +this.photosynthesisEff.toFixed(3),
            spreadRate:       this.spreadRate,
            nutrientYield:    this.nutrientYield,
            readyToSpread:    this.readyToSpread,
        };
    }
}

/**
 * 環境に応じて最適な植物種別を選択するファクトリ関数
 * Biosphere.jsから呼ばれる
 *
 * @param {object} env - { temp, strain, phi }
 * @returns {string} PLANT_TYPE
 */
export function selectPlantType(env) {
    const { temp = 15, strain = 0 } = env;

    // Strain高・温度高 → 藻類（耐性が高い）
    if (strain >= 7 || temp > 35) return PLANT_TYPE.ALGAE;

    // 低温 → 蘚類
    if (temp < 10) return PLANT_TYPE.MOSS;

    // 中温・安定 → シダ
    if (temp >= 10 && temp < 20) return PLANT_TYPE.FERN;

    // 温暖・安定 → 樹木
    return PLANT_TYPE.TREE;
}
