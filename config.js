// config.js
import { UNIVERSAL } from './js/constants.j';

export const PLANET = {
    name: "Aetheria",           // ← ここを変えると独自惑星になる
    seed: 20260514,
    
    // 惑星基本スペック
    oceanCoverage: 0.71,
    axialTilt: 23.4,
    volcanism: 1.6,             // 地殻活動レベル
    noise: 0.68,                // 多様性（Noise）
    
    // 初期状態
    initialPhi: 0.82,
    initialDrive: 0.031,        // 文明負荷（Drive）
    initialTemp: 18.8,
    
    // 将来拡張用
    heightMap: null,            // 将来的にオリジナル地形マップ
    biomeSeed: 777,
    
    // ビジュアル
    atmosphereHue: 210,         // 青みがかった雰囲気
    baseHue: 160
};
