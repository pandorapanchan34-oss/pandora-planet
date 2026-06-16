/**
 * PANDORA EARTH — js/origins/HydrothermalVent.js
 * 熱水噴出孔（化学的摩擦キャンセラー搭載版）
 */
import { calcSLocal, calcSCritical } from '../core/Entropy.js';
import { PANDORA_CONST } from '../constants.js';

const BGF = PANDORA_CONST.BGF;
const MIN_ACTIVITY_FOR_GENESIS = 0.4;
const VENT_LIFESPAN = 3000;

export class HydrothermalVent {
    constructor(config = {}) {
        this.x = config.x ?? 0;
        this.y = config.y ?? 0;
        this.depth = config.depth ?? 2400;
        this.active = false;
        this.activity = 0;
        this.age = 0;
        this.alive = true;
        this.localTemp = 80;
        this.localPH = 9.0;
        this.chemDensity = 0;
        this.genesisReady = false;
        this.genesisOccurred = false;
        this._localNegentropy = 0;
    }

    update(bodySnap, geoSnap, delta) {
        if (!this.alive) return;

        const { phi, strain, mantleTemp } = bodySnap;
        const { ventActive, ventIntensity } = geoSnap;

        this.age += delta;
        if (this.age >= VENT_LIFESPAN) {
            this.alive = false;
            this.active = false;
            return;
        }

        this.active = ventActive;
        this.activity = ventIntensity;

        if (!this.active) {
            this.activity = Math.max(0, this.activity - 0.01 * delta);
            this._localNegentropy = 0;
            return;
        }

        const depthBonus = this.depth / 10000;
        this.localTemp = Math.min(400, 80 + mantleTemp * 0.1 * this.activity + depthBonus * 50);
        this.chemDensity = this.activity * 0.8;

        const bgfFriction = Math.abs(this.localTemp - BGF) / BGF;

        // 🌟 FIX: 【熱水バリア】化学物質（H2S等）の濃度が高い場合、400℃の物理的熱摩擦を「情報場的に無効化」する
        const effectiveFriction = Math.max(0, bgfFriction - this.chemDensity * 10.0);

        const chemBoost = this.chemDensity * 0.5;
        const frictionPenalty = effectiveFriction * 0.3;
        this._localNegentropy = Math.max(0, this.activity * (chemBoost - frictionPenalty) * 0.8);

        this._checkGenesisReady(phi, strain);
    }

    _checkGenesisReady(phi, strain) {
        if (this.genesisOccurred) return;
        const s_local = calcSLocal(phi, strain);
        const s_critical = calcSCritical(strain);
        const saturation = s_critical > 0 ? s_local / s_critical : 0;

        this.genesisReady = (saturation >= 0.7 && this.activity >= MIN_ACTIVITY_FOR_GENESIS && this.chemDensity >= 0.3);
    }

    triggerGenesis() {
        if (!this.genesisReady || this.genesisOccurred) return false;
        this.genesisOccurred = true;
        this.genesisReady = false;
        return true;
    }

    getLocalNegentropy() {
        return -this._localNegentropy; 
    }

    getSnapshot() {
        return {
            x: this.x, y: this.y,
            active: this.active, activity: +this.activity.toFixed(3),
            age: +this.age.toFixed(1), alive: this.alive,
            localTemp: +this.localTemp.toFixed(1), localPH: +this.localPH.toFixed(2),
            chemDensity: +this.chemDensity.toFixed(3),
            genesisReady: this.genesisReady, genesisOccurred: this.genesisOccurred,
            localNegentropy: +this._localNegentropy.toFixed(4),
        };
    }
}
