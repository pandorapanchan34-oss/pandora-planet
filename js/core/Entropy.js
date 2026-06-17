/**
 * PANDORA EARTH — js/core/Entropy.js (量子ゆらぎ・確率創発マウント版)
 *
 * 役割：
 * 純粋変換エンジンに微小な「環境ノイズ（創造的ゆらぎ）」を注入し、
 * 決定論的な確定絶滅ループを破壊して、実行ごとに異なる進化の分岐（宇宙）を生み出す。
 */

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

const B     = PANDORA_CONST.B;           // 24.0
const BGF   = PANDORA_CONST.BGF;         // 19.15
const PHI_C = PANDORA_DERIVED.PHI_IDEAL; // 5/6 ≈ 0.8333

export const STRAIN_PLANT_THRESHOLD  = 5.0;   
export const STRAIN_RELEASE_THRESHOLD = 10.0; 
export const S_CRITICAL_FLOOR        = 0.12;  
export const S_MARGIN_ANIMAL         = 2.2;   

/**
 * 局所エントロピーに微小な熱ゆらぎを付与
 */
export function calcSLocal(phi, strain) {
    if (strain <= 0) return 0;
    const gap = Math.max(Math.abs(phi - PHI_C), 1e-6);
    
    // 🎲 決定論を壊す：情報場の局所的な不均一性（±1.5%のランダムゆらぎ）をブレンド
    const quantumFluctuation = 0.985 + (Math.random() * 0.03);
    
    const s = B * Math.log(BGF / gap) * strain * quantumFluctuation;
    return Math.max(0, s);
}

export function calcSCritical(strain) {
    const s = B * Math.log(BGF) * (1 / Math.sqrt(Math.max(strain, 0.5)));
    return Math.max(s, S_CRITICAL_FLOOR);
}

export function calcSaturation(s_local, s_critical) {
    if (s_critical <= 0) return 0;
    return s_local / s_critical;
}

/**
 * 植物誕生判定（確率的創発への相転移）
 */
export function isPlantTrigger(s_local, s_critical, strain) {
    // 🎲 決定論を壊す：条件を満たしていても、受肉に失敗するかどうかの確率的障壁（ダイスロール）を設置
    // ゆりかご圏内において、毎フレーム 8.5% の確率をくぐり抜けた奇跡の瞬間だけ生命が芽吹く
    const strainCondition = strain >= STRAIN_PLANT_THRESHOLD && strain <= 8.5 && s_local > 0;
    return strainCondition && (Math.random() < 0.085);
}

/**
 * 動物誕生判定（確率的ダイスロール）
 */
export function isAnimalTrigger(s_margin, hasPlant) {
    // 🎲 決定論を壊す：リソースが溜まった瞬間に確定で生まれるのではなく、12% の確率の波を引いた時に受肉
    return hasPlant && s_margin >= S_MARGIN_ANIMAL && (Math.random() < 0.12);
}

/**
 * 環境エントロピーの変換にカオス伝導率をインジェクト
 */
export function convertRaw(raw, { phi, strain }) {
    if (raw === 0) return 0;
    
    // 🎲 決定論を壊す：大気や地殻の対流の「不規則性」を再現
    const chaosFactor = 0.9 + (Math.random() * 0.25); // 0.9 〜 1.15 の間で毎フレーム激変
    
    const bgfFactor = 1 + Math.abs(phi - PHI_C) * strain / BGF;
    return raw * bgfFactor * chaosFactor;
}

export function calcPlantGenesisReset(s_local) {
    // 🎲 減少幅にもゆらぎ（25%〜32%のランダムリセット）を持たせる
    const resetRate = 0.25 + (Math.random() * 0.07);
    return s_local * resetRate;
}

export function calcCoolingEffect(s_local, coolingRatio) {
    const rate = 0.018 * coolingRatio;
    return s_local * rate;
}

export function calcMarginAccumulation(s_critical, s_local, delta) {
    const margin = s_critical - s_local;
    if (margin <= 0) return 0;
    return margin * 0.8 * delta;
}
