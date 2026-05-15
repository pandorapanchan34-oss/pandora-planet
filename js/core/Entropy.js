/**
 * PANDORA EARTH — js/core/Entropy.js
 *
 * 純粋変換エンジン（状態を持たない）
 *
 * 役割：
 *   生のエントロピー値を bgf・Strain・Φ を考慮して
 *   「意味のある値」に変換する計算式のみを提供する。
 *   状態管理は Biosphere.js が担当する。
 *
 * 依存：constants.js のみ
 * 状態：なし（全関数がpure function）
 *
 * ─────────────────────────────────────────────────────
 * 基本式（Pandora Theory）
 *
 *   S_local    = B × ln(bgf / |Φ - Φ_c|) × Strain
 *   S_critical = B × ln(bgf) × (1 / √Strain)
 *   Saturation = S_local / S_critical
 *
 * 植物誕生条件：
 *   S_local > S_critical && Strain >= 5.0
 * ─────────────────────────────────────────────────────
 */

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

// ── 定数 ──────────────────────────────────────────────────
const B     = PANDORA_CONST.B;           // 24.0（D₄格子定数）
const BGF   = PANDORA_CONST.BGF;         // 19.15
const PHI_C = PANDORA_DERIVED.PHI_IDEAL; // 5/6 ≈ 0.8333

// 各閾値（外部参照用にexport）
export const STRAIN_PLANT_THRESHOLD  = 5.0;   // 植物誕生Strain閾値
export const STRAIN_RELEASE_THRESHOLD = 10.0; // Strain解放（Cascade）閾値
export const S_CRITICAL_FLOOR        = 0.12;  // S_criticalの下限
export const S_MARGIN_ANIMAL         = 2.2;   // 動物誕生に必要なS_margin

// ── 変換関数群（pure functions）─────────────────────────

/**
 * 局所エントロピーを計算する
 * S_local = B × ln(bgf / |Φ - Φ_c|) × Strain
 *
 * @param {number} phi    - 現在のΦ
 * @param {number} strain - 現在のStrain
 * @returns {number} S_local
 */
export function calcSLocal(phi, strain) {
    if (strain <= 0) return 0;
    const gap = Math.max(Math.abs(phi - PHI_C), 1e-6);
    const s = B * Math.log(BGF / gap) * strain;
    return Math.max(0, s);
}

/**
 * 臨界エントロピーを計算する
 * S_critical = B × ln(bgf) × (1 / √Strain)
 *
 * Strain < 5.0：高い値を保つ（不毛の時代、何も起きない）
 * Strain >= 5.0：急降下してS_localと交差（クロスオーバー）
 *
 * @param {number} strain - 現在のStrain
 * @returns {number} S_critical
 */
export function calcSCritical(strain) {
    const s = B * Math.log(BGF) * (1 / Math.sqrt(Math.max(strain, 0.5)));
    return Math.max(s, S_CRITICAL_FLOOR);
}

/**
 * 過飽和度（Saturation）を計算する
 * Saturation = S_local / S_critical
 * 1.0を超えると植物誕生圏に入る
 *
 * @param {number} s_local
 * @param {number} s_critical
 * @returns {number} saturation
 */
export function calcSaturation(s_local, s_critical) {
    if (s_critical <= 0) return 0;
    return s_local / s_critical;
}

/**
 * 植物誕生条件を判定する
 *
 * @param {number} s_local
 * @param {number} s_critical
 * @param {number} strain
 * @returns {boolean}
 */
export function isPlantTrigger(s_local, s_critical, strain) {
    return strain >= STRAIN_PLANT_THRESHOLD && s_local > s_critical;
}

/**
 * 動物誕生条件を判定する
 *
 * @param {number} s_margin  - 蓄積された余裕リソース
 * @param {boolean} hasPlant - 植物が存在するか
 * @returns {boolean}
 */
export function isAnimalTrigger(s_margin, hasPlant) {
    return hasPlant && s_margin >= S_MARGIN_ANIMAL;
}

/**
 * 外部環境（地殻・気象・海洋など）からの生のエントロピー値を
 * bgf・Φ・Strainを考慮して「情報場への影響値」に変換する
 *
 * 使い方：
 *   Geosphere.js → raw値を返す
 *   Entropy.convertRaw(raw, { phi, strain }) → Engine.jsに渡す
 *
 * @param {number} raw    - 生のエントロピー値
 * @param {object} state  - { phi, strain }
 * @returns {number}      - 変換後の値（Φへの影響量）
 */
export function convertRaw(raw, { phi, strain }) {
    if (raw === 0) return 0;
    // bgfとの乖離度で増幅（bgf付近では摩擦最小）
    const bgfFactor = 1 + Math.abs(phi - PHI_C) * strain / BGF;
    return raw * bgfFactor;
}

/**
 * 植物誕生直後のS_local急落値を計算する
 * 「デフラグ開始の瞬間」= 72%急落
 *
 * @param {number} s_local - 誕生直前のS_local
 * @returns {number}       - 急落後のS_local
 */
export function calcPlantGenesisReset(s_local) {
    return s_local * 0.28;
}

/**
 * 植物の冷却効果を計算する（1ステップあたり）
 * 冷却期間中、徐々に弱まる効果
 *
 * @param {number} s_local       - 現在のS_local
 * @param {number} coolingRatio  - 残り冷却期間の割合（0〜1）
 * @returns {number}             - 減少量（delta S）
 */
export function calcCoolingEffect(s_local, coolingRatio) {
    const rate = 0.018 * coolingRatio;
    return s_local * rate;
}

/**
 * 植物安定期のS_margin蓄積量を計算する
 *
 * @param {number} s_critical
 * @param {number} s_local
 * @param {number} delta
 * @returns {number} - 蓄積量
 */
export function calcMarginAccumulation(s_critical, s_local, delta) {
    const margin = s_critical - s_local;
    if (margin <= 0) return 0;
    return margin * 0.8 * delta;
}
