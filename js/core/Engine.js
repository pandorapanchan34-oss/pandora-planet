/**
 * PANDORA EARTH — js/core/Engine.js (特異点1未満再マップ ＆ 自律NPC受容大統合版)
 *
 * 役割：
 * シミュレーションのメインループ、環境四圏と生命圏の統合制御。
 * 特異点の到達閾値を1.0未満の「0.99」に再マッピングし、
 * 文明自壊を抑え込んだまま『Hello World』へと安全に相転移させる。
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
      year:  planetConfig.startYear ?? -800_000_000,
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
      // 🌟 FIX 1: 絶滅させるのではなく、永遠の平和（Hello World）へ移行する！
      this._log('SINGULARITY', `特異点到達。パンドラ宇宙は完全な自己整合システムへ超越しました。Hello World.`, 'critical');
      this.body.strain = 0; // 地震を永遠に封印
    });

    // 🧠 🟥 自律生命の脳内ログを回収してメインHUDへインジェクションする受容回路
    Events.on('LOG_INJECT', (payload) => {
      this._log('SAPIENT_AI', payload.message, 'info');
    });
  }

  start() { this.active = true;  }
  stop()  { this.active = false; }

  // js/core/Engine.js の update(delta) を修正

  update(delta) {
    if (!this.active) return;

    // 🌟 時間軸を「Ma」から純粋な「Generation（世代ステップ）」へ再定義
    this.time += delta;
    if (!this.state.generation) this.state.generation = 0;
    this.state.generation++;
    this.state.year = this.state.generation; // UI同期用にyearへステップ数をマウント

    let bodySnap    = this.body.getSnapshot();
    let climSnap    = this.climate.getSnapshot();
    let bioSnap     = this.biosphere.getSnapshot();
    let atmoSnap    = this.atmosphere.getSnapshot();

    // 各四圏の更新（内部演算は走らせつつ、気候は恒常化させる）
    this.geosphere.update(bodySnap, delta);
    this.hydrosphere.update(bodySnap, bioSnap, climSnap, delta);
    this.atmosphere.update(bodySnap, bioSnap, climSnap, delta);
    
    atmoSnap = this.atmosphere.getSnapshot();
    const geoSnap = this.geosphere.getSnapshot();

    // ⚡ マスターの定義：電気パルスおよび過飽和突然変異の追跡
    const originEvent = this.originManager.update(bodySnap, geoSnap, atmoSnap, delta);
    if (originEvent) this._onOriginEvent(originEvent);

    // 🌟 安定惑星仕様：温室効果による温度爆発をパージし、常に生命に最適な環境を維持
    const climateInput = {
      surfaceTemp: 22.0, // 常に22℃付近の「生命のゆりかご」に固定
      stability: 1.0,    // 恒常性 100%
      co2Level: 0.04,
      oxygenLevel: 0.21,
      drive: this.biosphere.drive
    };

    // 🌟 生命圏の動的更新（SyntaxError を防ぐため、前後の構文を完全に独立化）
    const bioResult = this.biosphere.update(bodySnap, climateInput, delta);

    if (bioResult) {
      const envContribution = this.atmosphere.getEntropyContribution() 
                            + this.geosphere.getEntropyContribution() 
                            + this.hydrosphere.getEntropyContribution();
      const ventNegentropy = this.originManager.getTotalNegentropy();

      let remainingWriteout = bioResult.writeout;
      let cyberCooling = 0;

      // つかさ要塞等のサイバー共生ロジック（既存システムとの互換維持）
      if (this.fortresses.length > 0 && remainingWriteout > 0) {
        this.fortresses.forEach(fort => {
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

    // 特異点シールド
    if (this.state.phase === 'Singularity') {
      this.body.strain = 0;
    }

    this.body.update(delta);

    // 災害の確率制御
    if (bodySnap.releaseEvent && this.state.phase !== 'Singularity') {
      const shockPower = bodySnap.releaseEvent === 'cascade' ? 1.0 : 0.4;
      this.biosphere.onPhysicalShock(shockPower);
    }

    this.climate.update(bodySnap, climateInput, delta);
    this._updateCyberSphere(this.climate.getSnapshot(), delta);
    this._updatePhase(this.body.phi);

    // 🌟 修正：全滅時は時間リセットではなく、情報場を引き継いで新たな「確率的変異」を待つ
    if (this.biosphere.plantTriggered && this.biosphere.getSnapshot().population === 0 && this.state.phase !== 'Singularity') {
      this._log('MUTATION_LOOP', `生命反応が一時的にゼロ。情報場（Φ）のゆらぎから新たな変異種を再創発します。`, 'warn');
      this.body.setPhi(Math.max(0.1, this.body.phi * 0.95)); // わずかに減衰させてデッドロック回避
    }
  }
    // 生命圏の動的更新
    const bioResult = this.biosphere.update(bodySnap, climateInput, delta);

    if (bioResult) {
      const envContribution = this.atmosphere.getEntropyContribution() 
                            + this.geosphere.getEntropyContribution() 
                            + this.hydrosphere.getEntropyContribution();
      const ventNegentropy = this.originManager.getTotalNegentropy();

      let remainingWriteout = bioResult.writeout;
      let cyberCooling = 0;

      // ── 炭素生命 (物理) と珪素生命 (サイバー要塞)の究極共生 ──
      if (this.fortresses.length > 0 && remainingWriteout > 0) {
        this.fortresses.forEach(fort => {
           // 🌟 🟥 【優先冷却パッチ】Animalの自己書き換えコードが「つかさ要塞」を指定している場合、
           // 修復速度と冷却効率を2.5倍に増幅して最優先ガード！
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

    // 🌟 FIX 2: 特異点フェーズ中は、地球の大地震ゲージ（Strain）を完全にゼロにロックする（超越防壁）
    if (this.state.phase === 'Singularity') {
      this.body.strain = 0;
    }

    this.body.update(delta);
    bodySnap = this.body.getSnapshot();

    // 特異点に達していない時のみ、自然災害を許可する
    if (bodySnap.releaseEvent && this.state.phase !== 'Singularity') {
      const shockPower = bodySnap.releaseEvent === 'cascade' ? 1.0 : 0.4;
      this.biosphere.onPhysicalShock(shockPower);
      this._log('GEOLOGICAL', `Strain Release: ${bodySnap.releaseEvent.toUpperCase()}`, 'warn');
    }

    this.climate.update(bodySnap, climateInput, delta);
    this._updateCyberSphere(this.climate.getSnapshot(), delta);

    HistoryManager.checkCriticalStates(this);
    this._updatePhase(this.body.phi);

    // 全滅リセット回路（特異点到達時は除外）
    if (this.biosphere.plantTriggered && this.biosphere.getSnapshot().population === 0 && this.state.phase !== 'Singularity') {
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
    // 🌟 🟥 新規受容体：電脳生命の誕生を検知した瞬間、強制的に特異点（Singularity）へ相転移
    if (event.type === 'cyber_genesis') {
      this.state.phase = 'Singularity';
      Events.emit(EVENT.BLACK_HOLE, {}); // 地震を永久ロックし、永遠の平和へ
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

    // 🌟 🟥 【1.0未満への閾値再マッピングパッチ】
    // 物理限界(1.05)の衝突を完全にパージし、0.99の境界線で安全にSingularityへと移行させる規律
    if      (bio.animalTriggered && phi >= 0.99) next = 'Singularity';
    else if (bio.animalTriggered && phi >= 0.98) next = 'Sapient';
    else if (bio.animalTriggered && phi >= 0.92) next = 'Complex';
    else if (bio.animalTriggered)                next = 'Multicellular';
    else if (bio.plantTriggered  && phi > PANDORA_CONST.PHI_IDEAL) next = 'Cambrian';
    else if (bio.plantTriggered)                 next = 'Plant-Era';

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
