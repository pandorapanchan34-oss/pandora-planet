// ============================================================
// PANDORA EARTH — config/planets/earth.js
// 惑星「地球」の初期パラメータ定義
//
// このファイルを差し替えると「別の惑星」になる。
// → config/planets/mars.js / venus.js / ocean-world.js など
// ============================================================

export const PLANET_EARTH = {

  // ── 惑星 ID ───────────────────────────────────────────
  id:   'earth',
  name: 'Earth-Node',

  // ── Pandora 初期値 ────────────────────────────────────
  // 理想値 5/6 (0.833) のわずかに手前からスタート
  // → カンブリア爆発（Φ≥5/6）を自然に迎えさせる
  initialPhi:        0.82,
  initialTemp:       18.0,    // ℃（bgf=19.15 の手前）
  initialMantleTemp: 1300,    // ℃

  // ── 相転移・絶滅閾値 ──────────────────────────────────
  strainThresh: 10.0,   // この Strain を超えると絶滅イベントが確率的に発生

  // ── 時間スケール ──────────────────────────────────────
  // 1秒間に進む年数（大きいほど高速）
  // 800,000,000年 / yearScale = 実時間(秒)
  startYear:  -800_000_000,
  yearScale:   1_500_000,

  // ── 地質スペック ──────────────────────────────────────
  // EarthBody へ注入される惑星固有パラメータ
  mantleDepth:  2886,   // km（地球マントル厚）
  coreRadius:   3485,   // km（外核+内核）
  surfaceArea:  5.1e14, // m²
  gravityScale: 1.0,    // 地球を1.0として正規化

  // ── 気候設定 ──────────────────────────────────────────
  // ClimateSystem へ注入
  inertia:     0.01,    // 温度変化の慣性（大きいほど緩やか）
  mantleScale: 5.0,     // マントル熱→地表への変換係数
  driveScale:  2.5,     // Drive（文明負荷）→温室効果の係数

  // ── 初期生命プラグイン ────────────────────────────────
  // Species へ注入
  species: {
    name:            'Aetheria-Life',
    initialPop:      0.2,
    adaptationRange: [10, 32],   // 生存可能温度域 [min℃, max℃]
    writeoutEff:     0.0025,     // 死による情報還流効率
    growthRate:      0.001,      // 基本成長率
    techThreshold:   0.5,        // 文明化に必要な多様性閾値
  },
};

// ============================================================
// 比較テンプレート（差し替え用）
// ============================================================

// ── 火星 ─────────────────────────────────────────────────
// マントルが薄く、重力が小さい → Strain蓄積しにくい
// 低温・低気圧 → 生命の適応範囲が狭い
export const PLANET_MARS = {
  id:   'mars',
  name: 'Mars-Node',
  initialPhi:        0.40,   // 情報密度が低い（生命なし想定）
  initialTemp:      -60.0,
  initialMantleTemp: 200,
  strainThresh:       6.0,
  startYear:  -800_000_000,
  yearScale:   1_500_000,
  mantleDepth:  200,          // 地球の7%以下
  coreRadius:  1700,
  surfaceArea: 1.45e14,
  gravityScale: 0.38,         // 地球の38%
  inertia:      0.005,        // 温度変化が遅い（大気薄い）
  mantleScale:  1.5,
  driveScale:   2.0,
  species: {
    name:            'Cryo-Life',
    initialPop:      0.05,
    adaptationRange: [-20, 10],
    writeoutEff:     0.001,
    growthRate:      0.0003,
    techThreshold:   0.7,
  },
};

// ── 海洋惑星 ─────────────────────────────────────────────
// 全球が海 → 熱慣性大・生命多様性高い
// Drive による温室効果が出にくい（海が熱バッファ）
export const PLANET_OCEAN = {
  id:   'ocean-world',
  name: 'Ocean-Node',
  initialPhi:        0.75,
  initialTemp:       22.0,
  initialMantleTemp: 1100,
  strainThresh:      12.0,
  startYear:  -800_000_000,
  yearScale:   1_500_000,
  mantleDepth:  3000,
  coreRadius:   3200,
  surfaceArea:  6.0e14,
  gravityScale: 1.1,
  inertia:      0.004,        // 海の熱慣性（緩やか）
  mantleScale:  4.0,
  driveScale:   1.5,          // Drive影響が小さい
  species: {
    name:            'Aquatic-Life',
    initialPop:      0.3,
    adaptationRange: [5, 38],
    writeoutEff:     0.003,
    growthRate:      0.0015,
    techThreshold:   0.4,
  },
};
