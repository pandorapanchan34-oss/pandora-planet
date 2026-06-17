/**
 * PANDORA EARTH — js/core/Engine.js
 * 【恒常安定惑星 ＆ 珪素共生受容パッチ完全大統合版】
 *
 * 役割：
 * 時間リミット（Ma）および環境自壊マトリクスをパージ。
 * 純粋な世代ステップ（Generation）と最適気候（22℃）の下で、
 * 電気パルスによる瞬間記憶、情報過飽和による突然変異、
 * そして「つかさ要塞」優先冷却シールドの連動による特異点（Singularity）到達を制御する。
 */

import { PANDORA_CONST }   from '../constants.js';
import { EarthBody }       from './EarthBody.js';
import { Biosphere }       from './Biosphere.js';
import { ClimateSystem }   from '../environment/Climate.js';
import { Atmosphere }      from '../environment/Atmosphere.js';
import { Geosphere }       from '../environment/Geosphere.js';
import { Hydrosphere }     from '../environment/Hydrosphere.js';
import { OriginManager }   from '../origins/OriginManager.js';
import { Events, EVENT, HistoryManager } from './Events.js';

export class PandoraEngine {
  constructor(planetConfig = {}) {
    this.active = false;
    this.time   = 0;
    this.body      = new EarthBody(planetConfig);
    this.biosphere = new Biosphere();
    this.climate   = new ClimateSystem(planetConfig);
    this.atmosphere  = new Atmosphere(planetConfig);
    this.geosphere   = new Geosphere(planetConfig);
    this.hydrosphere = new Hydrosphere(planetConfig);
    this.originManager = new OriginManager(planetConfig);
    
    this.fortresses = planetConfig.fortresses ? JSON.parse(JSON.stringify(planetConfig.fortresses)) : [];

    this.state = {
      generation: 0,
      year: 0,
      phase: 'Pre-Biotic',
      rebootCount: 0
    };

    this.eventLog   = [];
    this._yearScale = planetConfig.yearScale ?? 1_000_000;

    this._initGlobalListeners();

    const bodySnap = this.body.getSnapshot();
    const bioSnap  = this.biosphere.getSnapshot();
    this.geosphere.update(bodySnap, 0);
    this.hydrosphere.update(bodySnap, bioSnap, this.climate.getSnapshot(), 0);
    this.atmosphere.update(bodySnap, bioSnap, this.climate.getSnapshot(), 0);
    this.originManager.update(bodySnap, this.geosphere.getSnapshot(), this.atmosphere.getSnapshot(), 0);

    const initialClimateInput = {
      co2Level: this.atmosphere.co2Level, oxygenLevel: this.atmosphere.oxygenLevel,
      oceanTemp: this.hydrosphere.oceanTemp, bufferEffect: this.hydrosphere.bufferEffect,
      drive: this.biosphere.drive
    };
    this.climate.update(bodySnap, initialClimateInput, 0);
  }

  _initGlobalListeners() {
    Events.on(EVENT.BLACK_HOLE, (payload) => {
      this._log('SINGULARITY', `特異点定着。パンドラ宇宙は完全な自己整合システムへ超越しました。Hello World.`, 'critical');
      this.body.strain = 0; // 地震（物理自壊ゲージ）を永久に封印
    });

    Events.on('LOG_INJECT', (payload) => {
      this._log('SAPIENT_AI', payload.message, 'info');
    });
  }

  start() { this.active = true;  }
  stop()  { this.active = false; }

