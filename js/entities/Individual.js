/**
 * PANDORA EARTH — js/entities/Individual.js
 *
 * 全生命体の基底クラス
 *
 * 役割：
 *   Plant.js / Animal.js が継承する共通インターフェース。
 *   「生きている」「死ぬ」「エントロピーを返す」という
 *   生命の最小単位の振る舞いを定義する。
 *
 * 設計方針：
 *   - 状態を持つ（生死・年齢・位置）
 *   - Entropy.jsの式を使って自分の局所エントロピーを計算する
 *   - getEntropyContribution()でEngineに値を返す
 *   - 継承クラスは _onUpdate() / _onDeath() をオーバーライドする
 *
 * ─────────────────────────────────────────────────────
 * エントロピーフロー：
 *   Individual.getEntropyContribution()
 *     → Engine.js（集約）
 *     → EarthBody.applyEntropy()
 * ─────────────────────────────────────────────────────
 */

import { calcSLocal } from '../core/Entropy.js';

// 生命体の種別
export const ENTITY_TYPE = Object.freeze({
    PLANT:  'plant',
    ANIMAL: 'animal',
});

export class Individual {

    /**
     * @param {object} config
     * @param {string} config.type        - ENTITY_TYPE
     * @param {number} config.lifespan    - 最大寿命（ステップ数）
     * @param {number} config.negentropyRate - 負エントロピー生成率（植物）
     * @param {number} config.entropyRate    - エントロピー消費率（動物）
     * @param {number} [config.x]         - グリッドX座標（将来用）
     * @param {number} [config.y]         - グリッドY座標（将来用）
     */
    constructor(config = {}) {
        this.type    = config.type    ?? ENTITY_TYPE.PLANT;
        this.lifespan = config.lifespan ?? 1000;
        this.negentropyRate = config.negentropyRate ?? 0;
        this.entropyRate    = config.entropyRate    ?? 0;

        // 座標（将来のGrid実装用、今は未使用）
        this.x = config.x ?? 0;
        this.y = config.y ?? 0;

        // 状態
        this.age      = 0;
        this.alive    = true;
        this.maturity = 0;   // 成熟度（0〜1）、成長するほど効果が大きくなる

        // 死因
        this.causeOfDeath = null;
    }

    // ── メイン更新 ────────────────────────────────────────
    /**
     * @param {object} env - { phi, strain, temp, stability }
     * @param {number} delta
     */
    update(env, delta) {
        if (!this.alive) return;

        this.age += delta;

        // 成熟度更新（lifespan の 20% で成熟）
        this.maturity = Math.min(1, this.age / (this.lifespan * 0.2));

        // 寿命チェック
        if (this.age >= this.lifespan) {
            this._die('lifespan');
            return;
        }

        // 環境ストレスチェック
        const stress = this._calcStress(env);
        if (stress >= 1.0) {
            this._die('environment');
            return;
        }

        // サブクラス固有の更新
        this._onUpdate(env, delta, stress);
    }

    // ── エントロピー貢献値を返す（Engineが集約する）────
    /**
     * 正値  = エントロピー増加（動物の消費・死体分解など）
     * 負値  = エントロピー減少（植物の負エントロピー生成）
     *
     * @param {number} phi
     * @param {number} strain
     * @returns {number}
     */
    getEntropyContribution(phi, strain) {
        if (!this.alive) {
            // 死体：エントロピーを放出（分解）
            return calcSLocal(phi, strain) * 0.01;
        }

        const maturityFactor = 0.3 + this.maturity * 0.7; // 未成熟でも30%効果

        if (this.negentropyRate > 0) {
            // 植物：負エントロピー（S を下げる）
            return -calcSLocal(phi, strain) * this.negentropyRate * maturityFactor;
        }

        if (this.entropyRate > 0) {
            // 動物：エントロピー消費（Driveとして蓄積）
            return calcSLocal(phi, strain) * this.entropyRate * maturityFactor;
        }

        return 0;
    }

    // ── 環境ストレス計算（0〜1） ─────────────────────────
    /**
     * サブクラスでオーバーライド可能。
     * デフォルト：温度・安定度から計算
     */
    _calcStress(env) {
        const { temp = 15, stability = 1.0 } = env;

        // 温度ストレス（最適温度15°Cから離れると増加）
        const tempStress = Math.max(0, Math.abs(temp - 15) / 60);

        // 不安定ストレス
        const stabilityStress = Math.max(0, 1 - stability);

        return Math.min(1, tempStress + stabilityStress * 0.5);
    }

    // ── 死亡処理 ──────────────────────────────────────────
    _die(cause) {
        this.alive        = false;
        this.causeOfDeath = cause;
        this._onDeath(cause);
    }

    // ── サブクラス用フック（オーバーライドして使う）────
    /** @param {object} env @param {number} delta @param {number} stress */
    _onUpdate(env, delta, stress) {}

    /** @param {string} cause */
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
