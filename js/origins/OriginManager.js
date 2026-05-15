/**
 * PANDORA EARTH — js/origins/OriginManager.js
 *
 * 生命起源・多点発生管理
 *
 * Pandora Theory における多点発生説：
 *   生命は単一の「奇跡」ではなく、
 *   情報場が過飽和に達した時に
 *   エントロピーが低い複数の場所で「同時多発」する。
 *
 * 役割：
 *   - HydrothermalVentを複数管理する
 *   - 各噴出孔のgenesisReadyを監視
 *   - 最初の genesis → Biosphere.onPhysicalShock() ではなく
 *     Engine経由でBiosphereの植物誕生トリガーに繋げる
 *   - 大気雷（Atmosphere.lightningEvent）も起源点として管理
 *
 * フロー：
 *   HydrothermalVent.genesisReady
 *     → OriginManager.update()
 *     → { type: 'vent_genesis' | 'lightning_genesis' }
 *     → Engine._onOriginEvent()
 *     → Biosphere（植物誕生を早期化）
 */

import { HydrothermalVent } from './HydrothermalVent.js';

// 初期噴出孔の数
const INITIAL_VENTS     = 3;
// 新規噴出孔が生まれる確率（Strainが高いほど増加）
const VENT_SPAWN_BASE   = 0.0002;
// 噴出孔の最大数
const MAX_VENTS         = 12;

export class OriginManager {

    constructor(config = {}) {
        // 熱水噴出孔群
        this.vents = [];
        for (let i = 0; i < INITIAL_VENTS; i++) {
            this.vents.push(new HydrothermalVent({
                x: Math.floor(Math.random() * 72), // グリッド座標（将来用）
                y: Math.floor(Math.random() * 36),
                depth: 1500 + Math.random() * 2000,
            }));
        }

        // 起源イベント履歴
        this.originEvents  = [];
        this.genesisCount  = 0; // 生命誕生回数（多点発生カウント）

        // 大気雷による起源（Atmosphereと連携）
        this.lightningGenesisReady = false;

        // 最初の生命誕生が完了したか
        this.firstGenesisOccurred = false;
    }

    // ── メイン更新 ────────────────────────────────────────
    /**
     * @param {object} bodySnap  - EarthBody.getSnapshot()
     * @param {object} geoSnap   - Geosphere.getSnapshot()
     * @param {object} atmoSnap  - Atmosphere.getSnapshot()
     * @param {number} delta
     * @returns {object|null}    - 起源イベント or null
     */
    update(bodySnap, geoSnap, atmoSnap, delta) {
        const { strain } = bodySnap;

        // 1. 既存噴出孔を更新
        for (const vent of this.vents) {
            vent.update(bodySnap, geoSnap, delta);
        }

        // 2. 死んだ噴出孔を除去
        this.vents = this.vents.filter(v => v.alive);

        // 3. 新規噴出孔の自然発生（Strainが高いほど確率UP）
        if (this.vents.length < MAX_VENTS) {
            const spawnProb = VENT_SPAWN_BASE * (strain / 5.0) * delta;
            if (Math.random() < spawnProb) {
                this.vents.push(new HydrothermalVent({
                    x: Math.floor(Math.random() * 72),
                    y: Math.floor(Math.random() * 36),
                    depth: 1000 + Math.random() * 3000,
                }));
            }
        }

        // 4. 生命誕生チェック（噴出孔）
        for (const vent of this.vents) {
            if (vent.genesisReady && !this.firstGenesisOccurred) {
                const success = vent.triggerGenesis();
                if (success) {
                    return this._onGenesis('vent', vent);
                }
            }
        }

        // 5. 大気雷による生命誕生チェック
        if (atmoSnap.lightningEvent && !this.firstGenesisOccurred) {
            this.lightningGenesisReady = true;
            return this._onGenesis('lightning', null);
        }

        // 6. 多点発生チェック（最初の誕生後も続く）
        if (this.firstGenesisOccurred) {
            const readyVents = this.vents.filter(v =>
                v.genesisReady && !v.genesisOccurred
            );
            if (readyVents.length > 0) {
                const vent = readyVents[0];
                vent.triggerGenesis();
                this.genesisCount++;
                return this._onMultiGenesis(vent);
            }
        }

        return null;
    }

    // ── 最初の生命誕生 ────────────────────────────────────
    _onGenesis(source, vent) {
        this.firstGenesisOccurred = true;
        this.genesisCount++;

        const event = {
            type:    'first_genesis',
            source,  // 'vent' | 'lightning'
            x:       vent?.x ?? -1,
            y:       vent?.y ?? -1,
            message: source === 'vent'
                ? `熱水噴出孔(${vent.x},${vent.y})で最初の生命誕生`
                : '大気雷放電により最初の生命誕生',
        };

        this.originEvents.push(event);
        return event;
    }

    // ── 多点発生（2回目以降）────────────────────────────────
    _onMultiGenesis(vent) {
        const event = {
            type:    'multi_genesis',
            source:  'vent',
            x:       vent.x,
            y:       vent.y,
            message: `多点発生 #${this.genesisCount} — (${vent.x},${vent.y})`,
        };
        this.originEvents.push(event);
        if (this.originEvents.length > 50) this.originEvents.shift();
        return event;
    }

    // ── 全噴出孔の局所負エントロピー合計 ─────────────────
    // Engine経由でEarthBodyに渡す
    getTotalNegentropy() {
        return this.vents.reduce((sum, v) => sum + v.getLocalNegentropy(), 0);
    }

    getSnapshot() {
        return {
            ventCount:            this.vents.length,
            activeVents:          this.vents.filter(v => v.active).length,
            genesisCount:         this.genesisCount,
            firstGenesisOccurred: this.firstGenesisOccurred,
            vents:                this.vents.map(v => v.getSnapshot()),
            recentEvents:         [...this.originEvents].slice(-3),
        };
    }
}