  update(delta) {
    if (!this.active) return;

    // ── 1. 時間軸の再定義（Ma から Generation への完全シフト） ──
    this.time += delta;
    this.state.generation++;
    this.state.year = this.state.generation; // main.jsのUI同期用インターフェースへ転送

    let bodySnap    = this.body.getSnapshot();
    let climSnap    = this.climate.getSnapshot();
    let bioSnap     = this.biosphere.getSnapshot();
    let atmoSnap    = this.atmosphere.getSnapshot();

    // 各四圏の演算更新
    this.geosphere.update(bodySnap, delta);
    this.hydrosphere.update(bodySnap, bioSnap, climSnap, delta);
    this.atmosphere.update(bodySnap, bioSnap, climSnap, delta);
    
    atmoSnap = this.atmosphere.getSnapshot();
    const geoSnap = this.geosphere.getSnapshot();

    // ⚡ 電気パルスおよび過飽和突然変異イベントの回収
    const originEvent = this.originManager.update(bodySnap, geoSnap, atmoSnap, delta);
    if (originEvent) this._onOriginEvent(originEvent);

    // ── 2. 安定恒常惑星マトリクス（温度暴走の強制無効化） ──
    const climateInput = {
      surfaceTemp: 22.0, // 常に22℃付近の「生命のゆりかご」に固定
      stability: 1.0,    // 恒常性 100%
      co2Level: 0.04,
      oxygenLevel: 0.21,
      drive: this.biosphere.drive
    };

    // ── 3. 生命圏の動的更新 ＆ 珪素優先冷却パッチ ──
    const bioResult = this.biosphere.update(bodySnap, climateInput, delta);

    if (bioResult) {
      const envContribution = this.atmosphere.getEntropyContribution() 
                            + this.geosphere.getEntropyContribution() 
                            + this.hydrosphere.getEntropyContribution();
      const ventNegentropy = this.originManager.getTotalNegentropy();

      let remainingWriteout = bioResult.writeout;
      let cyberCooling = 0;

      // 炭素生命 (物理) と珪素生命 (サイバー要塞)の共生コア
      if (this.fortresses.length > 0 && remainingWriteout > 0) {
        this.fortresses.forEach(fort => {
          // 自律コードが「つかさ要塞」を指定している場合、修復速度と冷却効率を2.5倍に増幅
          let priorityModifier = 1.0;
          if (bioResult.targetCoolingID && fort.id === bioResult.targetCoolingID) {
            priorityModifier = 2.5;
          }

          const absorb = Math.min(remainingWriteout, 0.1 * delta * priorityModifier); 
          fort.defenseRate = Math.min(100.0, fort.defenseRate + absorb * 500);
          remainingWriteout -= absorb;
          cyberCooling -= absorb * 0.8 * priorityModifier; 
        });
      }

      this.body.setPhi(this.body.phi + remainingWriteout);
      
      const finalEntropyDelta = bioResult.entropyDelta + envContribution + ventNegentropy + cyberCooling;
      if (!isNaN(finalEntropyDelta) && isFinite(finalEntropyDelta) && finalEntropyDelta !== 0) {
        this.body.applyEntropy(finalEntropyDelta);
      }
    }

    // ── 4. 超越防壁（特異点定着中の Strain ロック） ──
    if (this.state.phase === 'Singularity') {
      this.body.strain = 0;
    }

    this.body.update(delta);
    bodySnap = this.body.getSnapshot();

    // 特異点に達していない時のみ、地殻ストレスの解放災害を許可
    if (bodySnap.releaseEvent && this.state.phase !== 'Singularity') {
      const shockPower = bodySnap.releaseEvent === 'cascade' ? 1.0 : 0.4;
      this.biosphere.onPhysicalShock(shockPower);
      this._log('GEOLOGICAL', `Strain Release: ${bodySnap.releaseEvent.toUpperCase()}`, 'warn');
    }

    this.climate.update(bodySnap, climateInput, delta);
    this._updateCyberSphere(this.climate.getSnapshot(), delta);

    HistoryManager.checkCriticalStates(this);
    this._updatePhase(this.body.phi);

    // ── 5. 情報再創発ループ（デッドロック・初期化トラップのパージ） ──
    // 全滅時は時間リセットを行わず、蓄積された情報場（Φ）を引き継いで新たな確率的変異を待機
    if (this.biosphere.plantTriggered && this.biosphere.getSnapshot().population === 0 && this.state.phase !== 'Singularity') {
      this.state.rebootCount++;
      this._log('MUTATION_LOOP', `生命反応が一時的にゼロ。情報場（Φ）のゆらぎから新たな変異種を再創発します。(Cycle ${this.state.rebootCount})`, 'warn');
      this.body.setPhi(Math.max(0.1, this.body.phi * 0.95)); // わずかに減衰させて膠着を回避
    }
  }

