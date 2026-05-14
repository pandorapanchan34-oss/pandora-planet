// ============================================================
// PANDORA EARTH — js/constants.js
// Pandora Theory 物理定数
//
// ここを弄ると「別の宇宙」になる。
// 全モジュールはこのファイルのみに依存すること。
// ============================================================

const PANDORA_CONST = Object.freeze({

  // ── 銀河定数 ──────────────────────────────────────────────
  // B   : 銀河の帯域幅（情報容量の上限）
  // TAU : 位相遅延係数（次元間の摩擦）
  // N   : 次元圧縮数（情報の畳み込み深さ）
  // E   : 自然対数の底（最適符号化の自然限界）
  B:   24.0,
  TAU: 0.1194,
  N:   3.0,
  E:   Math.E,

  // ── bgf（基底幾何学係数）─────────────────────────────────
  // bgf = (B/N) × (1−TAU) × e ≈ 19.15
  // 相転移の普遍的臨界値。
  // この値を情報密度が超えた瞬間に局所→大域同期が発生する。
  BGF: (24.0 / 3.0) * (1 - 0.1194) * Math.E,  // ≈ 19.15

  // ── Φ（情報占有率）───────────────────────────────────────
  PHI_IDEAL: 5 / 6,   // 0.8333... 成熟銀河の理想値
  PHI_EARTH: 0.906,   // 地球の逆算値（過飽和状態）

  // ── 相転移フェーズ閾値 ────────────────────────────────────
  PHASE: Object.freeze({
    ATTENTION:            8.5,   // Strain: 要注意
    CRITICAL:            10.0,   // Strain: 臨界
    BGF_RATIO_TRANSITION: 0.8,   // bgf比: 相転移前
    BGF_RATIO_GLOBAL:     1.0,   // bgf比: 大域同期
    BGF_RATIO_CASCADE:    1.2,   // bgf比: 臨界崩壊
    SYNC_CASCADE:         0.6,   // sync: CASCADE判定の下限
    LIFETIME_WARN:       50.0,   // lifetime: 警告
    LIFETIME_CRIT:       10.0,   // lifetime: 臨界
  }),

  // ── カラーマップ（Strain値 → RGB）────────────────────────
  // v: Strain値, r/g/b: RGB
  STRAIN_COLORS: Object.freeze([
    { v:  0, r:  10, g:  40, b:  80 },  // deep blue（安定）
    { v:  5, r:  20, g: 120, b:  80 },  // teal
    { v:  8, r: 180, g: 160, b:   0 },  // amber（注意）
    { v: 10, r: 220, g:  60, b:   0 },  // orange-red（臨界）
    { v: 15, r: 255, g:  20, b:  20 },  // red
    { v: 20, r: 255, g:   0, b: 200 },  // magenta（CASCADE）
  ]),

  // ── シミュレーション設定 ──────────────────────────────────
  SIM: Object.freeze({
    TICK_MS:      500,    // エンジン更新間隔（ms）
    HISTORY_MAX:  200,    // 履歴保持ステップ数
    LCG_SEED:      42,    // 決定論的乱数の初期シード
  }),

});

// ── 導出値（定数から計算、読み取り専用）──────────────────────
const PANDORA_DERIVED = Object.freeze({

  // bgf = (B/N) × (1−TAU) × e の各因子
  B_OVER_N:      PANDORA_CONST.B / PANDORA_CONST.N,         // 8.0
  ONE_MINUS_TAU: 1 - PANDORA_CONST.TAU,                     // 0.8806
  BGF:           PANDORA_CONST.BGF,                          // ≈19.15

  // 地球の過飽和率
  PHI_OVERSHOOT: PANDORA_CONST.PHI_EARTH - PANDORA_CONST.PHI_IDEAL,  // ≈0.073

  // 放電可能帯域 = B × (1 − Φ_earth)
  DISCHARGE_BAND: PANDORA_CONST.B * (1 - PANDORA_CONST.PHI_EARTH),   // ≈2.26

});
