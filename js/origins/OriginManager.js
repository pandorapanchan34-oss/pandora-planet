/**
 * PANDORA EARTH — js/origins/OriginManager.js
 * 【電気パルス駆動・陸海多点発生・情報過飽和突然変異モジュール】
 */

import { HydrothermalVent } from './HydrothermalVent.js';
import { MathRandom }         from '../core/Entropy.js'; // 確率ゆらぎ

export class OriginManager {
    constructor(config = {}) {
        this.vents = [];
        this.genesisCount = 0;
        this.originEvents = [];
        
        // 陸・海、それぞれの情報受容体（座標系としての初期化）
        this.sectors = [
            { id: 'deep_sea',   name: '深海熱水圏',   type: 'ocean', bioDensity: 0 },
            { id: 'tidal_zone', name: '潮間帯（海）', type: 'ocean', bioDensity: 0 },
            { id: 'land_crust', name: '原始陸上地殻', type: 'land',  bioDensity: 0 }
        ];
    }

    /**
     * 生命起源・進化の毎フレーム更新
     */
    update(bodySnap, geoSnap, atmosphereSnap, delta) {
        this.originEvents = [];
        const { phi, strain } = bodySnap;
        
        // 大気圏から「電気パルス（雷イベント）」を検知
        const hasElectricPulse = atmosphereSnap.lightningEvent || (Math.random() < 0.05 * strain);

        // ── 1. 電気パルスによる【陸・海 同時誕生】アルゴリズム ──
        if (hasElectricPulse) {
            this.sectors.forEach(sector => {
                // 情報場が一定の閾値を超えている、または電気ショックによる強制書き込み
                const entropySaturation = phi * (1 + strain / 24.0);
                
                if (entropySaturation > 0.75 && sector.bioDensity === 0) {
                    sector.bioDensity = 0.1; // 命の種火が点る
                    this.genesisCount++;
                    
                    this.originEvents.push({
                        type: 'electric_genesis',
                        source: sector.type,
                        message: `⚡電気パルス結合：${sector.name}にて最初の情報構造（生命）が受肉。`
                    });
                }
            });
        }

        // ── 2. 情報過飽和による【突然変異（Mutation）】の誘発 ──
        // Φが理想値(0.8333)を超えて過飽和（0.92超）を起こした時、コピーエラーではなく「情報の次元崩壊」として突然変異が爆発する
        if (phi > 0.92) {
            const mutationRisk = (phi - 0.92) * strain * delta;
            if (Math.random() < mutationRisk * 0.1) {
                this.originEvents.push({
                    type: 'hyper_mutation',
                    message: `⚠️情報過飽和（Φ=${phi.toFixed(4)}）：情報場が溢れ、生命が不連続な「突然変異」を開始。`
                });
            }
        }

        return this.originEvents;
    }

    getSnapshot() {
        return {
            genesisCount: this.genesisCount,
            activeSectors: this.sectors.filter(s => s.bioDensity > 0).length,
            latestEvents: this.originEvents
        };
    }
}
