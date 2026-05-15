/**
 * PANDORA EARTH — js/core/EarthBody.js
 *
 * 惑星物理本体（地殻・Φ・Strain管理）
 *
 * 役割：
 *   - Φ・Strain・マントル温度の物理演算
 *   - Biosphereからの負エントロピーを受け取りΦに反映（applyEntropy）
 *   - Strain解放イベントの検知と実行
 *   - Cascade後の安定期管理
 *
 * Strain設計：
 *   0〜5  : 蓄積期（不毛の時代）
 *   5.0   : 植物誕生トリガー圏（Biosphere側で検知）
 *   5〜10 : 植物デフラグ期
 *   10.0  : Cascade臨界（解放イベント）
 *
 * 更新はEngine.jsから呼ばれる。
 * 北極吸収 / 南極排出の基本ロジック。
 * 惑星固有の値は config/planets/*.js から注入される。
 */

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

// Strain解放閾値
const STRAIN_RELEASE_MAX   = 10.0;  // Cascade臨界
const STRAIN_RELEASE_MINOR = 7.0;   // 小規模解放（地震・火山）
// Cascade後の安定期（ステップ数）
const STABILITY_PERIOD     = 300;

export class EarthBody {

    constructor(config = {}) {

        // ── 惑星固有パラメータ（config注入）──────────────
        this.phi          = config.initialPhi       ?? PANDORA_CONST.PHI_EARTH;
        this.mantleDepth  = config.mantleDepth      ?? 2886;
        this.coreRadius   = config.coreRadius       ?? 3485;
        this.surfaceArea  = config.surfaceArea      ?? 5.1e14;
        this.gravityScale = config.gravityScale     ?? 1.0;

        // ── 状態変数 ──────────────────────────────────────
        this.strain           = 0;
        this.entropyInflow    = 0;
        this.entropyOutflow   = 0;
        this.netEntropy       = 0;
        this.mantleTemp       = config.initialMantleTemp ?? 1300;
        this.phiGap           = 0;
        this.dischargeRate    = 0;
        this.isDischargeBlocked = false;

        // ── Strain解放管理 ────────────────────────────────
        this.releaseEvent     = null;   // 直近の解放イベント種別
        this.releaseCount     = 0;      // 累積解放回数
        // Cascade後安定期
        this.stabilityTimer   = 0;
        this.inStabilityPeriod = false;

        // ── 外部エントロピー蓄積（Biosphereから）─────────
        this._pendingEntropy  = 0;

        // ── 履歴 ──────────────────────────────────────────
        this._strainHistory   = [];
        this._maxHistory      = 60;
    }

    // ── 1ステップ更新 ─────────────────────────────────────
    update(delta = 1) {

        // 安定期カウントダウン
        if (this.inStabilityPeriod) {
            this.stabilityTimer--;
            if (this.stabilityTimer <= 0) {
                this.inStabilityPeriod = false;
            }
        }

        // 1. 北極からのエントロピー吸収（重力勾配）
        this.entropyInflow =
            PANDORA_CONST.B * (1 - this.phi) * 0.01 * this.gravityScale;

        // 2. Φ→Strain非線形変換（Pandora Theory）
        //
        // 【安定領域】Φ ≤ PHI_IDEAL(0.833)：歪みは自然減衰
        // 【過飽和領域】Φ > PHI_IDEAL  ：情報の重みで指数的に跳ね上がる
        //   overflow = (Φ - 0.833) / (1.0 - 0.833)
        //   targetStrain = overflow^2 × 10.0
        //   → Φ=0.93でStrain≈5.0（植物誕生圏）
        //   → Φ=1.00でStrain=10.0（Cascade臨界）
        const PHI_IDEAL = PANDORA_CONST.PHI_IDEAL; // 0.8333
        const PHI_MAX   = 1.0;
        const depthFactor = this.mantleDepth / 2886;

        this.phiGap = Math.abs(this.phi - PHI_IDEAL);

        if (this.phi <= PHI_IDEAL) {
            // 安定領域：歪みは徐々に解消
            this.strain = Math.max(0, this.strain - 0.01 * delta);
        } else {
            // 過飽和領域：指数的跳ね上がり
            const overflow     = (this.phi - PHI_IDEAL) / (PHI_MAX - PHI_IDEAL);
            const targetStrain = Math.pow(overflow, 2) * 10.0 * depthFactor;
            // 慣性（急激な変化に追従、衝撃表現）
            this.strain += (targetStrain - this.strain) * 0.1 * delta;
        }
        this.strain = Math.max(0, Math.min(10.0, this.strain));

        // 3. 南極からの排出
        this.dischargeRate =
            Math.min(1.0, PANDORA_DERIVED.DISCHARGE_BAND / Math.max(0.1, this.strain));
        this.entropyOutflow = this.strain * 0.05 * this.dischargeRate;

        // 4. 正味エントロピー
        this.netEntropy = this.entropyInflow - this.entropyOutflow;

        // 5. マントル温度更新
        const bgfTemp  = PANDORA_DERIVED.BGF;
        const heatGain = this.netEntropy * 12.0;
        const heatLoss = (this.mantleTemp - bgfTemp) * 0.002;
        this.mantleTemp += (heatGain - heatLoss) * delta;
        this.mantleTemp  = Math.max(-50, Math.min(2000, this.mantleTemp));

        // 6. 放電不足検出
        this.isDischargeBlocked =
            this.strain > PANDORA_DERIVED.DISCHARGE_BAND * 2;

        // 7. Strain解放イベント検知
        this.releaseEvent = this._checkStrainRelease();

        // 8. 履歴記録
        this._strainHistory.push(+this.strain.toFixed(3));
        if (this._strainHistory.length > this._maxHistory) {
            this._strainHistory.shift();
        }

        return this;
    }

