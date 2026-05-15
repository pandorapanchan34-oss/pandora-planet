/**
 * PANDORA EARTH — js/core/Biosphere.js
 * 生命圏全体の状態管理（完全版）
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
     * メインアップデート
     * @returns {Object} Engineに渡す計算結果
     */
    update(body, climate, delta) {
        // 1. エントロピー基本状態の計算（Entropy.jsを使用）
        this.s_local    = calcSLocal(body.phi, body.strain);
        this.s_critical = calcSCritical(body.phi);
        this.saturation = calcSaturation(this.s_local, this.s_critical);

        let totalCooling  = 0;
        let totalWriteout = 0;

        // 2. フェーズ管理ロジック
        if (this.phase === 'accumulation') {
            // 誕生トリガーチェック
            if (isPlantTrigger(this.saturation, body.strain) && !this.plantTriggered) {
                this._genesisPlant();
                this.plantTriggered = true;
                this.phase = 'cooling';
                this.coolingTimer = COOLING_PERIOD;
            }
        } else if (this.phase === 'cooling') {
            this.coolingTimer -= delta * 60; // 60fps想定
            if (this.coolingTimer <= 0) {
                this.phase = 'accumulation';
            }
        }

        // 3. 植物個体の更新
        this.plants.forEach(plant => {
            const res = plant.update(climate, body, delta);
            
            // 冷却効果の集計（生存中のみ）
            if (plant.alive) {
                totalCooling += calcCoolingEffect(plant.level, this.saturation);
            }
            
            // 死による情報の還流（死亡した瞬間のみ）
            if (plant.justDied) {
                totalWriteout += (plant.level * WRITEOUT_EFF);
                plant.justDied = false; // 重複加算防止
            }
        });

        // 4. 個体リストの掃除（完全に消滅した個体を除去）
        this.plants = this.plants.filter(p => p.alive || p.age < p.lifespan + 10);

        // 5. 統計の更新
        this.population = this.plants.filter(p => p.alive).length / MAX_PLANTS;
        this.biodiversity = new Set(this.plants.map(p => p.type)).size / 5;

        // ──────────────────────────────────────────────────
        // ✅ 重要：Engine.js が期待する形式で計算結果を返す
        // ──────────────────────────────────────────────────
        return {
            entropyDelta: totalCooling, // 負の値（惑星を冷やす）
            writeout:     totalWriteout  // 正の値（死の記録をΦに刻む）
        };
    }

    /**
     * 新しい植物の誕生
     */
    _genesisPlant() {
        if (this.plants.length >= MAX_PLANTS) return;
        
        const type = selectPlantType();
        const newPlant = new Plant(type);
        this.plants.push(newPlant);
        console.log(`[Biosphere] Plant Genesis: ${type}`);
    }

    /**
     * 物理的衝撃（Engineから呼ばれる）
     */
    onPhysicalShock(intensity) {
        console.warn(`[Biosphere] Received Shock: ${intensity.toFixed(2)}`);
        
        // 全個体にダメージ
        this.plants.forEach(p => {
            if (Math.random() < intensity * 0.5) p.alive = false;
        });

        // 強い衝撃（0.8以上）なら誕生フラグをリセットしてやり直し
        if (intensity >= 0.8) {
            this.plantTriggered = false;
            this.phase = 'accumulation';
        }
    }

    /**
     * スナップショット（EngineのgetFullStatus用）
     */
    getSnapshot() {
        return {
            phase:        this.phase,
            population:   +this.population.toFixed(3),
            biodiversity: +this.biodiversity.toFixed(3),
            plantCount:   this.plants.filter(p => p.alive).length,
            s_local:      +this.s_local.toFixed(4),
            saturation:   +this.saturation.toFixed(3)
        };
    }
}
