/**
 * PANDORA EARTH — js/entities/Individual.js
 *
 * 全生命体の基底クラス
 *
 * bgf ≈ 19.15 は情報相関の臨界点。
 * 温度は bgf との「摩擦」として機能する。
 * 温度が bgf から大きく乖離すると摩擦が増大し、生命にストレスとなる。
 *
 * ─────────────────────────────────────────────────────
 * エントロピーフロー：
 *   Individual.getEntropyContribution()
 *     → Engine.js（集約）
 *     → EarthBody.applyEntropy()
 * ─────────────────────────────────────────────────────
 */

import { calcSLocal } from '../core/Entropy.js';
import { PANDORA_CONST } from '../constants.js';

const BGF = PANDORA_CONST.BGF; // 19.15

export const ENTITY_TYPE = Object.freeze({
    PLANT:  'plant',
    ANIMAL: 'animal',
});

export class Individual {

    /**
     * @param {object} config
     * @param {string} config.type
     * @param {number} config.lifespan
     * @param {number} config.negentropyRate
     * @param {number} config.entropyRate
     * @param {number} [config.x]
     * @param {number} [config.y]
     */
    constructor(config = {}) {
        this.type           = config.type           ?? ENTITY_TYPE.PLANT;
        this.lifespan       = config.lifespan       ?? 1000;
        this.negentropyRate = config.negentropyRate ?? 0;
        this.entropyRate    = config.entropyRate    ?? 0;

        // 座標（将来のGrid実装用）
        this.x = config.x ?? 0;
        this.y = config.y ?? 0;

        // 状態
        this.age      = 0;
        this.alive    = true;
        this.maturity = 0;   // 0〜1、lifespan×20%で成熟

        this.causeOfDeath = null;
    }

    // ── メイン更新 ────────────────────────────────────────
    update(env, delta) {
        if (!this.alive) return;

        this.age     += delta;
        this.maturity = Math.min(1, this.age / (this.lifespan * 0.2));

        if (this.age >= this.lifespan) {
            this._die('lifespan');
            return;
        }

        const stress = this._calcStress(env);
        if (stress >= 1.0) {
            this._die('environment');
            return;
        }

        this._onUpdate(env, delta, stress);
    }

    // ── エントロピー貢献値（Engineが集約）────────────────
    getEntropyContribution(phi, strain) {
        if (!this.alive) {
            return calcSLocal(phi, strain) * 0.01; // 死体：分解で放出
        }

        const maturityFactor = 0.3 + this.maturity * 0.7;

        if (this.negentropyRate > 0) {
            return -calcSLocal(phi, strain) * this.negentropyRate * maturityFactor;
        }
        if (this.entropyRate > 0) {
            return  calcSLocal(phi, strain) * this.entropyRate    * maturityFactor;
        }
        return 0;
    }

    // ── 環境ストレス（bgf摩擦ベース）────────────────────
    /**
     * 温度 = bgf摩擦として統一的に扱う。
     * bgf=19.15 が情報相関の臨界点（摩擦最小点）。
     * そこから離れるほど指数的にストレスが増大する。
     */
    _calcStress(env) {
        const {
            temp       = 15,
            bgf        = BGF,
            stability  = 1.0,
            strain     = 0,
        } = env;

        // 温度 = bgf摩擦
        const bgfFriction   = Math.abs(temp - bgf) / bgf;
        const frictionStress = Math.pow(bgfFriction, 1.8) * 1.6;

        // Strainストレス（5.5超で発生）
        const strainStress = Math.max(0, (strain - 5.5) / 9.0);

        // 安定性ストレス
        const stabilityStress = Math.max(0, 1 - stability) * 0.5;

        return Math.min(1.0,
            frictionStress + strainStress * 0.7 + stabilityStress
        );
    }

    // ── 死亡処理 ──────────────────────────────────────────
    _die(cause) {
        this.alive        = false;
        this.causeOfDeath = cause;
        this._onDeath(cause);
    }

    // ── サブクラス用フック ────────────────────────────────
    _onUpdate(env, delta, stress) {}
    _onDeath(cause) {}

    // ── スナップショット ───────────────────────────────────
    getSnapshot() {
        return {
            type:         this.type,
            alive:        this.alive,
            age:          +this.age.toFixed(1),
            maturity:     +this.maturity.toFixed(3),
            causeOfDeath: this.causeOfDeath,
            x:            this.x,
            y:            this.y,
        };
    }
}
