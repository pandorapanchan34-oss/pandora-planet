/**
 * PANDORA EARTH — js/core/Biosphere.js
 *
 * 生命圏全体の状態管理
 *
 * 役割：
 *   - Entropy.jsの計算式を使って生命圏の状態を管理する
 *   - Plant/Animalの誕生・死亡・繁殖を統括する
 *   - coolingMode・S_margin・フェーズなど生命関連の状態を持つ
 *   - Engine.jsにエントロピー貢献値の合計を返す
 *
 * 設計方針：
 *   - Entropy.jsはpure function群として使う（状態はここで持つ）
 *   - Species.jsの役割を吸収（削除済み）
 *   - 将来のAnimal.js追加もここで受け入れる
 *
 * ─────────────────────────────────────────────────────
 * フロー：
 *   Entropy計算 → トリガー判定 → Plant/Animal生成
 *   → getEntropyTotal() → Engine集約 → EarthBody反映
 * ─────────────────────────────────────────────────────
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

// 冷却期間（ステップ数）
const COOLING_PERIOD   = 180;
// 同時に存在できる植物の最大数
const MAX_PLANTS       = 50;
// 植物population→writeout変換係数（旧Species.jsから継承）
const WRITEOUT_EFF     = 0.0075;

export class Biosphere {

    constructor(config = {}) {
        // ── エントロピー状態 ───────────────────────────────
        this.s_local    = 0;
        this.s_critical = 0;
        this.s_margin   = 0;
        this.saturation = 0;

        // ── 生命圏フェーズ ─────────────────────────────────
        // accumulation | plant_trigger | cooling | plant_stable | animal_ready
        this.phase = 'accumulation';

        // ── トリガーフラグ ─────────────────────────────────
        this.plantTriggered  = false;
        this.animalTriggered = false;

        // ── 冷却管理 ──────────────────────────────────────
        this.coolingMode  = false;
        this.coolingTimer = 0;

        // ── 植物群 ────────────────────────────────────────
        this.plants = [];   // Plant[]

        // ── 動物群（将来用） ───────────────────────────────
        this.animals = [];  // Animal[]（Animal.js実装後に使う）

        // ── 統計 ──────────────────────────────────────────
        this.population   = config.initialPop ?? 0.2; // 旧Species.jsから継承
        this.drive        = 0;
        this.biodiversity = 0;

        // ── 設定 ──────────────────────────────────────────
        this.writeoutEff = config.writeoutEff ?? WRITEOUT_EFF;
    }

    // ── メイン更新 ────────────────────────────────────────
    /**
     * @param {object} bodySnap    - EarthBody.getSnapshot()
     * @param {object} climateSnap - Climate.getSnapshot()
     * @param {number} delta
     * @returns {object} { entropyDelta, writeout, triggered }
     */
    update(bodySnap, climateSnap, delta) {
        const { phi, strain } = bodySnap;
        const env = this._buildEnv(bodySnap, climateSnap);

        // 1. エントロピー計算
        this.s_local    = calcSLocal(phi, strain);
        this.s_critical = calcSCritical(strain);
        this.saturation = calcSaturation(this.s_local, this.s_critical);

        // 2. 植物誕生トリガー
        let triggered = null;
        if (!this.plantTriggered && isPlantTrigger(this.s_local, this.s_critical, strain)) {
            triggered = this._onPlantGenesis(phi, env);
        }

        // 3. 冷却期間処理
        if (this.coolingMode && this.coolingTimer > 0) {
            this.coolingTimer--;
            const coolingRatio = this.coolingTimer / COOLING_PERIOD;
            const cooling = calcCoolingEffect(this.s_local, coolingRatio);
            this.s_local = Math.max(0, this.s_local - cooling);

            // 冷却後半：植物がエントロピーを少し戻す（根付きの揺り戻し）
            if (this.coolingTimer < COOLING_PERIOD * 0.7) {
                this.s_local += 0.006 * phi * delta;
            }
        }

        // 4. 植物群の更新
        this._updatePlants(env, delta, phi, strain);

        // 5. S_margin蓄積（デフラグ中）
        const hasPlant = this.plants.some(p => p.alive);
        if (hasPlant && this.s_local < this.s_critical) {
            this.s_margin += calcMarginAccumulation(this.s_critical, this.s_local, delta);
        }

        // 6. 動物誕生トリガー
        if (!triggered && !this.animalTriggered && isAnimalTrigger(this.s_margin, hasPlant)) {
            this.animalTriggered = true;
            this.phase = 'animal_ready';
            triggered = { type: 'animal' };
        }

        // 7. フェーズ更新
        this._updatePhase(hasPlant);

        // 8. 統計更新
        this._updateStats(phi, strain, delta, hasPlant);

        // 9. Writeout計算（旧Species.jsから継承：死による情報還流）
        const writeout = this._calcWriteout(phi, delta);

        // 10. エントロピー合計をEngineに返す
        const entropyDelta = this._calcEntropyTotal(phi, strain);

        return { entropyDelta, writeout, triggered };
    }

    // ── 植物誕生処理 ──────────────────────────────────────
    _onPlantGenesis(phi, env) {
        this.plantTriggered = true;

        // S_local急落（72%）
        this.s_local = calcPlantGenesisReset(this.s_local);

        // 冷却開始
        this.coolingMode  = true;
        this.coolingTimer = COOLING_PERIOD;
        this.phase        = 'plant_trigger';

        // 最初の植物を生成（環境に応じた種別）
        this._spawnPlant(env);

        return { type: 'plant' };
    }

    // ── 植物のスポーン ────────────────────────────────────
    _spawnPlant(env) {
        if (this.plants.length >= MAX_PLANTS) return;
        const plantType = selectPlantType(env);
        this.plants.push(new Plant({ plantType }));
    }

    // ── 植物群の更新 ──────────────────────────────────────
    _updatePlants(env, delta, phi, strain) {
        const toSpawn = [];

        for (const plant of this.plants) {
            plant.update(env, delta);

            // 繁殖チェック
            if (plant.readyToSpread && this.plants.length < MAX_PLANTS) {
                plant.readyToSpread = false;
                toSpawn.push(env);
            }
        }

        // 死んだ植物を除去（ただし死体は栄養還元のため少し残す）
        this.plants = this.plants.filter(p => p.alive || p.age < p.lifespan * 1.1);

        // 新しい植物を追加
        for (const e of toSpawn) this._spawnPlant(e);
    }

    // ── エントロピー合計 ──────────────────────────────────
    _calcEntropyTotal(phi, strain) {
        if (this.plants.length === 0) return 0;
        return this.plants.reduce((sum, p) => {
            return sum + p.getEntropyContribution(phi, strain);
        }, 0);
    }

    // ── Writeout（死による情報還流） ─────────────────────
    // 旧Species.jsのcalculateDeathWriteout()を継承
    _calcWriteout(phi, delta) {
        if (!this.plantTriggered) return 0;
        const alivePlants  = this.plants.filter(p => p.alive).length;
        const plantDensity = alivePlants / MAX_PLANTS;
        return plantDensity * this.writeoutEff * delta;
    }

    // ── 統計更新 ──────────────────────────────────────────
    _updateStats(phi, strain, delta, hasPlant) {
        const alivePlants = this.plants.filter(p => p.alive).length;

        // population：植物密度に連動
        if (hasPlant) {
            this.population = Math.min(1, 0.2 + alivePlants / MAX_PLANTS * 0.8);
        }

        // biodiversity：植物種の多様性
        const types = new Set(this.plants.filter(p => p.alive).map(p => p.plantType));
        this.biodiversity = types.size / 4; // 4種類が最大

        // drive：動物誕生後に蓄積（将来用）
        if (this.animalTriggered) {
            this.drive = Math.min(1, this.drive + 0.0001 * delta);
        }
    }

    // ── フェーズ更新 ──────────────────────────────────────
    _updatePhase(hasPlant) {
        if (this.animalTriggered) {
            this.phase = 'animal_ready';
        } else if (this.coolingMode && this.coolingTimer > 0) {
            this.phase = 'cooling';
        } else if (hasPlant && this.s_local < this.s_critical) {
            this.phase = 'plant_stable';
        } else if (this.plantTriggered) {
            this.phase = 'plant_trigger';
        } else {
            this.phase = 'accumulation';
        }
    }

    // ── 環境オブジェクト構築 ──────────────────────────────
    _buildEnv(bodySnap, climateSnap) {
        return {
            phi:       bodySnap.phi,
            strain:    bodySnap.strain,
            temp:      climateSnap.surfaceTemp  ?? 15,
            stability: climateSnap.stability    ?? 1.0,
            bgf:       bodySnap.bgf             ?? 19.15,
        };
    }


    // ── 物理的衝撃を受ける（EarthBodyのStrain解放から）────
    /**
     * Cascade/minor解放イベント時にEngine.jsから呼ばれる。
     * 全植物に一斉ストレスを与え、脆弱な個体を死亡させる。
     *
     * @param {number} intensity - 衝撃強度（0〜1）
     *   minor cascade  → 0.3〜0.5
     *   global cascade → 0.8〜1.0
     */
    onPhysicalShock(intensity) {
        if (intensity <= 0) return;

        // 全植物にストレスを蓄積
        // intensityが高いほど多くの個体が死亡する
        for (const plant of this.plants) {
            if (!plant.alive) continue;

            // 衝撃で成熟度を強制低下（脆弱化）
            plant.maturity = Math.max(0, plant.maturity - intensity * 0.4);

            // 高強度（0.7以上）は直接死亡
            if (intensity >= 0.7 && Math.random() < intensity * 0.6) {
                plant._die('physical_shock');
            }
        }

        // S_localを急上昇（衝撃でエントロピー放出）
        this.s_local += intensity * 5.0;

        // 冷却モードを強制解除（衝撃でデフラグ中断）
        if (intensity >= 0.5 && this.coolingMode) {
            this.coolingMode  = false;
            this.coolingTimer = 0;
        }

        // 人口・biodiversity低下
        this.population   = Math.max(0, this.population   - intensity * 0.3);
        this.biodiversity = Math.max(0, this.biodiversity - intensity * 0.4);

        // 大域Cascade（intensity≥0.8）は植物誕生フラグをリセット
        // → 次サイクルで再び過飽和から誕生できる
        if (intensity >= 0.8) {
            this.plantTriggered  = false;
            this.animalTriggered = false;
            this.s_margin        = 0;
            this.phase           = 'accumulation';
        }
    }

    // ── スナップショット（Engine/UI用） ────────────────────
    getSnapshot() {
        const alivePlants = this.plants.filter(p => p.alive).length;
        return {
            phase:          this.phase,
            population:     +this.population.toFixed(3),
            drive:          +this.drive.toFixed(4),
            biodiversity:   +this.biodiversity.toFixed(3),
            s_local:        +this.s_local.toFixed(4),
            s_critical:     +this.s_critical.toFixed(4),
            s_margin:       +this.s_margin.toFixed(3),
            saturation:     +this.saturation.toFixed(3),
            plantCount:     alivePlants,
            animalCount:    this.animals.length,
            plantTriggered: this.plantTriggered,
            animalTriggered:this.animalTriggered,
            coolingTimer:   this.coolingTimer,
            // 旧Species互換（Engine.jsが参照）
            isExtinct:      this.population <= 0,
            extinctionCause: null,
        };
    }

    reset() {
        Object.assign(this, new Biosphere());
    }
}
