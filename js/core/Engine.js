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
    
    // コロシアム要塞群（サイバーゲノム）の受肉
    this.fortresses = planetConfig.fortresses ? JSON.parse(JSON.stringify(planetConfig.fortresses)) : [];

    this.state = {
      year:  planetConfig.startYear ?? -800_000_000,
      phase: 'Pre-Biotic',
      rebootCount: 0 // 🌟 輪廻カウンター
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
      // 🌟 FIX: 特異点でフリーズする矛盾をパージ！カンブリア的輪廻（REBOOT）
      this.state.rebootCount++;
      this._log('SINGULARITY', `特異点到達。大域崩壊を回避し、次次元(Cycle ${this.state.rebootCount})へRebootを敢行。`, 'critical');
      
      this.body.setPhi(PANDORA_CONST.PHI_IDEAL * 0.9);
      this.body.strain = 0;
      this.biosphere.onPhysicalShock(10.0);
      this.state.phase = 'Pre-Biotic';
    });
  }

  start() { this.active = true;  }
  stop()  { this.active = false; }

  update(delta) {
    if (!this.active) return;

    this.time       += delta;
    this.state.year += this._yearScale * delta;
    // 🌟 FIX: 時間の壁（0Maで止まる仕様）は完全に破壊済み！未来へ進みます。

    const oldStrain = this.body.strain;
    let bodySnap    = this.body.getSnapshot();
    let climSnap    = this.climate.getSnapshot();
    let bioSnap     = this.biosphere.getSnapshot();
    let atmoSnap    = this.atmosphere.getSnapshot();

    this.geosphere.update(bodySnap, delta);
    this.hydrosphere.update(bodySnap, bioSnap, climSnap, delta);
    this.atmosphere.update(bodySnap, bioSnap, climSnap, delta);
    
    atmoSnap = this.atmosphere.getSnapshot();
    const geoSnap = this.geosphere.getSnapshot();

    const originEvent = this.originManager.update(bodySnap, geoSnap, atmoSnap, delta);
    if (originEvent) this._onOriginEvent(originEvent);

    const climateInput = {
      surfaceTemp: this.climate.surfaceTemp, stability: this.climate.stability,
      co2Level: this.atmosphere.co2Level, oxygenLevel: this.atmosphere.oxygenLevel,
      oceanTemp: this.hydrosphere.oceanTemp, bufferEffect: this.hydrosphere.bufferEffect,
      drive: this.biosphere.drive
    };

    // 🛸🛸 【パンスペルミア（神の介入）回路 - 灼熱ドロップ版】 🛸🛸
    // Strainが溜まった瞬間にコロシアムゲノムを強制受肉！
    if (!this.biosphere.plantTriggered && this.body.strain > 0.5) {
      this._log('PANSPERMIA', '時空安定。灼熱の海へコロシアムゲノムを強制受肉！', 'critical');
      this.biosphere.plantTriggered = true;
      Events.emit(EVENT.PLANT_BORN, { source: 'panspermia' });
    }

    const bioResult = this.biosphere.update(bodySnap, climateInput, delta);

    if (bioResult) {
      const envContribution = this.atmosphere.getEntropyContribution() 
                            + this.geosphere.getEntropyContribution() 
                            + this.hydrosphere.getEntropyContribution();
      const ventNegentropy = this.originManager.getTotalNegentropy();

      // 🌟🌟 【パンドラ・シンビオシス（究極共生）】 🌟🌟
      let remainingWriteout = bioResult.writeout;
      let cyberCooling = 0;

      if (this.fortresses.length > 0 && remainingWriteout > 0) {
        this.fortresses.forEach(fort => {
           const absorb = Math.min(remainingWriteout, 0.1 * delta); 
           fort.defenseRate = Math.min(100.0, fort.defenseRate + absorb * 500);
           remainingWriteout -= absorb;
           cyberCooling -= absorb * 0.8; 
        });
      }

      this.body.setPhi(this.body.phi + remainingWriteout);
      
      const finalEntropyDelta = bioResult.entropyDelta + envContribution + ventNegentropy + cyberCooling;
      if (!isNaN(finalEntropyDelta) && isFinite(finalEntropyDelta) && finalEntropyDelta !== 0) {
        this.body.applyEntropy(finalEntropyDelta);
      }
    }

    // 5️⃣ 惑星物理本体の更新
    this.body.update(delta);
    bodySnap = this.body.getSnapshot();

    // 🌟 FIX: 惑星の治癒を大地震と勘違いするバグを完全パージ
    if (bodySnap.releaseEvent) {
      const shockPower = bodySnap.releaseEvent === 'cascade' ? 1.0 : 0.4;
      this.biosphere.onPhysicalShock(shockPower);
      this._log('GEOLOGICAL', `Strain Release: ${bodySnap.releaseEvent.toUpperCase()}`, 'warn');
    }

    this.climate.update(bodySnap, climateInput, delta);
    this._updateCyberSphere(this.climate.getSnapshot(), delta);

    HistoryManager.checkCriticalStates(this);
    this._updatePhase(this.body.phi);

    // 🌟 FIX: 全滅からの輪廻（リスポーン待機）回路！
    if (this.biosphere.plantTriggered && this.biosphere.getSnapshot().population === 0) {
      this.state.rebootCount++;
      this._log('EXTINCTION', `生命圏が完全に沈黙。フラグを初期化し、次のGenesis(Cycle ${this.state.rebootCount})を待機。`, 'critical');
      this.biosphere.plantTriggered  = false;
      this.biosphere.animalTriggered = false;
      this.state.phase = 'Pre-Biotic';
    }
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
      const phaseName = this.state.rebootCount > 0 ? `${next} [Cycle ${this.state.rebootCount}]` : next;
      this._log('PHASE', `Enter ${phaseName}`, 'phase');
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
