// ============================================================
// PANDORA EARTH — js/core/Events.js
// イベントバス + 臨界状態監視
//
// 【設計思想】
//   全モジュールはここを通してのみ通信する。
//   EarthBody / Engine / Visuals / Biosphere は
//   互いに直接参照しない。
//
// 【更新履歴】
//   v1 : イベントバス基本実装
//   v2 : HistoryManager（臨界状態監視）統合
// ============================================================

// ============================================================
// イベントバス（内部）
// ============================================================
const _listeners = new Map();

export const Events = {

  // イベント購読
  on(event, callback) {
    if (!_listeners.has(event)) _listeners.set(event, []);
    _listeners.get(event).push(callback);
  },

  // 購読解除
  off(event, callback) {
    const cbs = _listeners.get(event);
    if (!cbs) return;
    _listeners.set(event, cbs.filter(cb => cb !== callback));
  },

  // 発火
  emit(event, payload = {}) {
    const cbs = _listeners.get(event);
    if (!cbs) return;
    cbs.forEach(cb => cb(payload));
  },

  // 全リスナー消去（惑星リセット時）
  clear() {
    _listeners.clear();
  },
};


// ============================================================
// 定義済みイベント名（タイポ防止）
// ============================================================
export const EVENT = {
  BLACK_HOLE:        'BLACK_HOLE',        // Φ=1.0 & Strain=10 → 特異点崩壊
  STRAIN_CRITICAL:   'STRAIN_CRITICAL',   // Strain > 8.0（崩壊警告）
  DISCHARGE_BLOCKED: 'DISCHARGE_BLOCKED', // 放電不能（南極閉塞）
  PLANT_BORN:        'PLANT_BORN',        // 植物誕生（受容体開花）
  EXTINCTION:        'EXTINCTION',        // 種族絶滅
  PHASE_CHANGED:     'PHASE_CHANGED',     // フェーズ転移
  RESET:             'RESET',             // 惑星リセット
};


// ============================================================
// HistoryManager — 臨界状態監視
//
// Engine.js のメインループから毎フレーム呼ぶ。
// EarthBody の状態を読み取り、閾値を超えたらイベント発火。
//
// 使い方（Engine.js）:
//   import { HistoryManager } from './Events.js';
//   // メインループ内で↓
//   HistoryManager.checkCriticalStates(engine);
// ============================================================
export const HistoryManager = {

  // ── 内部フラグ（連続発火を防ぐ）──────────────────────────
  _blackHoleTriggered:  false,
  _strainWarningActive: false,

  // ── 臨界状態チェック（毎フレーム呼ぶ）────────────────────
  checkCriticalStates(engine) {
    const body = engine.body.getSnapshot();

    // 1. ブラックホール化の判定
    //    Φ=1.0 かつ Strain=10 → 特異点崩壊
    //    ※ EarthBody._triggerBlackHole() でも発火するが、
    //      Engine側からの二重チェックとして保持
    if (body.strain >= 10.0 && body.phi >= 1.0 && !this._blackHoleTriggered) {
      this._blackHoleTriggered = true;
      Events.emit(EVENT.BLACK_HOLE, {
        intensity: body.strain,
        message:   '全帯域の凍結を確認。',
        timestamp: Date.now(),
      });
    }

    // 2. 警告：Strain が臨界（8.0）に接近
    //    ※ 放電不能でない段階での警告（まだ間に合う）
    if (body.strain > 8.0 && !body.isDischargeBlocked && !this._strainWarningActive) {
      this._strainWarningActive = true;
      Events.emit(EVENT.STRAIN_CRITICAL, {
        strain:  body.strain,
        message: 'Strain 臨界接近。放電効率を確認せよ。',
      });
    }

    // 3. Strain が安全域に戻ったらフラグリセット
    if (body.strain <= 8.0) {
      this._strainWarningActive = false;
    }

    // 4. 放電不能の監視
    if (body.isDischargeBlocked) {
      Events.emit(EVENT.DISCHARGE_BLOCKED, {
        strain:        body.strain,
        dischargeRate: body.dischargeRate,
      });
    }
  },

  // ── リセット（惑星リセット時に呼ぶ）──────────────────────
  reset() {
    this._blackHoleTriggered  = false;
    this._strainWarningActive = false;
  },
};
