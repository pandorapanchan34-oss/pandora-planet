import { PANDORA_CONST }   from '../constants.js';
import { EarthBody }       from './EarthBody.js';
import { Biosphere }       from './Biosphere.js';
import { ClimateSystem }   from '../environment/Climate.js';
import { Events, EVENT, HistoryManager } from './Events.js';

export class PandoraEngine {

  constructor(planetConfig = {}) {
    this.active = false;
    this.time   = 0;

    this.body      = new EarthBody(planetConfig);
    this.biosphere = new Biosphere();
    this.climate   = new ClimateSystem(planetConfig);

    this.state = {
      year:  planetConfig.startYear ?? -800_000_000,
      phase: 'Pre-Biotic',
    };

    this.eventLog   = [];
    this._yearScale = 1000;

    this._initGlobalListeners();

    // 初期状態確定
    this.body.update(0);
    this.climate.update(
      this.body.getSnapshot(),
      this.biosphere.getSnapshot(),
      0
    );
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

    this.time       += delta;
    this.state.year += this._yearScale * delta;

    const oldStrain = this.body.strain;
    const bodySnap  = this.body.getSnapshot();
    const climSnap  = this.climate.getSnapshot();

    // 🌿 Biosphere更新 → 冷却量・還流を受け取る
    const bioResult = this.biosphere.update(bodySnap, climSnap, delta);

    if (bioResult) {
      // ✅ FIX①: writeout（還流）だけΦに直接加算
      //    entropyDelta（冷却）はapplyEntropy()経由でΦ変換
      this.body.setPhi(this.body.phi + bioResult.writeout);
      if (bioResult.entropyDelta !== 0) {
        this.body.applyEntropy(bioResult.entropyDelta);
      }
    }

    this.body.update(delta);

    // ⚡ Strain解放 → 物理衝撃
    const strainRelease = oldStrain - this.body.strain;
    if (strainRelease > 0.1) {
      this.biosphere.onPhysicalShock(strainRelease);
      this._log('GEOLOGICAL', `Shock: ${strainRelease.toFixed(2)}`, 'info');
    }

    // ✅ FIX③: climate.update()にbiosnapshotを渡す（型を合わせる）
    this.climate.update(
      this.body.getSnapshot(),
      this.biosphere.getSnapshot(),
      delta
    );

    HistoryManager.checkCriticalStates(this);
    this._updatePhase(this.body.phi);
  }

  _updatePhase(phi) {
    const bio = this.biosphere.getSnapshot();
    let next  = 'Pre-Biotic';

    if      (bio.animalTriggered && phi > PANDORA_CONST.PHI_IDEAL * 1.20) next = 'Sapient';
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

  // ✅ FIX②: UI互換キーを維持（body/species/climate）
  getFullStatus() {
    const bio = this.biosphere.getSnapshot();
    return {
      time:    +this.time.toFixed(2),
      year:    Math.round(this.state.year / 1_000_000) + 'Ma',
      phase:   this.state.phase,
      body:    this.body.getSnapshot(),
      climate: this.climate.getSnapshot(),
      species: {
        population:   bio.population,
        drive:        bio.drive,
        biodiversity: bio.biodiversity,
        isExtinct:    bio.isExtinct,
      },
      biosphere: bio,
      active:  this.active,
      log:     [...this.eventLog].reverse(),
    };
  }
}
