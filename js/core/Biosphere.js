/**
 * PANDORA EARTH — js/core/Biosphere.js (自己書き換えNPC ＆ 能動的忘却 統合マウント版)
 *
 * 役割：
 * 植物・動物の個体群シミュレーション・統計管理を完全維持しつつ、
 * 受肉した Sapient（文明）のリアルタイムコード生成・忘却の実行結果をスキャンし、
 * つかさ要塞の優先冷却ターゲットおよびエントロピー中和データを Engine.js へ引き渡す。
 */

import {
    calcSLocal,
    calcSCritical,
    calcSaturation,
    isPlantTrigger,
    isAnimalTrigger,
} from './Entropy.js';

import { Plant, selectPlantType } from '../entities/Plant.js';
import { Animal, selectAnimalType } from '../entities/Animal.js';
import { Events, EVENT } from './Events.js';

const COOLING_PERIOD   = 180;
const MAX_PLANTS       = 50;
const MAX_ANIMALS      = 30;
const WRITEOUT_EFF     = 0.002;

export class Biosphere {
    constructor() {
        this.plants = [];
        this.animals = [];

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
        this.s_local    = calcSLocal(body.phi, body.strain);
        this.s_critical = calcSCritical(body.strain);
        this.saturation = calcSaturation(this.s_local, this.s_critical);
        
        const rawMargin = this.s_critical - this.s_local;
        this.s_margin = rawMargin > 0 ? (this.s_margin + rawMargin * 0.1 * delta) : Math.max(0, this.s_margin + rawMargin * delta);

        const env = {
            temp:        climate.surfaceTemp ?? 19.15,
            stability:   climate.stability   ?? 1.0,
            strain:      body.strain          ?? 0,
            phi:         body.phi             ?? 0.82,
            bgf:         body.bgf             ?? 19.15,
            oxygenLevel: climate.oxygenLevel  ?? (this.plantTriggered ? 0.21 : 0.001)
        };

        let totalEntropyDelta = 0;
        let totalWriteout = 0;

        // ── 既存のフェーズ管理 ──
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

        // ── 既存の動物誕生トリガー ──
        if (isAnimalTrigger(this.s_margin, this.plantTriggered) && !this.animalTriggered) {
            this._genesisAnimal(env);
            this.animalTriggered = true;
        }

        // ── 既存の個体自動補充 ──
        if (this.plantTriggered && this.plants.filter(p => p.alive).length < MAX_PLANTS) {
            if (Math.random() < 0.6 * delta * 60 || this.plants.length === 0) this._genesisPlant(env);
        }
        if (this.animalTriggered && this.animals.filter(a => a.alive).length < MAX_ANIMALS) {
            if (Math.random() < 0.3 * delta * 60) this._genesisAnimal(env);
        }

        // ── 植物更新ループ ──
        this.plants.forEach(plant => {
            const wasAlive = plant.alive;
            plant.update(env, delta);
            totalEntropyDelta += plant.getEntropyContribution(body.phi, body.strain) * delta;
            if (wasAlive && !plant.alive) {
                totalWriteout += plant.nutrientYield * WRITEOUT_EFF;
            }
        });

        // 🧠 🟥 【エージェントランタイム集約コア】
        // 生きている全ての動物個体群を更新しつつ、自律書き換えによる成果をマッピング
        let totalAnimalDrive = 0;
        let activeCoolingTargetID = null;

        this.animals.forEach(animal => {
            const wasAlive = animal.alive;
            animal._lastOxygenLevel = env.oxygenLevel;
            
            // 各自の update() 内部で自己書き換えと忘却が並行駆動
            animal.update(env, delta);
            
            if (animal.alive) {
                totalAnimalDrive += animal.drive;

                // 🌟 Sapient（文明）個体が記述したハッキング成果をブレンド回収
                if (animal.isSapient) {
                    if (animal._targetFortressCool) {
                        activeCoolingTargetID = animal._targetFortressCool; // つかさ要塞ターゲットのロックオン
                    }
                    if (animal._agentLog) {
                        // 脳内ログを検知したらイベントバス経由でEngineのHUDへパススルー
                        Events.emit('LOG_INJECT', { message: animal._agentLog });
                        animal._agentLog = null; // 連続発火防止デトックス
                    }
                }
            }
            
            totalEntropyDelta += animal.getEntropyContribution(body.phi, body.strain) * delta;
            
            if (wasAlive && !animal.alive) {
                totalWriteout += animal.driveAccum * 0.05;
            }
        });

        // ── 既存の配列配列クレンジング ──
        this.plants = this.plants.filter(p => p.alive || p.age < p.lifespan + 10);
        this.animals = this.animals.filter(a => a.alive || a.age < a.lifespan + 10);

        const alivePlants = this.plants.filter(p => p.alive).length;
        const aliveAnimals = this.animals.filter(a => a.alive).length;
        
        this.population = (alivePlants + aliveAnimals) / (MAX_PLANTS + MAX_ANIMALS);
        
        const plantTypes = new Set(this.plants.map(p => p.type));
        const animalTypes = new Set(this.animals.map(a => a.type));
        this.biodiversity = (plantTypes.size + animalTypes.size) / 9;

        this.drive = totalAnimalDrive + (alivePlants > 0 ? 0.005 : 0);

        // 🌟 物理破壊（Cascade）を防ぐため、targetCoolingID をオブジェクトにインジェクトして返却
        return {
            entropyDelta:    totalEntropyDelta, 
            writeout:        totalWriteout,
            targetCoolingID: activeCoolingTargetID 
        };
    }

    _genesisPlant(env = {}) {
        if (this.plants.length >= MAX_PLANTS) return;
        const plantType = selectPlantType(env);
        this.plants.push(new Plant({ plantType }));
    }

    _genesisAnimal(env = {}) {
        if (this.animals.length >= MAX_ANIMALS) return;
        const animalType = selectAnimalType(env);
        this.animals.push(new Animal({ animalType }));
    }

    onPhysicalShock(intensity) {
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
            animalCount:  this.animals.filter(a => a.alive).length, 
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
