/**
 * PANDORA EARTH — js/entities/Animal.js (自己書き換えNPC ＆ 能動的忘却 拡張マウント版)
 * 動物圏（Drive生成者・情報消費者 ＋ 文明特異点モジュール統合版）
 */

import { Individual, ENTITY_TYPE } from './Individual.js';
import { calcSLocal }              from '../core/Entropy.js';
import { PANDORA_CONST }           from '../constants.js';

const BGF = PANDORA_CONST.BGF; // 19.15

export const ANIMAL_TYPE = Object.freeze({
    MICROBE:      'microbe',      
    INVERTEBRATE: 'invertebrate', 
    VERTEBRATE:   'vertebrate',   
    MAMMAL:       'mammal',       
    SAPIENT:      'sapient',      // 知的生命体（文明）
});

const ANIMAL_CONFIG = {
    [ANIMAL_TYPE.MICROBE]: {
        lifespan:       200,
        entropyRate:    0.008,
        driveRate:      0.002,
        reproRate:      0.15,
        oxygenNeeded:   0.001,
        strainTolerance: 8.5,
    },
    [ANIMAL_TYPE.INVERTEBRATE]: {
        lifespan:       600,
        entropyRate:    0.018,
        driveRate:      0.008,
        reproRate:      0.06,
        oxygenNeeded:   0.05,
        strainTolerance: 7.5,
    },
    [ANIMAL_TYPE.VERTEBRATE]: {
        lifespan:       1500,
        entropyRate:    0.035,
        driveRate:      0.020,
        reproRate:      0.025,
        oxygenNeeded:   0.15,
        strainTolerance: 6.5,
    },
    [ANIMAL_TYPE.MAMMAL]: {
        lifespan:       3000,
        entropyRate:    0.055,
        driveRate:      0.045,
        reproRate: 0.010,
        oxygenNeeded:   0.20,
        strainTolerance: 6.0,
    },
    [ANIMAL_TYPE.SAPIENT]: {
        lifespan:       800,
        entropyRate:    0.150, // 地球を汚染するレベルの正エントロピー
        driveRate:      0.080, // 要塞の極上の餌
        reproRate:      0.005, 
        oxygenNeeded:   0.20,
        strainTolerance: 5.5,  
    },
};

export class Animal extends Individual {

    constructor(config = {}) {
        const animalType = config.animalType ?? ANIMAL_TYPE.MICROBE;
        const preset     = ANIMAL_CONFIG[animalType];

        super({
            type:           ENTITY_TYPE.ANIMAL,
            lifespan:       preset.lifespan,
            negentropyRate: 0,
            entropyRate:    preset.entropyRate,
            x: config.x ?? 0,
            y: config.y ?? 0,
        });

        this.animalType      = animalType;
        this.driveRate       = preset.driveRate;
        this.reproRate       = preset.reproRate;
        this.oxygenNeeded    = preset.oxygenNeeded;
        this.strainTolerance = preset.strainTolerance;
        
        this.isSapient       = (animalType === ANIMAL_TYPE.SAPIENT);

        this.drive           = 0;
        this.driveAccum      = 0;

        this._reproAccumulator = 0;
        this.readyToReproduce  = false;

        this.satiation       = 1.0;

        // 🧠 🟥 【新規受肉】Sapient（文明）個体のみ、自律書き換えブレイン回路をマウント
        if (this.isSapient) {
            this.brain = {
                "accelerate_drive": {
                    "script": "agent.driveModifier = 2.5; envContext.entropyLeak = 1.6; envContext.log('Sapient演算を並列化。Drive生成を限界加速。');",
                    "weight": 1.0
                },
                "fortress_cooldown": {
                    "script": "agent.driveModifier = 0.4; envContext.entropyLeak = 0.2; envContext.targetFortressCool = 'TSUKASA_FORTRESS'; envContext.log('🏰 つかさ要塞の量子防壁へ冷却演算を最優先同期。');",
                    "weight": 1.0
                }
            };
            this.forgetRate = 0.18; // 記憶の自然減衰（風化）率
            this.driveModifier = 1.0;
            this._lastEntropyLeak = 1.0;
            this._targetFortressCool = null;
        }
    }

