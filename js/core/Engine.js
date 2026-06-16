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

    // 各サブシステムのインスタンス化（器官の受肉）
    this.body      = new EarthBody(planetConfig);
    this.biosphere = new Biosphere();
    this.climate   = new ClimateSystem(planetConfig);
    
    this.atmosphere  = new Atmosphere(planetConfig);
    this.geosphere   = new Geosphere(planetConfig);
    this.hydrosphere = new Hydrosphere(planetConfig);
    this.originManager = new OriginManager(planetConfig);

    // コロシアム要塞群のデータレイヤーを惑星内に受肉
    this.fortresses = planetConfig.fortresses ? JSON.parse(JSON.stringify(planetConfig.fortresses)) : [];

    this.state = {
      year:  planetConfig.startYear ?? -800_000_000,
      phase: 'Pre-Biotic',
    };

    this.eventLog   = [];
    
    // earth.js の定義（1_000_000）を正しくマウント。なければ1Ma
    this._yearScale = planetConfig.yearScale ?? 1_000_000;

    this._initGlobalListeners();

    // 初期状態確定の完全同期
    const bodySnap = this.body.getSnapshot();
    const bioSnap  = this.biosphere.getSnapshot();
    const atmoSnap = this.atmosphere.getSnapshot();
    
    this.geosphere.update(bodySnap, 0);
    this.hydrosphere.update(bodySnap, { co2Level: this.atmosphere.co2Level }, this.climate.getSnapshot(), 0);
    this.atmosphere.update(bodySnap, bioSnap, this.climate.getSnapshot(), 0);
    this.originManager.update(bodySnap, this.geosphere.getSnapshot(), atmoSnap, 0);

    const initialClimateInput = {
      co2Level:     this.atmosphere.co2Level,
      oxygenLevel:  this.atmosphere.oxygenLevel,
      oceanTemp:    this.hydrosphere.oceanTemp,
      bufferEffect: this.hydrosphere.bufferEffect,
      drive:        this.biosphere.drive
    };
    this.climate.update(bodySnap, initialClimateInput, 0);
  }

  _initGlobalListeners() {
    Events.on(EVENT.BLACK_HOLE, (payload) => {
      this._log('SINGULARITY', payload.message, 'critical');
      this.stop();
    });
  }

  start() { this.active = true;  }
  stop()  { this.active = false; }

  update(delta) {
    if (!this.active) return;

    // 全てのサブシステム（物理・気候・生命）に共通の加速時間軸（delta）を流し込む
    this.time       += delta;
    this.state.year += this._yearScale * delta;

    if (this.state.year >= 0) {
      this.state.year = 0;
    }

    const oldStrain = this.body.strain;
    let bodySnap    = this.body.getSnapshot();
    let climSnap    = this.climate.getSnapshot();
    let bioSnap     = this.biosphere.getSnapshot();
    let atmoSnap    = this.atmosphere.getSnapshot();

    // 1️⃣ 環境システムの更新
    this.geosphere.update(bodySnap, delta);
    this.hydrosphere.update(bodySnap, { co2Level: this.atmosphere.co2Level }, climSnap, delta);
    this.atmosphere.update(bodySnap, bioSnap, climSnap, delta);
    
    atmoSnap = this.atmosphere.getSnapshot();
    const geoSnap = this.geosphere.getSnapshot();

    // 2️⃣ 生命起源プレーンの同期 ＆ 誕生イベントの検知
    const originEvent = this.originManager.update(bodySnap, geoSnap, atmoSnap, delta);
    if (originEvent) {
      this._onOriginEvent(originEvent);
    }

    // 3️⃣ 環境パケット（生データ）のブレンド
    const climateInput = {
      surfaceTemp: this.climate.surfaceTemp,
      stability:   this.climate.stability,
      co2Level:     this.atmosphere.co2Level,
      oxygenLevel:  this.atmosphere.oxygenLevel,
      oceanTemp:    this.hydrosphere.oceanTemp,
      bufferEffect: this.hydrosphere.bufferEffect,
      drive:        this.biosphere.drive
    };

    // 4️⃣ 生命圏（Biosphere）の更新
    const bioResult = this.biosphere.update(bodySnap, climateInput, delta);

    if (bioResult) {
      const envContribution = this.atmosphere.getEntropyContribution() 
                            + this.geosphere.getEntropyContribution() 
                            + this.hydrosphere.getEntropyContribution();

      // 熱水噴出孔群が生成する「局所負エントロピー」も合算して還流
      const ventNegentropy = this.originManager.getTotalNegentropy();

      this.body.setPhi(this.body.phi + bioResult.writeout);
      
      const finalEntropyDelta = bioResult.entropyDelta + envContribution + ventNegentropy;
      if (finalEntropyDelta !== 0) {
        this.body.applyEntropy(finalEntropyDelta);
      }
    }

    // 5️⃣ 惑星物理本体の更新
    this.body.update(delta);
    bodySnap = this.body.getSnapshot();

    // Strain解放 → 物理衝撃の伝播
    const strainRelease = oldStrain - this.body.strain;
    if (strainRelease > 0.1) {
      this.biosphere.onPhysicalShock(strainRelease);
      this._log('GEOLOGICAL', `Shock: ${strainRelease.toFixed(2)}`, 'info');
    }

    // 6️⃣ 気候システムへのフィードバック同期
    this.climate.update(bodySnap, climateInput, delta);

    // 7️⃣ コロシアム要塞の環境同期
    this._updateCyberSphere(this.climate.getSnapshot(), delta);

    HistoryManager.checkCriticalStates(this);
    this._updatePhase(this.body.phi);
  }

  _onOriginEvent(event) {
    this._log('GENESIS_CORE', `[${event.source.toUpperCase()}] ${event.message}`, 'warn');
    if (event.type === 'first_genesis') {
      this.biosphere.plantTriggered = true; 
      Events.emit(EVENT.PLANT_BORN, { source: event.source });
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

    if      (bio.animalTriggered && phi > PANDORA_CONST.PHI_IDEAL * 1.30) next = 'Singularity';
    else if (bio.animalTriggered && phi > PANDORA_CONST.PHI_IDEAL * 1.20) next = 'Sapient';
    else if (bio.animalTriggered && phi > PANDORA_CONST.PHI_IDEAL * 1.10) next = 'Complex';
    else if (bio.animalTriggered)                                          next = 'Multicellular';
    else if (bio.plantTriggered  && phi > PANDORA_CONST.PHI_IDEAL)        next = 'Cambrian';
    else if (bio.plantTriggered)                                           next = 'Plant-Era';
    else                                                                   next = 'Pre-Biotic';

    if (next !== this.state.phase) {
      this.state.phase = next;
      this._log('PHASE', `Enter ${next}`, 'phase');
      Events.emit(EVENT.PHASE_CHANGED, { to: next });
    }
  }

  _log(type, message, level = 'info') {
    this.eventLog.push({
      time:    +this.time.toFixed(2),
      year:    Math.round(this.state.year / 1_000_000) + 'Ma',
      type, message, level,
    });
    if (this.eventLog.length > 100) this.eventLog.shift();
  }

  getFullStatus() {
    const bio = this.biosphere.getSnapshot();
    return {
      time:    +this.time.toFixed(2),
      year:    Math.round(this.state.year / 1_000_000) + 'Ma',
      phase:   this.state.phase,
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
