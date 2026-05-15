// js/core/Events.js

// ============================================================
// PANDORA EVENTS — イベントバス
// 全モジュールはここを通してのみ通信する
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

  // 全リスナー消去（リセット時）
  clear() {
    _listeners.clear();
  },
};

// ============================================================
// 定義済みイベント名（タイポ防止）
// ============================================================
export const EVENT = {
  BLACK_HOLE:        'BLACK_HOLE',        // Φ=1.0 & Strain=10 → 特異点
  STRAIN_CRITICAL:   'STRAIN_CRITICAL',   // Strain > 8.0（警告）
  DISCHARGE_BLOCKED: 'DISCHARGE_BLOCKED', // 放電不能
  PLANT_BORN:        'PLANT_BORN',        // 植物誕生
  EXTINCTION:        'EXTINCTION',        // 種族絶滅
  PHASE_CHANGED:     'PHASE_CHANGED',     // フェーズ転移
  RESET:             'RESET',             // 惑星リセット
};
