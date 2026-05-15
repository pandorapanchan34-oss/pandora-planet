/**
 * PANDORA EARTH — config/planets/earth.js
 *
 * 惑星「地球」の初期パラメータ
 *
 * 理論タイムライン（Pandora Theory）：
 *   -800Ma：Φ≈0.95、Strain=5〜7、温度60〜80℃（灼熱期）
 *   -600Ma：植物誕生、Φ→0.833（デフラグ開始）
 *   -400Ma：Cambrian、Strain=3〜4、温度30〜35℃
 *   -200Ma：動物誕生、Strain≤2.0、温度25〜30℃
 *    0Ma〜：Sapient or Singularity
 */

export const PLANET_EARTH = {
    name:      'Aetheria',
    startYear: -800_000_000,   // -800Ma

    // ── 情報場（Pandora Theory）────────────────────────
    // -800Ma時点：既に過飽和圏（Φ>PHI_IDEAL=0.833）
    // → 即Strain=5〜7が発生し植物誕生トリガー圏に入る
    initialPhi: 0.95,

    // ── 地質パラメータ ──────────────────────────────────
    mantleDepth:      2886,
    coreRadius:       3485,
    gravityScale:     1.0,
    initialMantleTemp: 1300,   // 原始地球のマントル温度

    // ── 気候パラメータ ──────────────────────────────────
    // -800Ma：灼熱期（60〜80℃）
    initialTemp:   70.0,
    initialAlbedo:  0.15,      // 大気薄い→反射少ない
    inertia:        0.008,     // 大気薄い→熱慣性小さい
    mantleScale:    6.0,       // マントル熱の影響大
    driveScale:     2.5,

    // ── 大気パラメータ ──────────────────────────────────
    initialOxygen:  0.001,     // 原始大気：酸素ほぼゼロ
    initialCO2:     0.95,      // CO2濃度高い（温室効果）
    pressure:       0.6,       // 大気圧低い

    // ── 水圏パラメータ ──────────────────────────────────
    oceanCoverage:   0.60,     // 原始海洋（現在より少ない）
    initialOceanTemp: 45.0,    // 熱水海洋
    initialPH:       7.5,      // やや酸性

    // ── 生命圏パラメータ ────────────────────────────────
    species: {
        initialPop:  0.0,      // 生命なし（植物誕生まで）
        writeoutEff: 0.0075,
    },

    yearScale: 1_000,          // 1秒あたりの年数
};

/**
 * 火星ノード（将来拡張）
 * Φ低め・Strain高め・水なし
 */
export const PLANET_MARS = {
    name:      'Ares',
    startYear: -800_000_000,
    initialPhi: 0.72,          // 情報場が薄い
    mantleDepth: 1500,
    gravityScale: 0.38,
    initialMantleTemp: 800,
    initialTemp: -20.0,
    initialAlbedo: 0.25,
    inertia: 0.02,
    mantleScale: 3.0,
    driveScale: 1.0,
    initialOxygen: 0.001,
    initialCO2: 0.95,
    pressure: 0.01,
    oceanCoverage: 0.05,
    initialOceanTemp: -10.0,
    initialPH: 7.0,
    species: { initialPop: 0.0, writeoutEff: 0.001 },
    yearScale: 1_000,
};

/**
 * 海洋惑星ノード（将来拡張）
 */
export const PLANET_OCEAN = {
    name:      'Thalassa',
    startYear: -800_000_000,
    initialPhi: 0.88,
    mantleDepth: 2000,
    gravityScale: 1.1,
    initialMantleTemp: 1100,
    initialTemp: 35.0,
    initialAlbedo: 0.08,
    inertia: 0.02,
    mantleScale: 4.0,
    driveScale: 2.0,
    initialOxygen: 0.005,
    initialCO2: 0.6,
    pressure: 1.2,
    oceanCoverage: 0.98,       // ほぼ全海洋
    initialOceanTemp: 30.0,
    initialPH: 8.2,
    species: { initialPop: 0.0, writeoutEff: 0.01 },
    yearScale: 1_000,
};
