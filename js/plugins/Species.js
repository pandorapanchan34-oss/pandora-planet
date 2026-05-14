// ============================================================
// PANDORA EARTH — js/plugins/Species.js
// 生命・文明の基底ロジック（カスタム拡張スロット）
//
// 惑星の環境（Climate）に適応し、Φを更新し、
// Drive（負荷）を発生させる。
//
// このクラスを継承して独自の知性体・進化系統を定義できる。
// 例: class AquaticSpecies extends Species { ... }
// ============================================================

import { PANDORA_CONST } from '../constants.js';

export class Species {

  constructor(config = {}) {

    // ── 基本定義 ──────────────────────────────────────────
    this.name = config.name || 'Unknown Life';

    // ── 生命パラメータ ────────────────────────────────────
    this.population   = config.initialPop   ?? 0.1;  // 人口密度（0〜1）
    this.biodiversity = 0.1;                          // 多様性（ノイズ保護機能）
    this.techLevel    = 0.0;                          // 文明度（0〜1）
    this.drive        = 0.0;                          // 惑星への帯域負荷

    // ── 遺伝的特性（プラグイン設定）──────────────────────
    this.adaptationRange = config.adaptationRange ?? [10, 30]; // 生存可能温度域 [min, max]
    this.writeoutEff     = config.writeoutEff     ?? 0.002;    // 情報書き出し効率
    this.growthRate      = config.growthRate      ?? 0.001;    // 基本成長率
    this.techThreshold   = config.techThreshold   ?? 0.5;      // 文明化に必要な多様性閾値

    // ── 状態 ──────────────────────────────────────────────
    this.isExtinct       = false;
    this.extinctionCause = null;
    this._age            = 0;       // 種の年齢（ステップ数）
    this._phaseLog       = [];      // フェーズ履歴
  }

  // ── 1ステップ更新 ─────────────────────────────────────
  /**
   * @param {object} climateSnapshot Climate.getSnapshot()
   * @param {object} bodySnapshot    EarthBody.getSnapshot()
   * @param {number} delta
   * @returns {number} deathWriteout — Φに加算する情報還流量
   */
  update(climateSnapshot, bodySnapshot, delta = 1) {

    if (this.isExtinct) return 0;

    this._age++;
    const { surfaceTemp, stability, isExtreme } = climateSnapshot;
    const { phi, strain, isDischargeBlocked }   = bodySnapshot;

    // 1. 環境適応度
    //    適応温度範囲外だと生命活動が大幅低下
    const inRange   =
      surfaceTemp >= this.adaptationRange[0] &&
      surfaceTemp <= this.adaptationRange[1];
    const envFactor = inRange ? 1.0 : 0.2;

    // 2. 生命活動（多様性・人口の成長）
    //    stability が高いほど成長加速
    //    isDischargeBlocked 時は成長が抑制（断崖状態）
    const dischargeDebuff = isDischargeBlocked ? 0.3 : 1.0;
    const growth =
      this.growthRate * stability * envFactor * dischargeDebuff * delta;

    this.biodiversity = Math.min(1.0, Math.max(0,
      this.biodiversity + growth - (isExtreme ? 0.005 : 0)
    ));
    this.population = Math.min(1.0, Math.max(0,
      this.population + growth * 1.5 - (strain > 12 ? 0.002 : 0)
    ));

    // 3. 文明の進展（Sapient Trigger）
    //    Φが理想値(5/6)に近づき、多様性が閾値を超えると技術向上
    if (phi > 0.8 && this.biodiversity > this.techThreshold) {
      this.techLevel = Math.min(1.0,
        this.techLevel + 0.002 * delta
      );
    }

    // 4. Drive（帯域負荷）の発生
    //    人口 × 技術レベルの積が惑星への Strain を加速
    //    ← ClimateSystem と EarthBody に注入される
    this.drive = this.population * this.techLevel;

    // 5. 絶滅チェック
    this._checkExtinction(climateSnapshot, bodySnapshot);
    if (this.isExtinct) return 0;

    // 6. 【Pandora核心】死による情報の書き出し
    //    この戻り値を Engine.js 経由で EarthBody.phi に加算
    return this.calculateDeathWriteout(phi, delta);
  }

  // ── Pandora理論：死による情報還流 ────────────────────
  /**
   * Φが5/6を超えた過飽和状態では個体の寿命が短くなり、
   * 情報の書き出し頻度が上昇する（Cambrian Engine と同一構造）
   *
   * @param {number} currentPhi
   * @param {number} delta
   * @returns {number} 還流する情報密度
   */
  calculateDeathWriteout(currentPhi, delta) {
    const phi_c = PANDORA_CONST.PHI_IDEAL;  // 5/6

    // ζ（ゼータ）: 過飽和度（0以下はカット）
    const zeta = Math.max(0, (currentPhi / phi_c) - 1);

    // 寿命係数: 密度が上がるほど個体の情報保持期間が短くなる
    // TAU が「情報の摩耗率」として機能
    const lifespanFactor = Math.pow(1 - PANDORA_CONST.TAU, zeta);

    // 実際に還流される情報密度
    return this.biodiversity * this.writeoutEff * lifespanFactor * delta;
  }

  // ── 絶滅チェック ─────────────────────────────────────
  _checkExtinction(climateSnap, bodySnap) {
    if (this.population < 0.01) {
      this.isExtinct       = true;
      this.extinctionCause = 'POPULATION_COLLAPSE';
      return;
    }
    if (climateSnap.surfaceTemp > 70 || climateSnap.surfaceTemp < -40) {
      this.isExtinct       = true;
      this.extinctionCause = 'THERMAL_EXTINCTION';
      return;
    }
    if (bodySnap.strain > 18) {
      this.isExtinct       = true;
      this.extinctionCause = 'STRAIN_COLLAPSE';
    }
  }

  // ── スナップショット ──────────────────────────────────
  getSnapshot() {
    return {
      name:            this.name,
      population:      +this.population.toFixed(3),
      biodiversity:    +this.biodiversity.toFixed(3),
      techLevel:       +this.techLevel.toFixed(3),
      drive:           +this.drive.toFixed(4),
      isExtinct:       this.isExtinct,
      extinctionCause: this.extinctionCause,
      age:             this._age,
    };
  }
}

// ── 拡張スロット例（継承テンプレート）──────────────────────
//
// export class AquaticSpecies extends Species {
//   constructor(config = {}) {
//     super({ ...config, adaptationRange: [5, 25], writeoutEff: 0.003 });
//     this.name = config.name || 'Aquatic Life';
//   }
//   // 水中生命独自のロジックをオーバーライド
// }
//
// export class SiliconSpecies extends Species {
//   constructor(config = {}) {
//     super({ ...config, adaptationRange: [200, 800], writeoutEff: 0.0005 });
//     this.name = config.name || 'Silicon Life';
//   }
// }
