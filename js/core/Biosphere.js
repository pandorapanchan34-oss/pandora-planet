// ============================================================
// PANDORA EARTH — js/core/EarthBody.js
// マントル・エントロピー流・重力
//
// 北極吸収 / 南極排出の基本ロジック。
// 全惑星共通の「物理現象」。
// 惑星固有の値は config/planets/*.js から注入される。
//
// 【更新履歴】
//   v1 : 初期実装（対称Strain計算）
//   v2 : Φ×Strain 非線形相関（過飽和領域で指数爆増）
//   v3 : ブラックホール化ロジック追加、Events.js連携
// ============================================================

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';
import { Events, EVENT } from './Events.js';

// ── 物理定数 ────────────────────────────────────────────────
const PHI_IDEAL  = 0.8333;  // 理想状態（調和点）
const PHI_MAX    = 1.0000;  // 情報過飽和臨界（これ以上は特異点）
const STRAIN_MAX = 10.0;    // Strain上限（これ以上は物理崩壊）


export class EarthBody {

  // ============================================================
  // コンストラクタ
  // ============================================================
  constructor(config = {}) {

    // ── 惑星固有パラメータ（config注入）──────────────────
    this.phi          = config.initialPhi         ?? PANDORA_CONST.PHI_EARTH;
    this.mantleDepth  = config.mantleDepth        ?? 2886;   // km（地球デフォルト）
    this.coreRadius   = config.coreRadius         ?? 3485;   // km
    this.surfaceArea  = config.surfaceArea         ?? 5.1e14; // m²
    this.gravityScale = config.gravityScale       ?? 1.0;    // 地球=1.0

    // ── 状態変数 ──────────────────────────────────────────
    this.strain         = 0;     // マントル歪み（0〜10）
    this.entropyInflow  = 0;     // 北極からの吸収フラックス
    this.entropyOutflow = 0;     // 南極への排出フラックス
    this.netEntropy     = 0;     // 正味エントロピー蓄積
    this.mantleTemp     = config.initialMantleTemp ?? 1300;  // ℃
    this.phiGap         = 0;     // Φ乖離量（方向付き）
    this.dischargeRate  = 0;     // 放電効率

    // ── フラグ ────────────────────────────────────────────
    this.isDischargeBlocked = false;  // 放電飽和フラグ
    this.isBlackHole        = false;  // 特異点フラグ（trueで時間停止）

    // ── 内部 ──────────────────────────────────────────────
    this._strainHistory = [];
    this._maxHistory    = 60;
  }


  // ============================================================
  // 1ステップ更新
  // ============================================================
  update(delta = 1) {

    // ブラックホール化済みなら何もしない（特異点は時間を止める）
    if (this.isBlackHole) return this;

    // ── Step 1: 北極からのエントロピー吸収 ───────────────
    //    B(24.0) と現在の Φ の差分から流入量を計算
    //    重力スケールで惑星ごとに調整
    this.entropyInflow =
      PANDORA_CONST.B * (1 - this.phi) * 0.01 * this.gravityScale;

    // ── Step 2: Φ×Strain 非線形相関 ──────────────────────
    //    【安定領域】Φ ≦ 0.833 → 歪みは自然減衰
    //    【過飽和領域】Φ > 0.833 → 指数的に爆増
    const depthFactor = this.mantleDepth / 2886; // 深いほど蓄積しやすい

    if (this.phi <= PHI_IDEAL) {
      // 安定：理想値以下では歪みは発生しない
      this.phiGap = PHI_IDEAL - this.phi;
      this.strain = Math.max(0, this.strain - 0.01 * delta);

    } else {
      // 過飽和：0.833を超えた瞬間、物理層が「情報の重み」で歪み始める
      // 理想(0.833)から臨界(1.0)までの隙間で、Strainを0から10へ指数爆増
      this.phiGap = this.phi - PHI_IDEAL;
      const overflow     = (this.phi - PHI_IDEAL) / (PHI_MAX - PHI_IDEAL);
      const targetStrain = Math.pow(overflow, 2) * STRAIN_MAX * depthFactor;

      // 急激な変化による「衝撃」を表現するため、慣性付きで追従
      this.strain += (targetStrain - this.strain) * 0.1 * delta;
    }

    // Strain 上限クランプ
    this.strain = Math.min(this.strain, STRAIN_MAX);

    // ── 【審判】Φ=1.0 かつ Strain=10 → ブラックホール化 ──
    if (this.phi >= PHI_MAX && this.strain >= STRAIN_MAX) {
      this._triggerBlackHole();
      return this;
    }

    // ── Step 3: 南極からの排出 ────────────────────────────
    //    蓄積された Strain の一部が熱エントロピーとして排出
    //    放電効率は DISCHARGE_BAND で制限される
    this.dischargeRate =
      Math.min(1.0, PANDORA_DERIVED.DISCHARGE_BAND / Math.max(0.1, this.strain));
    this.entropyOutflow =
      this.strain * 0.05 * this.dischargeRate;

    // ── Step 4: 正味エントロピー蓄積 ─────────────────────
    this.netEntropy = this.entropyInflow - this.entropyOutflow;

    // ── Step 5: マントル温度更新 ──────────────────────────
    //    bgf（≈19.15℃）を基底として Strain と netエントロピーで変動
    const bgfTemp  = PANDORA_DERIVED.BGF;
    const heatGain = this.netEntropy * 12.0;
    const heatLoss = (this.mantleTemp - bgfTemp) * 0.002;
    this.mantleTemp += (heatGain - heatLoss) * delta;
    this.mantleTemp  = Math.max(-50, Math.min(2000, this.mantleTemp));

    // ── Step 6: 放電不足検出 ──────────────────────────────
    //    Strain が DISCHARGE_BAND の2倍を超えると「飽和放電不能」
    this.isDischargeBlocked =
      this.strain > PANDORA_DERIVED.DISCHARGE_BAND * 2;

    // ── Step 7: 履歴記録 ──────────────────────────────────
    this._strainHistory.push(this.strain);
    if (this._strainHistory.length > this._maxHistory) {
      this._strainHistory.shift();
    }

    return this;
  }


  // ============================================================
  // Φ を外部から更新（Engine.js から呼ぶ）
  // 上限は PHI_MAX = 1.0（これ以上は審判で止まる）
  // ============================================================
  setPhi(phi) {
    this.phi = Math.max(0.01, Math.min(PHI_MAX, phi));
  }


  // ============================================================
  // ブラックホール化（特異点への崩壊）
  // Φ=1.0 かつ Strain=10 で発動
  // ============================================================
  _triggerBlackHole() {
    this.isBlackHole = true;

    // 全パージ（特異点に飲み込まれる）
    this.strain         = 0;
    this.entropyInflow  = 0;
    this.entropyOutflow = 0;
    this.netEntropy     = 0;
    this.phi            = 0;
    this.mantleTemp     = -273.15; // 絶対零度（情報消滅）
    this._strainHistory = [];

    // Events.js へ発火（Engine/Visuals/Biosphere が各自受け取る）
    Events.emit(EVENT.BLACK_HOLE, {
      reason:    'PHI_STRAIN_CRITICAL',
      timestamp: Date.now(),
    });
  }


  // ============================================================
  // スナップショット（UI・Engine への読み取り用）
  // ============================================================
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
      isBlackHole:        this.isBlackHole,
      strainHistory:      [...this._strainHistory],
    };
  }
}
