/**
 * PANDORA EARTH — js/entities/Plant.js
 */
import { Individual, ENTITY_TYPE } from './Individual.js';
import { calcSLocal } from '../core/Entropy.js';
import { PANDORA_CONST } from '../constants.js';

const BGF = PANDORA_CONST.BGF;

export const PLANT_TYPE = Object.freeze({
    ALGAE: 'algae', MOSS:  'moss', FERN:  'fern', TREE:  'tree',
});

const PLANT_CONFIG = {
    [PLANT_TYPE.ALGAE]: { lifespan: 800, negentropyRate: 0.012, spreadRate: 0.08, nutrientYield: 0.4, strainTolerance: 9.0 },
    [PLANT_TYPE.MOSS]:  { lifespan: 1200, negentropyRate: 0.018, spreadRate: 0.05, nutrientYield: 0.5, strainTolerance: 7.5 },
    [PLANT_TYPE.FERN]:  { lifespan: 2000, negentropyRate: 0.028, spreadRate: 0.04, nutrientYield: 0.6, strainTolerance: 6.5 },
    [PLANT_TYPE.TREE]:  { lifespan: 8000, negentropyRate: 0.045, spreadRate: 0.02, nutrientYield: 0.8, strainTolerance: 6.0 },
};

export class Plant extends Individual {
    constructor(config = {}) {
        const plantType = config.plantType ?? PLANT_TYPE.ALGAE;
        const preset    = PLANT_CONFIG[plantType];
        super({ type: ENTITY_TYPE.PLANT, lifespan: preset.lifespan, negentropyRate: preset.negentropyRate, entropyRate: 0, x: config.x ?? 0, y: config.y ?? 0 });
        this.plantType       = plantType;
        this.spreadRate      = preset.spreadRate;
        this.nutrientYield   = preset.nutrientYield;
        this.strainTolerance = preset.strainTolerance;
        this.photosynthesisEff  = 0;
        this._spreadAccumulator = 0;
        this.readyToSpread      = false;
        this.nutrientReleased   = false;
    }

    _onUpdate(env, delta, stress) {
        const { temp = 15, stability = 1.0 } = env;
        this.photosynthesisEff = this._calcPhotosynthesis(temp, stability);
        this._spreadAccumulator += this.spreadRate * this.photosynthesisEff * delta;
        if (this._spreadAccumulator >= 1.0) {
            this._spreadAccumulator = 0;
            this.readyToSpread = true;
        }
    }

    _onDeath(cause) { this.nutrientReleased = false; }

    // 🌟 FIX: 絶対防壁ゲノム（Algaeは安定度0%や高温でも死なない）
    _calcPhotosynthesis(temp, stability) {
        const bgfFriction = Math.abs(temp - BGF) / BGF;
        const frictionMitigation = this.plantType === 'algae' ? 0.2 : 1.0;
        const tempEff     = Math.max(0.05, 1 - bgfFriction * 2.5 * frictionMitigation);
        
        // STABが0になってもAlgaeなら0.5の効率で意地でも光合成する
        const stabEff = this.plantType === 'algae' ? Math.max(0.5, stability) : Math.max(0.1, stability);
        return tempEff * stabEff * this.maturity;
    }

    _calcStress(env) {
        const { temp = 15, bgf = BGF, stability = 1.0, strain = 0 } = env;

        const bgfFriction    = Math.abs(temp - bgf) / bgf;
        // 🌟 FIX: 70℃の摩擦ダメージを徹底的に無効化（0.2 -> 0.05へ）
        const frictionMitigation = this.plantType === 'algae' ? 0.05 : 1.0;
        const frictionStress = Math.pow(bgfFriction, 1.8) * 1.6 * frictionMitigation;

        const strainStress = Math.max(0, (strain - this.strainTolerance) / (10 - this.strainTolerance));

        // 🌟 FIX: STAB 0% (DISCHARGE BLOCKED) の絶望でも耐えられるよう緩和
        const stabMitigation = this.plantType === 'algae' ? 0.2 : 1.0;
        const stabilityStress = Math.max(0, 1 - stability) * 0.4 * stabMitigation;

        return Math.min(1.0, frictionStress + strainStress * 0.8 + stabilityStress);
    }

    getEntropyContribution(phi, strain) {
        if (!this.alive) return calcSLocal(phi, strain) * 0.005 * this.nutrientYield;
        return -calcSLocal(phi, strain) * this.negentropyRate * this.photosynthesisEff * this.maturity;
    }

    getSnapshot() {
        return { ...super.getSnapshot(), plantType: this.plantType, photosynthesisEff: +this.photosynthesisEff.toFixed(3), spreadRate: this.spreadRate, nutrientYield: this.nutrientYield, readyToSpread: this.readyToSpread };
    }
}

export function selectPlantType(env) {
    const { temp = 15, strain = 0 } = env;
    const bgfFriction = Math.abs(temp - BGF) / BGF;
    if (strain >= 7 || bgfFriction > 0.6) return PLANT_TYPE.ALGAE;
    if (bgfFriction > 0.35) return PLANT_TYPE.MOSS;
    if (bgfFriction > 0.15) return PLANT_TYPE.FERN;
    return PLANT_TYPE.TREE;
}
