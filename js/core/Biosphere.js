/**
 * PANDORA EARTH — js/core/Biosphere.js
 * 生命圏全体の状態管理（植物・動物・死体エントロピー完全統合版）
 */

import {
    calcSLocal,
    calcSCritical,
    calcSaturation,
    calcMarginAccumulation,
    calcCoolingEffect,
    isPlantTrigger,
    isAnimalTrigger,
} from './Entropy.js';

import { Plant, selectPlantType } from '../entities/Plant.js';
import { Animal, selectAnimalType } from '../entities/Animal.js'; // 🌟 動物インポート

const COOLING_PERIOD   = 180;
const MAX_PLANTS       = 50;
const MAX_ANIMALS      = 30; // 🌟 動物の上限
const WRITEOUT_EFF     = 0.002;

export class Biosphere {
    constructor() {
        this.plants = [];
        this.animals = []; // 🌟 凍結解除！

        this.phase = 'accumulation';
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

    update(body, climate, delta) {
        // 1. エントロピー基本状態の計算
        this.s_local    = calcSLocal(body.phi, body.strain);
        this.s_critical = calcSCritical(body.strain);
        this.saturation = calcSaturation(this.s_local, this.s_critical);
        
        // 🌟 動物の誕生に必要な余剰リソース（S_margin）の動的蓄積
        const rawMargin = this.s_critical - this.s_local;
        this.s_margin = rawMargin > 0 ? (this.s_margin + rawMargin * 0.1 * delta) : Math.max(0, this.s_margin + rawMargin * delta);

        // 環境オブジェクトの統合マウント
        const env = {
            temp:        climate.surfaceTemp ?? 19.15,
            stability:   climate.stability   ?? 1.0,
            strain:      body.strain          ?? 0,
            phi:         body.phi             ?? 0.82,
            bgf:         body.bgf             ?? 19.15,
            oxygenLevel: climate.oxygenLevel  ?? (this.plantTriggered ? 0.21 : 0.001) // 植物がいると酸素供給
        };

        let totalEntropyDelta = 0;
        let totalWriteout = 0;

        // 2. 植物のフェーズ管理・誕生ロジック
        if (this.phase === 'accumulation') {
            if (isPlantTrigger(this.s_local, this.s_critical, body.strain)) {
                if (this.plants.length === 0) {
                    this._genesisPlant(env);
                    this.plantTriggered = true;
                }
                this.phase = 'cooling';
                this.coolingTimer = COOLING_PERIOD;
            }
        } else if (this.phase === 'cooling') {
            this.coolingTimer -= delta * 60;
            if (this.coolingTimer <= 0) {
                this.coolingTimer = 0;
                this.phase = 'accumulation';
            }
        }

        // 🌟【新マウント】動物の誕生トリガーチェック
        if (isAnimalTrigger(this.s_margin, this.plantTriggered) && !this.animalTriggered) {
            this._genesisAnimal(env);
            this.animalTriggered = true;
        }

        // タイムスケールに応じた動的個体補充（10K倍速対応）
        if (this.plantTriggered && this.plants.filter(p => p.alive).length < MAX_PLANTS) {
            if (Math.random() < 0.6 * delta * 60 || this.plants.length === 0) this._genesisPlant(env);
        }
        if (this.animalTriggered && this.animals.filter(a => a.alive).length < MAX_ANIMALS) {
            if (Math.random() < 0.3 * delta * 60) this._genesisAnimal(env);
        }

        // 3. 植物個体の更新 ＆ エントロピー集約
        this.plants.forEach(plant => {
            const wasAlive = plant.alive;
            plant.update(env, delta);

            // 植物の負エントロピー（冷却）を集約
            totalEntropyDelta += plant.getEntropyContribution(body.phi, body.strain) * delta;

            if (wasAlive && !plant.alive) {
                totalWriteout += plant.nutrientYield * WRITEOUT_EFF;
            }
        });

        // 🌟【新マウント】動物個体の更新 ＆ エントロピー集約
        let totalAnimalDrive = 0;
        this.animals.forEach(animal => {
            const wasAlive = animal.alive;
            // 酸素レベルをインジェクション
            animal._lastOxygenLevel = env.oxygenLevel;
            animal.update(env, delta);

            if (animal.alive) {
                totalAnimalDrive += animal.drive;
            }

            // 動物の消費エントロピー（正エントロピー）を反映
            totalEntropyDelta += animal.getEntropyContribution(body.phi, body.strain) * delta;

            if (wasAlive && !animal.alive) {
                totalWriteout += animal.driveAccum * 0.05; // 死による強烈な書き込み
            }
        });

        // 4. リストの掃除
        this.plants = this.plants.filter(p => p.alive || p.age < p.lifespan + 10);
        this.animals = this.animals.filter(a => a.alive || a.age < a.lifespan + 10);

        // 5. 統計の更新
        const alivePlants = this.plants.filter(p => p.alive).length;
        const aliveAnimals = this.animals.filter(a => a.alive).length;
        
        this.population = (alivePlants + aliveAnimals) / (MAX_PLANTS + MAX_ANIMALS);
        
        const plantTypes = new Set(this.plants.map(p => p.type));
        const animalTypes = new Set(this.animals.map(a => a.type));
        this.biodiversity = (plantTypes.size + animalTypes.size) / 9;

        // 🌟 生命の総駆動エネルギー（Drive）をシステム全体（要塞）へマウント
        this.drive = totalAnimalDrive + (alivePlants > 0 ? 0.005 : 0);

        return {
            entropyDelta: totalEntropyDelta, 
            writeout:     totalWriteout  
        };
    }

    _genesisPlant(env = {}) {
        if (this.plants.length >= MAX_PLANTS) return;
        const plantType = selectPlantType(env);
        this.plants.push(new Plant({ plantType }));
    }

    // 🌟 動物生成エージェント
    _genesisAnimal(env = {}) {
        if (this.animals.length >= MAX_ANIMALS) return;
        const animalType = selectAnimalType(env);
        this.animals.push(new Animal({ animalType }));
    }

    onPhysicalShock(intensity) {
        console.warn(`[Biosphere] Received Shock: ${intensity.toFixed(2)}`);
        this.plants.forEach(p => { if (Math.random() < intensity * 0.5) p.alive = false; });
        this.animals.forEach(a => { if (Math.random() < intensity * 0.7) a.alive = false; });

        if (intensity >= 0.8) {
            this.plantTriggered = false;
            this.animalTriggered = false;
            this.phase = 'accumulation';
            this.s_margin = 0;
        }
    }

    getSnapshot() {
        return {
            phase:          this.phase,
            population:   +this.population.toFixed(3),
            biodiversity: +this.biodiversity.toFixed(3),
            plantCount:   this.plants.filter(p => p.alive).length,
            animalCount:  this.animals.filter(a => a.alive).length, // 🌟 スナップショット追加
            drive:        +this.drive.toFixed(4),
            s_local:      +this.s_local.toFixed(4),
            s_critical:   +this.s_critical.toFixed(4),
            saturation:   +this.saturation.toFixed(3),
            s_margin:     +this.s_margin.toFixed(3),
            plantTriggered: this.plantTriggered,
            animalTriggered: this.animalTriggered,
            isExtinct:    this.population <= 0
        };
    }
}
