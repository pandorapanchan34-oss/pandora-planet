import { PandoraEngine } from './core/Engine.js';
import { PLANET_EARTH }  from '../config/planets/earth.js';

let engine, visualizer;
let lastTime = 0;

/**
 * ログの更新：惑星史のイベントを刻む
 */
window.addLog = function(msg, level = 'info') {
    const logEl = document.getElementById('log');
    if (!logEl) return;
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.textContent = `> ${msg}`;
    logEl.prepend(entry);
    
    if (logEl.children.length > 15) {
        logEl.removeChild(logEl.lastChild);
    }
};

/**
 * UIの同期：全レイヤーの状態を可視化
 */
function updateUI(status) {
    // 進行状況
    document.getElementById('year').textContent = status.year;
    document.getElementById('phase').textContent = status.phase;

    // 地質層（Body）
    document.getElementById('phi').textContent = status.body.phi.toFixed(4);
    document.getElementById('strain').textContent = status.body.strain.toFixed(2);
    
    // 環境層（Climate）
    document.getElementById('temp').textContent = status.climate.surfaceTemp.toFixed(1) + '°C';
    document.getElementById('stability').textContent = (status.climate.stability * 100).toFixed(0) + '%';
    
    // 生命層（Species）
    document.getElementById('pop').textContent = (status.species.population * 100).toFixed(1) + '%';
    document.getElementById('drive').textContent = status.species.drive.toFixed(4);

    // アラート表示
    const alertBox = document.getElementById('alert-box');
    if (status.body.isDischargeBlocked) {
        alertBox.classList.add('active');
        alertBox.textContent = "CRITICAL: DISCHARGE BLOCKED";
    } else {
        alertBox.classList.remove('active');
    }
}

/**
 * メインループ：時間の流動
 */
function loop(now) {
    if (!lastTime) lastTime = now;
    const delta = (now - lastTime);
    lastTime = now;

    // エンジンの更新
    engine.update(delta);
    
    // 状態の取得
    const status = engine.getFullStatus();

    // 描画とUI更新
    if (visualizer) visualizer.draw(status, now);
    updateUI(status);

    // エンジンから新しいログがあれば出力
    if (status.log && status.log.length > 0) {
        const latest = status.log[0];
        if (!window._lastLogTime || latest.time > window._lastLogTime) {
            window.addLog(`[${latest.year}] ${latest.message}`, latest.level);
            window._lastLogTime = latest.time;
        }
    }

    requestAnimationFrame(loop);
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    // 1. エンジンとビジュアライザーの生成
    // ※ 惑星の設定を注入
    engine = new PandoraEngine(PLANET_EARTH);
    .`);
    // ビジュアライザー生成
const { SphereVisualizer } = await import('./visuals/Sphere.js');
visualizer = new SphereVisualizer('sphere-canvas');

// ★★★ ここを追加 ★★★
setTimeout(() => {
    visualizer.resize();           // 強制リサイズ
    console.log("Canvas size:", visualizer.canvas.width, "×", visualizer.canvas.height);
}, 50);

    // 2. 観測開始ボタン
    const runBtn = document.getElementById('runBtn');
    if (runBtn) {
        runBtn.addEventListener('click', () => {
            if (!engine.active) {
                engine.start();
                runBtn.textContent = "FREEZE FLOW";
                runBtn.classList.add('active');
            } else {
                engine.stop();
                runBtn.textContent = "OBSERVE SINGULARITY";
                runBtn.classList.remove('active');
            }
        });
    }

    requestAnimationFrame(loop);
});
