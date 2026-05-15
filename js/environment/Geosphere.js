/**
 * PANDORA EARTH — js/environment/Geosphere.js
 *
 * 地殻・プレート・火山活動
 *
 * 役割：
 *   - プレート運動によるStrain蓄積への寄与
 *   - 火山活動によるエントロピー放出
 *   - 熱水噴出孔（生命起源点）の活性化状態管理
 *   - convertRaw()経由でEngineにエントロピー値を渡す
 *
 * フロー：
 *   Geosphere.getEntropyContribution()
 *     → Engine集約 → EarthBody.applyEntropy()
 */

import { convertRaw } from '../core/Entropy.js';
import { PANDORA_CONST } from '../constants.js';

const BGF = PANDORA_CONST.BGF; // 19.15

// プレート活動サイクル（ステップ数）
const PLATE_CYCLE    = 800;
// 火山活動の最大エントロピー放出
const VOLCANO_MAX    = 3.5;
// 熱水噴出孔の活性閾値（Strain）
const VENT_THRESHOLD = 3.0;

export class Geosphere {

    constructor(config = {}) {
        // プレート運動
        this.plateActivity  = config.plateActivity  ?? 0.5;  // 0〜1
        this.platePhase     = 0;   // サイクル位相
        this.plateCycle     = PLATE_CYCLE;

        // 火山活動
        this.volcanicLevel  = 0;   // 0〜1
        this.volcanicEvent  = null; // 'eruption' | 'dormant' | null

        // 熱水噴出孔
        this.ventActive     = false;
        this.ventIntensity  = 0;

        // エントロピー寄与値（最新）
        this._contribution  = 0;
    }

    // ── 更新 ──────────────────────────────────────────────
    update(bodySnap, delta) {
        const { strain, phi } = bodySnap;

        // 1. プレート運動サイクル
        this.platePhase = (this.platePhase + delta / this.plateCycle) % 1;
        // サイン波でプレート活動が周期的に変化
        const platePulse = 0.5 + 0.5 * Math.sin(this.platePhase * Math.PI * 2);
        this.plateActivity = 0.3 + platePulse * 0.7;

        // 2. 火山活動（Strainが高いほど活発）
        this.volcanicLevel = Math.min(1, strain / 8.0) * this.plateActivity;
        this.volcanicEvent = this.volcanicLevel > 0.75 ? 'eruption'
                           : this.volcanicLevel > 0.3  ? 'active'
                           : 'dormant';

        // 3. 熱水噴出孔（Strain≥3.0で活性化）
        this.ventActive    = strain >= VENT_THRESHOLD;
        this.ventIntensity = this.ventActive
            ? Math.min(1, (strain - VENT_THRESHOLD) / 4.0)
            : 0;

        // 4. 生のエントロピー値を計算
        const rawVolcanic = this.volcanicLevel * VOLCANO_MAX;
        const rawVent     = this.ventIntensity * 1.2;
        const raw         = rawVolcanic + rawVent;

        // 5. Entropy.convertRaw()で情報場影響値に変換
        this._contribution = convertRaw(raw, { phi, strain });
    }

    // ── Engine集約用 ──────────────────────────────────────
    getEntropyContribution() {
        return this._contribution;
    }

    getSnapshot() {
        return {
            plateActivity:  +this.plateActivity.toFixed(3),
            volcanicLevel:  +this.volcanicLevel.toFixed(3),
            volcanicEvent:  this.volcanicEvent,
            ventActive:     this.ventActive,
            ventIntensity:  +this.ventIntensity.toFixed(3),
            contribution:   +this._contribution.toFixed(4),
        };
    }
}
