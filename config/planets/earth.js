/**
 * PANDORA EARTH — config/planets/earth.js
 *
 * 惑星「地球」および拡張天体の初期パラメータ ＆ サイバー要塞マウント
 *
 * 理論タイムライン（Pandora Theory）：
 * -800Ma：Φ≈0.95、Strain=5〜7、温度60〜80℃（灼熱期）
 * -600Ma：植物誕生、Φ→0.833（デフラグ開始）
 * -400Ma：Cambrian、Strain=3〜4、温度30〜35℃
 * -200Ma：動物誕生、Strain≤2.0、温度25〜30℃
 * 0Ma〜：Sapient or Singularity（電脳要塞の完全覚醒）
 */

export const PLANET_EARTH = {
    name:      'Aetheria',
    startYear: -800_000_000,   // -800Ma

    // ── 情報場（Pandora Theory）────────────────────────
    initialPhi: 0.95,

    // ── 地質パラメータ ──────────────────────────────────
    mantleDepth:      2886,
    coreRadius:       3485,
    gravityScale:     1.0,
    initialMantleTemp: 1300,

    // ── 気候パラメータ ──────────────────────────────────
    initialTemp:   70.0,
    initialAlbedo:  0.15,
    inertia:        0.008,
    mantleScale:    6.0,
    driveScale:     2.5,

    // ── 大気パラメータ ──────────────────────────────────
    initialOxygen:  0.001,
    initialCO2:     0.95,
    pressure:       0.6,

    // ── 水圏パラメータ ──────────────────────────────────
    oceanCoverage:   0.60,
    initialOceanTemp: 45.0,
    initialPH:       7.5,

    // ── 生命圏パラメータ ────────────────────────────────
    species: {
        initialPop:  0.0,
        writeoutEff: 0.0075,
    },

    // ── 🟥 サイバー圏パラメータ（パンドラコロシアム統合） ──
    // 惑星の各地理セクター（トポロジー）に配置された自律防壁群
    fortresses: [
        {
            id: 'ALPHA_FORTRESS',
            name: 'アルファ・フォートレス',
            tier: 6,
            defenseRate: 99.4,
            status: 'STANDBY',
            // 惑星マクロ連動用の環境感度（温度が高いと冷却負荷で防御率が僅かに減衰するなど）
            climateSensitivity: 0.05 
        },
        {
            id: 'BETA_FORTRESS',
            name: 'ベータ・フォートレス',
            tier: 6,
            defenseRate: 98.7,
            status: 'STANDBY',
            climateSensitivity: 0.04
        },
        {
            id: 'GAMMA_FORTRESS',
            name: 'ガンマ・フォートレス',
            tier: 7,
            defenseRate: 99.9,
            status: 'STANDBY',
            climateSensitivity: 0.02
        },
        {
            id: 'TSUKASA_FORTRESS',
            name: 'つかさ 【MY_FORTRESS】',
            tier: 3,
            defenseRate: 92.5,
            status: 'STANDBY',
            climateSensitivity: 0.08 // マスターの要塞：環境変動（ゆらぎ）を最も敏感に受ける
        }
    ],

    yearScale: 1_000_000,      // 1秒あたり1Ma
};

/**
 * 火星ノード
 * Φ低め・要塞もリソース枯渇気味（防衛率初期値が低め）
 */
export const PLANET_MARS = {
    name:      'Ares',
    startYear: -800_000_000,
    initialPhi: 0.72,
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
    
    // ── 🟥 火星仕様の荒廃した要塞群 ──
    fortresses: [
        { id: 'DESERT_CORE', name: '砂漠の核', tier: 4, defenseRate: 50.0, status: 'STANDBY', climateSensitivity: 0.10 },
        { id: 'PHOBOS_GATE', name: 'フォボス・ゲート', tier: 5, defenseRate: 72.0, status: 'STANDBY', climateSensitivity: 0.05 }
    ],
    
    yearScale: 1_000_000,
};

/**
 * 海洋惑星ノード
 * 高気圧・高湿度により、高伝導率のサイバープレーンを展開
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
    oceanCoverage: 0.98,
    initialOceanTemp: 30.0,
    initialPH: 8.2,
    species: { initialPop: 0.0, writeoutEff: 0.01 },
    
    // ── 🟥 深海高圧仕様の強固な要塞群 ──
    fortresses: [
        { id: 'ABYSS_SHIELD', name: 'アビス・シールド', tier: 7, defenseRate: 99.9, status: 'STANDBY', climateSensitivity: 0.01 },
        { id: 'KRAKEN_NODE', name: 'クラーケン・ノード', tier: 6, defenseRate: 95.4, status: 'STANDBY', climateSensitivity: 0.03 }
    ],
    
    yearScale: 1_000_000,
};
