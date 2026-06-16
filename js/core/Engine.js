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

    // 🌟 コロシアム要塞群のデータレイヤーを惑星内に受肉
    this.fortresses = planetConfig.fortresses ? JSON.parse(JSON.stringify(planetConfig.fortresses)) : [];

    this.state = {
      year:  planetConfig.startYear ?? -800_000_000,
      phase: 'Pre-Biotic',
    };

    this.eventLog   = [];
    
    // ✅ FIX: earth.js の定義（1_000_000）を正しくマウント。なければ1Ma
    this._yearScale = planetConfig.yearScale ?? 1_000_000;

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

    // ✅ 全てのサブシステム（物理・気候・生命）に共通の加速時間軸（delta）を流し込む
    this.time       += delta;
    
    // 年代の進行も yearScale（1Ma）× delta で完全動相同期
    this.state.year += this._yearScale * delta;

    // 🛑 0Ma（現代 / 臨界点）に達したら時間を強制停止して Singularity 観測モードへ
    if (this.state.year >= 0) {
      this.state.year = 0;
    }

    const oldStrain = this.body.strain;
    const bodySnap  = this.body.getSnapshot();
    const climSnap  = this.climate.getSnapshot();

    // 🌿 Biosphere更新
    const bioResult = this.biosphere.update(bodySnap, climSnap, delta);

    if (bioResult) {
      this.body.setPhi(this.body.phi + bioResult.writeout);
      if (bioResult.entropyDelta !== 0) {
        this.body.applyEntropy(bioResult.entropyDelta);
      }
    }

    // ✅ 物理と気候システムにも、timeScale倍された delta を正確に伝播
    this.body.update(delta);

    // ⚡ Strain解放 → 物理衝撃
    const strainRelease = oldStrain - this.body.strain;
    if (strainRelease > 0.1) {
      this.biosphere.onPhysicalShock(strainRelease);
      this._log('GEOLOGICAL', `Shock: ${strainRelease.toFixed(2)}`, 'info');
    }

    // ✅ 気候システムへの同期
    this.climate.update(
      this.body.getSnapshot(),
      this.biosphere.getSnapshot(),
      delta
    );

    // 🟥 サイバー圏（コロシアム）の動的環境同期
    this._updateCyberSphere(climSnap, delta);

    HistoryManager.checkCriticalStates(this);
    this._updatePhase(this.body.phi);
  }

  /**
   * 🟥 マクロ（気候）からミクロ（要塞）への因果逆流処理
   */
  _updateCyberSphere(climateSnapshot, delta) {
    if (this.fortresses.length === 0) return;

    const temp = climateSnapshot.surfaceTemp;

    this.fortresses.forEach(fort => {
      if (temp > 40.0) {
        const decay = (temp - 40.0) * fort.climateSensitivity * delta;
        const oldRate = fort.defenseRate;
        fort.defenseRate = Math.max(0.0, fort.defenseRate - decay);
        fort.status = 'OVERHEAT_WARNING';

        if (oldRate >= 50.0 && fort.defenseRate < 50.0) {
          this._log('CYBER_ALERT', `要塞 ${fort.name} が過熱により防壁機能不全(50%未満)`, 'warn');
        }
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
