/**
 * PANDORA EARTH — js/core/Biosphere.js
 * 生命圏全体の状態管理（完全統合・時間加速同期版）
 */

import {
    calcSLocal,
    calcSCritical,
    calcSaturation,
    calcMarginAccumulation,
    calcPlantGenesisReset,
    calcCoolingEffect,
    isPlantTrigger,
    isAnimalTrigger,
    STRAIN_PLANT_THRESHOLD,
    S_MARGIN_ANIMAL,
} from './Entropy.js';

import { Plant, selectPlantType } from '../entities/Plant.js';

// ── 定数定義 ──────────────────────────────────────────
const COOLING_PERIOD   = 180;
const MAX_PLANTS       = 50;
const WRITEOUT_EFF     = 0.002; // 死による情報還流係数

export class Biosphere {
    constructor() {
        this.plants = [];
        this.animals = []; // 将来用

        // 状態パラメータ
        this.phase = 'accumulation'; // accumulation | cooling
        this.coolingTimer = 0;
        
        this.s_local      = 0;
        this.s_critical   = 0;
        this.s_margin     = 0;
        this.saturation   = 0;
        
        this.population   = 0;
        this.biodiversity = 0;
        this.drive        = 0;

        this.plantTriggered  = false;
        this.animalTriggered = false;
    }

    /**
     * メメインアップデート
     * @returns {Object} Engineに渡す計算結果
     */
    update(body, climate, delta) {
        // 1. エントロピー基本状態の計算（Entropy.jsを使用）
        this.s_local    = calcSLocal(body.phi, body.strain);
        this.s_critical = calcSCritical(body.strain);
        this.saturation = calcSaturation(this.s_local, this.s_critical);

        // ✅ FIX①: env オブジェクトの定義を最上部へマウント（ReferenceErrorの完全排除）
        const env = {
            temp:      climate.surfaceTemp ?? 19.15,
            stability: climate.stability   ?? 1.0,
            strain:    body.strain          ?? 0,
            phi:       body.phi             ?? 0.82,
            bgf:       body.bgf             ?? 19.15,
        };

        let totalCooling  = 0;
        let totalWriteout = 0;

        // 🟢 Biosphere.js の 46行目付近、フェーズ管理ロジックを以下にリファクタリング（上書き）
if (this.phase === 'accumulation') {
    // 誕生条件を満たしており、かつ植物がまだ絶滅している（または未誕生）なら受肉！
    if (isPlantTrigger(this.s_local, this.s_critical, body.strain)) {
        if (this.plants.length === 0) {
            this._genesisPlant(env);
            this.plantTriggered = true;
            this._log?.('EVOLUTION', '最初の植物ゲノムが地表に受肉しました。', 'warn'); // ログ用
        }
        this.phase = 'cooling';
        this.coolingTimer = COOLING_PERIOD;
    }
}
        } else if (this.phase === 'cooling') {
            // ✅ FIX②: 1万倍速の巨大な delta が入ってきても、タイマーがマイナスに吹き飛んで無限ループ化するのを防ぐ
            this.coolingTimer -= delta * 60; // 60fps想定
            if (this.coolingTimer <= 0) {
                this.coolingTimer = 0;
                this.phase = 'accumulation';
            }
        }

        // 🌟 コロシアム・ゲノム相転移：生命がすでに誕生している場合、環境に合わせた動的な生命維持を計算
        // （もしMAX値未満なら、加速されたdeltaに応じて一定確率で自動追加増殖させる規律を追加）
        if (this.plantTriggered && this.plants.filter(p => p.alive).length < MAX_PLANTS) {
            // 加速されたdeltaに比例した確率で、1万倍速の世界でも秒速で個体を自動補充
            if (Math.random() < 0.5 * delta * 60 || this.plants.length === 0) {
                this._genesisPlant(env);
            }
        }

        // 3. 植物個体の更新
        this.plants.forEach(plant => {
            const wasAlive = plant.alive;
            plant.update(env, delta);

            // 冷却効果（生存中のみ）
            if (plant.alive) {
                totalCooling += calcCoolingEffect(
                    this.s_local,
                    COOLING_PERIOD > 0 ? (this.coolingTimer / COOLING_PERIOD) : 0
                ) * delta; // タイムスケール同期
            }

            // 死による情報の還流（死亡した瞬間のみ）
            if (wasAlive && !plant.alive) {
                totalWriteout += plant.nutrientYield * WRITEOUT_EFF;
            }
        });

        // 4. 個体リストの掃除
        this.plants = this.plants.filter(p => p.alive || p.age < p.lifespan + 10);

        // 5. 統計の更新
        const aliveCount = this.plants.filter(p => p.alive).length;
        this.population = aliveCount / MAX_PLANTS;
        this.biodiversity = new Set(this.plants.map(p => p.type)).size / 5;

        // 植物の総駆動エネルギーを要塞ドライブへ同期させるための因果導線
        this.drive = aliveCount > 0 ? (this.biodiversity * 0.1) : 0;

        return {
            entropyDelta: totalCooling, // 負の値（惑星を冷やす）
            writeout:     totalWriteout  // 正の値（死の記録をΦに刻む）
        };
    }

    /**
     * 新しい植物の誕生
     */
    _genesisPlant(env = {}) {
        if (this.plants.length >= MAX_PLANTS) return;
        const plantType = selectPlantType(env);
        this.plants.push(new Plant({ plantType }));
    }

    /**
     * 物理的衝撃（Engineから呼ばれる）
     */
    onPhysicalShock(intensity) {
        console.warn(`[Biosphere] Received Shock: ${intensity.toFixed(2)}`);
        
        this.plants.forEach(p => {
            if (Math.random() < intensity * 0.5) p.alive = false;
        });

        if (intensity >= 0.8) {
            this.plantTriggered = false;
            this.phase = 'accumulation';
        }
    }

    /**
     * スナップショット
     */
    getSnapshot() {
        return {
            phase:          this.phase,
            population:   +this.population.toFixed(3),
            biodiversity: +this.biodiversity.toFixed(3),
            plantCount:   this.plants.filter(p => p.alive).length,
            drive:        +this.drive.toFixed(4),
            s_local:      +this.s_local.toFixed(4),
            s_critical:   +this.s_critical.toFixed(4),
            saturation:   +this.saturation.toFixed(3),
            plantTriggered: this.plantTriggered,
            animalTriggered: this.animalTriggered,
            isExtinct:    this.population <= 0
        };
    }
}
