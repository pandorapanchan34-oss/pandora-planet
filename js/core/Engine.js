// ============================================================
// PANDORA EARTH — js/core/Engine.js  (v2 layered)
// オーケストレーター
//
// ✅ FIX①: 内部の_loop()/requestAnimationFrameを削除。
//    ループはmain.jsが一元管理する。
//    Engine.update(delta)はmain.jsから呼ばれる外部駆動方式に変更。
//    start()/stop()はactiveフラグの管理のみ行う。
// ============================================================

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';
import { EarthBody }     from './EarthBody.js';
import { Biosphere }     from './Biosphere.js';
import { ClimateSystem } from '../environment/Climate.js';   // パス確認必要

export class PandoraEngine {

    constructor(planetConfig = {}) {
        this.active = false;
        this.time   = 0;

        // ── サブシステム ──────────────────────────────────
        this.body      = new EarthBody(planetConfig);
        this.biosphere = new Biosphere({
            initialPop:  planetConfig.species?.initialPop  ?? 0.2,
            writeoutEff: planetConfig.species?.writeoutEff ?? 0.0075,
        });
        this.climate   = new ClimateSystem(planetConfig);

        // ── 統合状態 ──────────────────────────────────────
        this.state = {
            year:      planetConfig.startYear ?? -800_000_000,
            phase:     'Pre-Biotic',
            prevPhase: null,
        };

        // ── イベントログ ───────────────────────────────────
        this.eventLog = [];
        this._maxLog  = 100;

        this._yearScale = planetConfig.yearScale ?? 1_000;

        // 初期化実行
        this._initialize();
    }

    _initialize() {
        this.body.update(0);
        this.climate.update(
            this.body.getSnapshot(),
            this.biosphere.getSnapshot(),
            0
        );
    }

    start() { this.active = true; }
    stop()  { this.active = false; }

    // ── メイン更新 ────────────────────────────────────────
    update(delta) {
        if (!this.active) return;

        this.time       += delta;
        this.state.year += this._yearScale * delta;

        const prevBodySnap = this.body.getSnapshot();
        const climateSnap  = this.climate.getSnapshot();

        // 1. 生命圏更新（植物の負エントロピー生成など）
        const { entropyDelta, writeout, triggered } =
            this.biosphere.update(prevBodySnap, climateSnap, delta);

        // 2. Biosphereからのエントロピー影響をEarthBodyに適用
        this.body.applyEntropy(entropyDelta);          // ← 追加（重要！）

        // 3. WriteoutによるΦ更新
        this.body.setPhi(prevBodySnap.phi + writeout);

        // 4. EarthBody物理更新（Strain、マントル、自転など）
        this.body.update(delta);

        // 5. 気候更新
        this.climate.update(
            this.body.getSnapshot(),
            this.biosphere.getSnapshot(),
            delta
        );

        // 6. その他監視・イベント処理
        this._updatePhase();
        this._checkEvents(prevBodySnap);

        if (triggered) this._onBiosphereEvent(triggered);
    }

    // ── フェーズ更新 ──────────────────────────────────────
    _updatePhase() {
        const phi = this.body.phi;
        const bio = this.biosphere.getSnapshot();
        const phi_c = PANDORA_DERIVED.PHI_IDEAL;

        let nextPhase = 'Pre-Biotic';
        if      (bio.animalTriggered && phi > phi_c * 1.20) nextPhase = 'Sapient';
        else if (bio.animalTriggered && phi > phi_c * 1.10) nextPhase = 'Complex';
        else if (bio.animalTriggered)                       nextPhase = 'Multicellular';
        else if (bio.plantTriggered && phi > phi_c)         nextPhase = 'Cambrian';
        else if (bio.plantTriggered)                        nextPhase = 'Plant-Era';

        if (nextPhase !== this.state.phase) {
            this._log('PHASE', `${this.state.phase} → ${nextPhase}`, 'phase');
            this.state.prevPhase = this.state.phase;
            this.state.phase = nextPhase;
        }
    }

    // ── イベント処理 ──────────────────────────────────────
    _onBiosphereEvent(triggered) {
        if (triggered.type === 'plant') {
            this._log('GENESIS', '第1次拡散：植物誕生', 'phase');
        } else if (triggered.type === 'animal') {
            this._log('GENESIS', '第二次拡散：動物誕生', 'phase');
        }
    }

    _checkEvents(prevBodySnap) {
        const body = this.body.getSnapshot();
        const bio  = this.biosphere.getSnapshot();

        if (body.isDischargeBlocked && !prevBodySnap.isDischargeBlocked) {
            this._log('DISCHARGE_BLOCKED', 'Strain放出飽和', 'warn');
        }
        if (bio.isExtinct) {
            this._log('EXTINCTION', '生命圏消滅', 'critical');
            this.stop();
        }
    }

    _log(type, message, level = 'info') {
        this.eventLog.push({
            time:    +this.time.toFixed(2),
            year:    Math.round(this.state.year / 1_000_000) + 'Ma',
            type,
            message,
            level
        });
        if (this.eventLog.length > this._maxLog) this.eventLog.shift();
    }

    // ── UI用スナップショット ───────────────────────────────
    getFullStatus() {
        return {
            time:      +this.time.toFixed(2),
            year:      Math.round(this.state.year / 1_000_000) + 'Ma',
            phase:     this.state.phase,
            body:      this.body.getSnapshot(),
            climate:   this.climate.getSnapshot(),
            biosphere: this.biosphere.getSnapshot(),
            // 旧Species互換（UIがまだ古い場合用）
            species: {
                population:   this.biosphere.getSnapshot().population,
                drive:        this.biosphere.getSnapshot().drive,
                biodiversity: this.biosphere.getSnapshot().biodiversity,
                isExtinct:    this.biosphere.getSnapshot().isExtinct,
            },
            active: this.active,
            log:    [...this.eventLog].reverse(),
        };
    }
}
