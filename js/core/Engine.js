import { PANDORA_CONST }   from '../constants.js';
import { EarthBody }       from './EarthBody.js';
import { Biosphere }       from './Biosphere.js';
import { ClimateSystem }   from '../environment/Climate.js';
// 🌟 環境の三圏システムを正式インポート
import { Atmosphere }      from '../environment/Atmosphere.js';
import { Geosphere }       from '../environment/Geosphere.js';
import { Hydrosphere }     from '../environment/Hydrosphere.js';
import { Events, EVENT, HistoryManager } from './Events.js';

export class PandoraEngine {

  constructor(planetConfig = {}) {
    this.active = false;
    this.time   = 0;

    // ── 惑星の物理核・生命圏 ──────────────────────
    this.body      = new EarthBody(planetConfig);
    this.biosphere = new Biosphere();

    // ── 🌟 凍結されていた環境システムを完全に受肉（インスタンス化） ──
    this.atmosphere = new Atmosphere(planetConfig);
    this.geosphere  = new Geosphere(planetConfig);
    this.hydrosphere = new Hydrosphere(planetConfig);
    this.climate     = new ClimateSystem(planetConfig);

    // コシアム要塞群のデータレイヤーを惑星内にマウント
    this.fortresses = planetConfig.fortresses ? JSON.parse(JSON.stringify(planetConfig.fortresses)) : [];

    this.state = {
      year:  planetConfig.startYear ?? -800_000_000,
      phase: 'Pre-Biotic',
    };

    this.eventLog   = [];
    this._yearScale = planetConfig.yearScale ?? 1_000_000;

    this._initGlobalListeners();

    // ── 初期状態の確定マウント ──
    const bodySnap = this.body.getSnapshot();
    const bioSnap  = this.biosphere.getSnapshot();
    
    // 初期大気・地殻・水圏の同期
    this.geosphere.update(bodySnap, 0);
    this.hydrosphere.update(bodySnap, { co2Level: this.atmosphere.co2Level }, this.climate.getSnapshot(), 0);
    this.atmosphere.update(bodySnap, bioSnap, this.climate.getSnapshot(), 0);

    // 三圏データを統合して気候システムを初期確定
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

    this.time       += delta;
    this.state.year += this._yearScale * delta;

    if (this.state.year >= 0) {
      this.state.year = 0;
    }

    const oldStrain = this.body.strain;
    
    // 各マクロ状態のスナップショットを取得
    let bodySnap = this.body.getSnapshot();
    let climSnap = this.climate.getSnapshot();
    let bioSnap  = this.biosphere.getSnapshot();

    // 1️⃣ 🌟 大気・地殻・水圏環境を delta 加速軸でリアルタイムアップデート！
    this.geosphere.update(bodySnap, delta);
    
    // 水圏に大気のCO2濃度をパスして循環
    this.hydrosphere.update(bodySnap, { co2Level: this.atmosphere.co2Level }, climSnap, delta);
    
    // 大気に生命の誕生フラグと植物数をパスして循環
    this.atmosphere.update(bodySnap, bioSnap, climSnap, delta);

    // 2️⃣ 🌟 環境データをブレンドした「完全版 climateInput」の生成
    const climateInput = {
      co2Level:     this.atmosphere.co2Level,
      oxygenLevel:  this.atmosphere.oxygenLevel,
      oceanTemp:    this.hydrosphere.oceanTemp,
      bufferEffect: this.hydrosphere.bufferEffect,
      drive:        this.biosphere.drive
    };

    // 3️⃣ 🌿 Biosphere更新（最新の酸素濃度や大気状態が生命に反映される！）
    // （※ 前回のステップで、Biosphereのenv内にoxygenLevelを読み込む回路がこれで100%覚醒します）
    const bioResult = this.biosphere.update(bodySnap, climateInput, delta);

    if (bioResult) {
      // 生物エントロピーの還流（植物・動物のgetEntropyContributionによる情報場デフラグ）
      // および大気・地殻・水圏がconvertRaw()した自然エントロピーの総和を地球コアにインジェクション！
      const envContribution = this.atmosphere.getEntropyContribution() 
                            + this.geosphere.getEntropyContribution() 
                            + this.hydrosphere.getEntropyContribution();

      this.body.setPhi(this.body.phi + bioResult.writeout);
      
      // 生命の冷却と自然環境のエントロピー負荷を合算して適用
      const finalEntropyDelta = bioResult.entropyDelta + envContribution;
      if (finalEntropyDelta !== 0) {
        this.body.applyEntropy(finalEntropyDelta);
      }
    }

    // 4️⃣ 惑星物理コアの更新
    this.body.update(delta);
    bodySnap = this.body.getSnapshot(); // 物理変化を再スキャン

    // ⚡ Strain解放 → 物理衝撃
    const strainRelease = oldStrain - this.body.strain;
    if (strainRelease > 0.1) {
      this.biosphere.onPhysicalShock(strainRelease);
      this._log('GEOLOGICAL', `Shock: ${strainRelease.toFixed(2)}`, 'info');
    }

    // 5️⃣ ✅ 気候統合システムへの「完全版データ入力」の注入（これで温室効果がCO2連動に！）
    this.climate.update(bodySnap, climateInput, delta);

    // 6️⃣ 🟥 サイバー圏（コロシアム）の動的環境同期
    this._updateCyberSphere(this.climate.getSnapshot(), delta);

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
      this._log('PHASE', `Enter ${next}`, 'phase
