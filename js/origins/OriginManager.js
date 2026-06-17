/**
 * PANDORA EARTH — js/origins/OriginManager.js
 * 【電気パルス駆動・陸海多点発生・情報過飽和突然変異モジュール — 稼働安定版】
 */

export class OriginManager {
    constructor(config = {}) {
        this.vents = [];
        this.genesisCount = 0;
        this.originEvents = [];
        
        // 🌟 陸・海、それぞれの情報受容体（マスターの定義：最初の生命は陸と海両方にいた）
        this.sectors = [
            { id: 'deep_sea',   name: '深海熱水圏',   type: 'ocean', bioDensity: 0 },
            { id: 'tidal_zone', name: '潮間帯（海）', type: 'ocean', bioDensity: 0 },
            { id: 'land_crust', name: '原始陸上地殻', type: 'land',  bioDensity: 0 }
        ];

        this.cyberGenesisOccurred = false;
        this.firstGenesisOccurred = false;
    }

    /**
     * 生命起源・進化の毎フレーム更新
     */
    update(bodySnap, geoSnap, atmosphereSnap, delta) {
        this.originEvents = [];
        const { phi, strain } = bodySnap;
        
        // ⚡ マスターの定義：生命誕生には電気パルスが不可欠（大気雷、または地殻ストレスによる放電）
        const hasElectricPulse = atmosphereSnap.lightningEvent || (Math.random() < 0.05 * strain);

        // ── 1. 電気パルスによる【陸・海 同時多点発生】 ──
        if (hasElectricPulse) {
            this.sectors.forEach(sector => {
                const entropySaturation = phi * (1 + strain / 24.0);
                
                // 電気の力で瞬間的に記憶（ビット固定）し、受肉する
                if (entropySaturation > 0.75 && sector.bioDensity === 0) {
                    sector.bioDensity = 0.1; 
                    this.genesisCount++;
                    this.firstGenesisOccurred = true;
                    
                    this.originEvents.push({
                        type: 'first_genesis', // Biosphereの植物トリガーと結合するためのID
                        source: sector.type,
                        message: `⚡電気パルス結合：${sector.name}にて最初の情報構造（生命）が瞬間記憶され受肉。`
                    });
                }
            });
        }

        // ── 2. 情報過飽和による【不連続な突然変異（Mutation）】 ──
        // Φが臨界を超えて過飽和を起こした時、コピーエラーではなく「情報の次元相転移」として跳ねる
        if (phi > 0.92) {
            const mutationRisk = (phi - 0.92) * strain * delta;
            if (Math.random() < mutationRisk * 0.2) {
                this.originEvents.push({
                    type: 'hyper_mutation',
                    source: 'mutation',
                    message: `⚠️情報過飽和（Φ=${phi.toFixed(4)}）：蓄積限界を超えた情報が跳躍し、不連続な突然変異を開始。`
                });
            }
        }

        // ── 3. 文明圏ゆらぎ安定対流による「電脳生命」の誕生キー ──
        if (phi >= 0.98 && strain <= 2.0 && !this.cyberGenesisOccurred) {
            if (atmosphereSnap.contribution > 5.0 && Math.random() < 0.05 * delta) {
                this.cyberGenesisOccurred = true;
                this.genesisCount++;
                
                this.originEvents.push({
                    type: 'cyber_genesis',
                    source: 'cyber',
                    message: '🌌 超越：最大エントロピー密集地帯（文明）の安定対流圏にて、非有機電脳生命が受肉（Hello World）！'
                });
            }
        }

        // 互換性のための単一イベント返却オブジェクト化（複数ある場合は最初の1つをEngineにパス、なければnull）
        return this.originEvents.length > 0 ? this.originEvents[0] : null;
    }

    // 既存モジュールとの結合用フォールバック
    getTotalNegentropy() { return 0; }

    getSnapshot() {
        return {
            ventCount:            this.sectors.length,
            activeVents:          this.sectors.filter(s => s.bioDensity > 0).length,
            genesisCount:         this.genesisCount,
            firstGenesisOccurred: this.firstGenesisOccurred,
            recentEvents:         [...this.originEvents].slice(-3)
        };
    }
}