    // ── Strain解放イベント検知 ────────────────────────────
    /**
     * Strainが閾値を超えた時に解放イベントを発行する。
     * 解放後はStrainを減少させ、安定期に入る。
     *
     * @returns {string|null} イベント種別
     */
    _checkStrainRelease() {
        // 安定期中は解放なし
        if (this.inStabilityPeriod) return null;

        // 大規模解放（Cascade臨界）
        if (this.strain >= STRAIN_RELEASE_MAX) {
            this._executeRelease('cascade', 0.85); // Strainを85%削減
            return 'cascade';
        }

        // 小規模解放（地震・火山活動）
        if (this.strain >= STRAIN_RELEASE_MINOR) {
            this._executeRelease('minor', 0.35); // Strainを35%削減
            return 'minor';
        }

        return null;
    }

    // ── Strain解放実行 ────────────────────────────────────
    /**
     * @param {string} type      - 'cascade' | 'minor'
     * @param {number} reduction - Strain削減率（0〜1）
     */
    _executeRelease(type, reduction) {
        this.releaseCount++;

        // Φを解放に合わせて引き戻す（過飽和の圧力を逃がす）
        const phiRebound = type === 'cascade' ? 0.03 : 0.008;
        this.phi = Math.max(0.01, this.phi - phiRebound);

        // マントル温度を急上昇（解放エネルギー）
        this.mantleTemp += type === 'cascade' ? 150 : 40;

        // 安定期に入る
        this.inStabilityPeriod = true;
        this.stabilityTimer    = type === 'cascade'
            ? STABILITY_PERIOD
            : Math.floor(STABILITY_PERIOD * 0.3);
    }

    // ── Biosphereからの負エントロピー適用 ─────────────────
    /**
     * 植物の負エントロピーをΦに反映する。
     * Engine.jsが毎フレーム呼ぶ。
     *
     * 負値（植物）→ Φを擬似的に抑制（デフラグ効果）
     * 正値（分解）→ Φを微増
     *
     * @param {number} entropyDelta - Biosphere.update()が返すentropyDelta
     */
    applyEntropy(entropyDelta) {
        if (entropyDelta === 0) return;

        // エントロピーδをΦ変化に変換
        // 負エントロピー（植物）はΦを臨界点方向に引き戻す
        const phiDelta = -entropyDelta * 0.0005;
        this.phi = Math.max(0.01, Math.min(1.05, this.phi + phiDelta));
    }

    // ── Φを外部から更新（Engine.jsから）─────────────────
    setPhi(phi) {
        // 0.99の壁を解放。1.05まで許容（過飽和→ブラックホール化への道）
        this.phi = Math.max(0.01, Math.min(1.05, phi));
    }

    // ── 安定性スコア（0〜1）──────────────────────────────
    get stability() {
        if (this.inStabilityPeriod) return 1.0; // 安定期は最大安定
        return Math.max(0, 1 - this.strain / STRAIN_RELEASE_MAX);
    }

    // ── スナップショット ──────────────────────────────────
    getSnapshot() {
        return {
            phi:                +this.phi.toFixed(4),
            phiGap:             +this.phiGap.toFixed(4),
            strain:             +this.strain.toFixed(4),
            entropyInflow:      +this.entropyInflow.toFixed(4),
            entropyOutflow:     +this.entropyOutflow.toFixed(4),
            netEntropy:         +this.netEntropy.toFixed(4),
            mantleTemp:         +this.mantleTemp.toFixed(2),
            dischargeRate:      +this.dischargeRate.toFixed(4),
            isDischargeBlocked: this.isDischargeBlocked,
            strainHistory:      [...this._strainHistory],
            // ── 追加 ──────────────────────────────────────
            stability:          +this.stability.toFixed(3),
            releaseEvent:       this.releaseEvent,
            releaseCount:       this.releaseCount,
            inStabilityPeriod:  this.inStabilityPeriod,
            stabilityTimer:     this.stabilityTimer,
            // bgfをsnapshotに含める（Individual._calcStressが参照）
            bgf:                PANDORA_DERIVED.BGF ?? 19.15,
        };
    }
}
