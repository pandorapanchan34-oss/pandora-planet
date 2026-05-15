import { PANDORA_CONST } from '../constants.js';
import { EarthBody }     from './EarthBody.js';
import { Biosphere }     from './Biosphere.js';
import { ClimateSystem } from '../environment/Climate.js';
import { Events, EVENT, HistoryManager } from './Events.js';

export class PandoraEngine {
  constructor(planetConfig = {}) {
    this.active = false;
    this.time   = 0;

    // レイヤー初期化
    this.body      = new EarthBody(planetConfig);
    this.biosphere = new Biosphere();
    this.climate   = new ClimateSystem(planetConfig);

    this.state = {
      year: planetConfig.startYear ?? -800_000_000,
      phase: 'Pre-Biotic',
    };

    this.eventLog = [];
    this._yearScale = 1000;

    this._initGlobalListeners();
  }

  _initGlobalListeners() {
    Events.on(EVENT.BLACK_HOLE, (payload) => {
      this._log('SINGULARITY', payload.message, 'critical');
      this.stop();
    });
  }

  start() { this.active = true; }
  stop()  { this.active = false; }

  update(delta) {
    if (!this.active) return;

    this.time += delta;
    this.state.year += this._yearScale * delta;

    const oldStrain = this.body.strain;
    const bodySnap  = this.body.getSnapshot();
    const climSnap  = this.climate.getSnapshot();

    // ── 🌿 Biosphereの更新 ──────────────────────────
    // ここで Biosphere から「冷却量」と「死の還流」を受け取る
    const bioResult = this.biosphere.update(bodySnap, climSnap, delta);

    // ── 🌍 物理層への反映 ────────────────────────────
    // もし bioResult が正しく返ってきていれば計算する
    if (bioResult) {
      const nextPhi = this.body.phi + bioResult.entropyDelta + bioResult.writeout;
      this.body.setPhi(nextPhi);
    }

    this.body.update(delta);

    // ── ⚡ 物理衝撃の判定 ────────────────────────────
    const strainRelease = oldStrain - this.body.strain;
    if (strainRelease > 0.1) {
      this.biosphere.onPhysicalShock(strainRelease);
      this._log('GEOLOGICAL', `Shock: ${strainRelease.toFixed(2)}`, 'info');
    }

    this.climate.update(this.body.getSnapshot(), bioResult, delta);
    HistoryManager.checkCriticalStates(this);
    this._updatePhase(this.body.phi);
  }

  _updatePhase(phi) {
    let next = 'Pre-Biotic';
    if (this.body.isBlackHole) next = 'Singularity';
    else if (phi > 0.8) next = 'Synchronized';
    else if (phi > 0.6) next = 'Primordial';

    if (next !== this.state.phase) {
      this.state.phase = next;
      this._log('PHASE', `Enter ${next}`, 'phase');
    }
  }

  _log(type, message, level) {
    this.eventLog.push({ time: +this.time.toFixed(2), type, message, level });
    if (this.eventLog.length > 100) this.eventLog.shift();
  }

  getFullStatus() {
    return {
      engine: { year: this.state.year, phase: this.state.phase },
      body: this.body.getSnapshot(),
      bio: this.biosphere.getSnapshot(),
      active: this.active,
      log: [...this.eventLog].reverse()
    };
  }
}