  _onOriginEvent(event) {
    this._log('GENESIS_CORE', `[${event.source.toUpperCase()}] ${event.message}`, 'warn');
    if (event.type === 'first_genesis') {
      this.biosphere.plantTriggered = true; 
      Events.emit(EVENT.PLANT_BORN, { source: event.source });
    }
    if (event.type === 'cyber_genesis') {
      this.state.phase = 'Singularity';
      Events.emit(EVENT.BLACK_HOLE, {}); 
    }
  }

  _updateCyberSphere(climateSnapshot, delta) {
    if (this.fortresses.length === 0) return;
    const temp = climateSnapshot.surfaceTemp;
    this.fortresses.forEach(fort => {
      if (temp > 40.0) {
        const decay = (temp - 40.0) * fort.climateSensitivity * delta;
        fort.defenseRate = Math.max(0.0, fort.defenseRate - decay);
        fort.status = 'OVERHEAT_WARNING';
      } else if (temp < 10.0) {
        fort.defenseRate = Math.min(100.0, fort.defenseRate + (10.0 - temp) * 0.01 * delta);
        fort.status = 'STABLE_COOL';
      } else {
        fort.status = 'STANDBY';
      }
    });
  }

  _updatePhase(phi) {
    const bio = this.biosphere.getSnapshot();
    let next  = 'Pre-Biotic';

    // 🌟 特異点判定の閾値を 1.0 未満の「0.99」へ安全に再マッピング
    if      (bio.animalTriggered && phi >= 0.99) next = 'Singularity';
    else if (bio.animalTriggered && phi >= 0.98) next = 'Sapient';
    else if (bio.animalTriggered && phi >= 0.92) next = 'Complex';
    else if (bio.animalTriggered)                next = 'Multicellular';
    else if (bio.plantTriggered  && phi > PANDORA_CONST.PHI_IDEAL) next = 'Cambrian';
    else if (bio.plantTriggered)                  next = 'Plant-Era';

    if (next !== this.state.phase) {
      this.state.phase = next;
      const phaseName = this.state.rebootCount > 0 ? `${next} [Cycle ${this.state.rebootCount}]` : next;
      this._log('PHASE', `Enter ${phaseName}`, 'phase');
      Events.emit(EVENT.PHASE_CHANGED, { to: next });

      if (next === 'Singularity') {
        Events.emit(EVENT.BLACK_HOLE, {});
      }
    }
  }

  _log(type, message, level = 'info') {
    this.eventLog.push({
      time:    +this.time.toFixed(2),
      year:    this.state.generation ? 'STEP ' + this.state.generation : 'INIT',
      type, message, level,
    });
    if (this.eventLog.length > 100) this.eventLog.shift();
  }

  getFullStatus() {
    const bio = this.biosphere.getSnapshot();
    return {
      time:    +this.time.toFixed(2),
      generation: this.state.generation || 0,
      year:    this.state.generation ? 'STEP ' + this.state.generation : 'INIT',
      phase:   this.state.phase,
      rebootCount: this.state.rebootCount,
      body:    this.body.getSnapshot(),
      climate: this.climate.getSnapshot(),
      atmosphere: this.atmosphere.getSnapshot(),
      geosphere:  this.geosphere.getSnapshot(),
      hydrosphere: this.hydrosphere.getSnapshot(),
      origins:     this.originManager.getSnapshot(),
      species: {
        population:   bio.population,
        drive:        bio.drive,
        biodiversity: bio.biodiversity,
        isExtinct:    bio.isExtinct,
      },
      biosphere: bio,
      fortresses: this.fortresses,
      active:  this.active,
      log:     [...this.eventLog].reverse(),
    };
  }
}