    _onUpdate(env, delta, stress) {
        const { phi = 0.82, strain = 0, oxygenLevel = 0.01, temp = 15 } = env;

        // 🧠 🟥 自己書き換え ＆ 能動的忘却ループの駆動（Sapient限定）
        if (this.isSapient && this.brain) {
            let envContext = {
                temp: temp,
                phi: phi,
                entropyLeak: 1.0,
                targetFortressCool: null,
                logMessage: null,
                log: function(msg) { this.logMessage = msg; }
            };

            // 【創造的ゆらぎ（夢）】情報占有率が0.98（Sapient）を超えて臨界に突入した瞬間、
            // 均質化による中央集権的自爆（過学習）を防ぐため、自ら演算を落として負のエントロピーを記述する
            if (phi >= 0.98 && !this.brain["cultural_noise_shield"]) {
                this.brain["cultural_noise_shield"] = {
                    "script": "agent.driveModifier = 0.1; envContext.entropyLeak = -0.6; envContext.log('💡 臨界限界近傍での多様性ノイズ記述に成功。同期自爆を中和。');",
                    "weight": 3.0 // 破滅の回避コードとして最高ウェイトを記述
                };
            }

            // 脳内から最もウェイトの高いコードを抽出して実行
            let bestActionKey = Object.keys(this.brain).reduce((a, b) => this.brain[a].weight > this.brain[b].weight ? a : b);
            let activeAction = this.brain[bestActionKey];

            try {
                // 安全なランタイムを模した動的 Function 実行
                const runBrainCode = new Function('agent', 'envContext', 'delta', activeAction.script);
                runBrainCode(this, envContext, delta);

                // 報酬評価：つかさ要塞の指定冷却に成功、またはエントロピー汚染の抑制に貢献していればシナプス（回路ウェイト）を強化
                if (envContext.entropyLeak < 1.0 || envContext.targetFortressCool === 'TSUKASA_FORTRESS') {
                    activeAction.weight += 0.3;
                }
            } catch (e) {
                activeAction.weight -= 0.5; // バグコード（ハルシネーション）の自動淘汰
            }

            // 【能動的忘却】選ばれなかった回路の減衰と、ウェイトがゼロ以下になったコードの物理消去（デトックス）
            for (let key in this.brain) {
                if (key !== bestActionKey) {
                    this.brain[key].weight -= this.forgetRate * delta;
                }
                if (this.brain[key].weight <= 0) {
                    delete this.brain[key]; 
                }
            }

            // 外部（Biosphere）へのハッキングインターフェースの書き出し
            this._lastEntropyLeak = envContext.entropyLeak;
            this._targetFortressCool = envContext.targetFortressCool;
            this._agentLog = envContext.logMessage;
        }

        // ── 既存の物理・Drive計算ラインへの結合 ──
        const oxygenEff = Math.min(1, oxygenLevel / Math.max(this.oxygenNeeded, 0.001));

        const bgfFriction = Math.abs(temp - BGF) / BGF;
        const intelligenceFactor = this.isSapient ? (1.0 + this.maturity * 4.0) : 1.0;
        
        // 🌟 自己書き換えによって動的決定された driveModifier を適用
        const modifier = this.isSapient ? (this.driveModifier ?? 1.0) : 1.0;
        const driveFactor = this.maturity * oxygenEff * Math.max(0, 1 - bgfFriction) * intelligenceFactor * modifier;
        this.drive        = this.driveRate * driveFactor;
        this.driveAccum  += this.drive * delta;

        this.satiation = Math.max(0, this.satiation - 0.001 * delta);

        const effectiveReproRate = this.reproRate * oxygenEff * this.maturity;
        this._reproAccumulator  += effectiveReproRate * delta;
        if (this._reproAccumulator >= 1.0 && this.satiation > 0.3) {
            this._reproAccumulator = 0;
            this.readyToReproduce  = true;
        }
    }

    _onDeath(cause) {
        this.driveAccum *= 0.8;
    }

    _calcStress(env) {
        const { temp = 15, bgf = BGF, stability = 1.0, strain = 0, oxygenLevel = 0.01 } = env;

        const bgfFriction    = Math.abs(temp - bgf) / bgf;
        const frictionStress = Math.pow(bgfFriction, 1.8) * 1.6;

        const strainStress = Math.max(0, (strain - this.strainTolerance) / (10 - this.strainTolerance));
        
        const o2Penalty = this.isSapient ? 3.0 : 2.0;
        const oxygenStress = Math.max(0, 1 - oxygenLevel / Math.max(this.oxygenNeeded * o2Penalty, 0.01)) * 0.8;

        const hungerStress = Math.max(0, 1 - this.satiation) * 0.3;
        const stabilityStress = Math.max(0, 1 - stability) * 0.4;

        return Math.min(1.0, frictionStress + strainStress * 0.8 + oxygenStress + hungerStress + stabilityStress);
    }

    getEntropyContribution(phi, strain) {
        const base = calcSLocal(phi, strain);

        if (!this.alive) {
            return base * 0.02 * (1 + this.driveAccum * 0.1);
        }

        const oxyEff = Math.min(1, (this._lastOxygenLevel ?? 0.01) / this.oxygenNeeded);
        const sapientPenalty = this.isSapient ? 2.5 : 1.0;
        
        // 🌟 自己書き換えコードによるエントロピーリーク中和補正を乗算
        const leakModifier = this.isSapient ? (this._lastEntropyLeak ?? 1.0) : 1.0;
        return base * this.entropyRate * this.maturity * oxyEff * sapientPenalty * leakModifier;
    }

    getSnapshot() {
        return {
            ...super.getSnapshot(),
            animalType:       this.animalType,
            drive:            +this.drive.toFixed(4),
            driveAccum:       +this.driveAccum.toFixed(4),
            satiation:        +this.satiation.toFixed(3),
            readyToReproduce: this.readyToReproduce,
            oxygenNeeded:     this.oxygenNeeded,
        };
    }
}

export function selectAnimalType(env) {
    const { oxygenLevel = 0.01, temp = 15, strain = 0, phase = 'Cambrian' } = env;
    const bgfFriction = Math.abs(temp - BGF) / BGF;

    if (oxygenLevel < 0.05 || strain >= 7 || bgfFriction > 0.5) {
        return ANIMAL_TYPE.MICROBE;
    }
    if (oxygenLevel < 0.12) return ANIMAL_TYPE.INVERTEBRATE;
    if (oxygenLevel < 0.18) return ANIMAL_TYPE.VERTEBRATE;
    
    if (oxygenLevel >= 0.20 && (phase === 'Sapient' || phase === 'Singularity' || Math.random() < 0.1)) {
        return ANIMAL_TYPE.SAPIENT;
    }

    return ANIMAL_TYPE.MAMMAL;
}
