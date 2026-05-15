/**
 * PANDORA EARTH — js/origins/HydrothermalVent.js
 *
 * 熱水噴出孔（生命起源点）
 *
 * Pandora Theory における役割：
 *   Strain≥3.0で地殻に「隙間」ができ、
 *   bgf摩擦が低い局所環境が生まれる。
 *   ここが情報場の「受容体」となり、
 *   最初の自己複製構造（原始生命）の発生点になる。
 *
 * フロー：
 *   Geosphere.ventActive=true
 *     → HydrothermalVent.activate()
 *     → OriginManager が検知
 *     → Biosphere.plantTriggered への橋渡し
 */

import { calcSLocal, calcSCritical } from '../core/Entropy.js';
import { PANDORA_CONST } from '../constants.js';

const BGF = PANDORA_CONST.BGF;

// 噴出孔が生命誕生に必要な最低活性度
const MIN_ACTIVITY_FOR_GENESIS = 0.4;
// 噴出孔の寿命（ステップ数）
const VENT_LIFESPAN = 3000;

export class HydrothermalVent {

    /**
     * @param {object} config
     * @param {number} [config.x=0]   - グリッド座標（将来用）
     * @param {number} [config.y=0]
     * @param {number} [config.depth] - 深度（m）
     */
    constructor(config = {}) {
        this.x        = config.x     ?? 0;
        this.y        = config.y     ?? 0;
        this.depth    = config.depth ?? 2400; // 平均深度

        // 活性状態
        this.active      = false;
        this.activity    = 0;      // 0〜1
        this.age         = 0;
        this.alive       = true;

        // 局所環境（噴出孔周辺）
        this.localTemp   = 80;     // 熱水温度（℃）
        this.localPH     = 9.0;    // アルカリ性（原始生命に適した環境）
        this.chemDensity = 0;      // 化学物質密度（H2S, CH4など）

        // 生命誕生フラグ
        this.genesisReady    = false;
        this.genesisOccurred = false;

        // エントロピー寄与（局所的な負エントロピー生成）
        this._localNegentropy = 0;
    }

    // ── 更新 ──────────────────────────────────────────────
    /**
     * @param {object} bodySnap     - EarthBody.getSnapshot()
     * @param {object} geoSnap      - Geosphere.getSnapshot()
     * @param {number} delta
     */
    update(bodySnap, geoSnap, delta) {
        if (!this.alive) return;

        const { phi, strain, mantleTemp } = bodySnap;
        const { ventActive, ventIntensity } = geoSnap;

        this.age += delta;

        // 寿命チェック
        if (this.age >= VENT_LIFESPAN) {
            this.alive  = false;
            this.active = false;
            return;
        }

        // Geosphereの熱水噴出孔活性に連動
        this.active   = ventActive;
        this.activity = ventIntensity;

        if (!this.active) {
            this.activity    = Math.max(0, this.activity - 0.01 * delta);
            this._localNegentropy = 0;
            return;
        }

        // 局所温度（マントル熱 + 深度による加圧）
        const depthBonus  = this.depth / 10000;
        this.localTemp    = Math.min(400,
            80 + mantleTemp * 0.1 * this.activity + depthBonus * 50
        );

        // 化学物質密度（活性度に比例）
        this.chemDensity  = this.activity * 0.8;

        // bgf摩擦（局所温度とbgfの乖離）
        const bgfFriction = Math.abs(this.localTemp - BGF) / BGF;

        // 局所負エントロピー：
        // 化学勾配が高く、bgf摩擦が小さい場所ほど
        // 「情報の受容体」として機能する
        const chemBoost = this.chemDensity * 0.5;
        const frictionPenalty = bgfFriction * 0.3;
        this._localNegentropy = Math.max(0,
            this.activity * (chemBoost - frictionPenalty) * 0.8
        );

        // 生命誕生準備チェック
        this._checkGenesisReady(phi, strain);
    }

    // ── 生命誕生準備チェック ──────────────────────────────
    /**
     * S_localがS_criticalに近づいている AND
     * 噴出孔が十分活性 AND
     * まだ生命誕生していない
     */
    _checkGenesisReady(phi, strain) {
        if (this.genesisOccurred) return;

        const s_local    = calcSLocal(phi, strain);
        const s_critical = calcSCritical(strain);
        const saturation = s_critical > 0 ? s_local / s_critical : 0;

        // 過飽和度0.7以上 + 活性度0.4以上 = 生命誕生準備完了
        this.genesisReady = (
            saturation >= 0.7 &&
            this.activity >= MIN_ACTIVITY_FOR_GENESIS &&
            this.chemDensity >= 0.3
        );
    }

    // ── 生命誕生実行（OriginManagerから呼ばれる）─────────
    triggerGenesis() {
        if (!this.genesisReady || this.genesisOccurred) return false;
        this.genesisOccurred = true;
        this.genesisReady    = false;
        return true;
    }

    // ── エントロピー寄与 ──────────────────────────────────
    getLocalNegentropy() {
        return -this._localNegentropy; // 負値（局所でS_localを下げる）
    }

    getSnapshot() {
        return {
            x:               this.x,
            y:               this.y,
            active:          this.active,
            activity:        +this.activity.toFixed(3),
            age:             +this.age.toFixed(1),
            alive:           this.alive,
            localTemp:       +this.localTemp.toFixed(1),
            localPH:         +this.localPH.toFixed(2),
            chemDensity:     +this.chemDensity.toFixed(3),
            genesisReady:    this.genesisReady,
            genesisOccurred: this.genesisOccurred,
            localNegentropy: +this._localNegentropy.toFixed(4),
        };
    }
}
