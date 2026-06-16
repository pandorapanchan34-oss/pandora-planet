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
    [PLANT_TYPE.ALGAE]: { lifespan: 800, negentropyRate: 0.012, spreadRate: 0.08, nutrientYield: 0.4, strainTolerance: 9.0 },
    [PLANT_TYPE.MOSS]:  { lifespan: 1200, negentropyRate: 0.018, spreadRate: 0.05, nutrientYield: 0.5, strainTolerance: 7.5 },
    [PLANT_TYPE.FERN]:  { lifespan: 2000, negentropyRate: 0.028, spreadRate: 0.04, nutrientYield: 0.6, strainTolerance: 6.5 },
    [PLANT_TYPE.TREE]:  { lifespan: 8000, negentropyRate: 0.045, spreadRate: 0.02, nutrientYield: 0.8, strainTolerance: 6.0 },
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

    _onDeath(cause) {
        this.nutrientReleased = false;
    }

    // 🌟 原始地球（70℃灼熱環境）適応パッチ
    _calcPhotosynthesis(temp, stability) {
        const bgfFriction = Math.abs(temp - BGF) / BGF;
        // 藻類(algae)の場合は初期の過酷な熱摩擦を無効化（1/5に軽減）する適応ゲノムを発動
        const frictionMitigation = this.plantType === 'algae' ? 0.2 : 1.0;
        const tempEff     = Math.max(0.05, 1 - bgfFriction * 2.5 * frictionMitigation);
        return tempEff * stability * this.maturity;
    }

    _calcStress(env) {
        const { temp = 15, bgf = BGF, stability = 1.0, strain = 0 } = env;
        const bgfFriction    = Math.abs(temp - bgf) / bgf;
        const frictionMitigation = this.plantType === 'algae' ? 0.2 : 1.0;
        const frictionStress = Math.pow(bgfFriction, 1.8) * 1.6 * frictionMitigation;

        const strainStress = Math.max(0, (strain - this.strainTolerance) / (10 - this.strainTolerance));
        const stabilityStress = Math.max(0, 1 - stability) * 0.4;

        return Math.min(1.0, frictionStress + strainStress * 0.8 + stabilityStress);
    }

    getEntropyContribution(phi, strain) {
        if (!this.alive) return calcSLocal(phi, strain) * 0.005 * this.nutrientYield;
        const base = calcSLocal(phi, strain);
        return -base * this.negentropyRate * this.photosynthesisEff * this.maturity;
    }

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

export function selectPlantType(env) {
    const { temp = 15, strain = 0 } = env;
    const bgfFriction = Math.abs(temp - BGF) / BGF;
    if (strain >= 7 || bgfFriction > 0.6) return PLANT_TYPE.ALGAE;
    if (bgfFriction > 0.35) return PLANT_TYPE.MOSS;
    if (bgfFriction > 0.15) return PLANT_TYPE.FERN;
    return PLANT_TYPE.TREE;
}
