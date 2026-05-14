import { PandoraEngine } from './core/Engine.js';
import { PLANET_EARTH }  from '../config/planets/earth.js';

let engine, visualizer;
let lastTime = 0;

/**
 * ログの更新
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
 * UI更新
 */
function updateUI(status) {
    document.getElementById('year').textContent = status.year;
    document.getElementById('phase').textContent = status.phase;
    document.getElementById('phi').textContent = status.body.phi.toFixed(4);
    document.getElementById('strain').textContent = status.body.strain.toFixed(2);
    document.getElementById('temp').textContent = status.climate.surfaceTemp.toFixed(1) + '°C';
    document.getElementById('stability').textContent = (status.climate.stability * 100).toFixed(0) + '%';
    document.getElementById('pop').textContent = (status.species.population * 100).toFixed(1) + '%';
    document.getElementById('drive').textContent = status.species.drive.toFixed(4);

    const alertBox = document.getElementById('alert-box');
    if (status.body.isDischargeBlocked) {
        alertBox.classList.add('active');
        alertBox.textContent = "CRITICAL: DISCHARGE BLOCKED";
    } else {
        alertBox.classList.remove('active');
    }
}

/**
 * メインループ
 */
function loop(now) {
    if (!lastTime) lastTime = now;
    const delta = (now - lastTime);
    lastTime = now;

    engine.update(delta);
    
    const status = engine.getFullStatus();

    if (visualizer) visualizer.draw(status, now);
    updateUI(status);

    // ログ出力
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
    engine = new PandoraEngine(PLANET_EARTH);

    // ビジュアライザー
    const { SphereVisualizer } = await import('./visuals/Sphere.js');
    visualizer = new SphereVisualizer('sphere-canvas');

    // 強制リサイズ
    setTimeout(() => {
        if (visualizer && visualizer.resize) {
            visualizer.resize();
            console.log("✅ Canvas resized:", visualizer.canvas.width, "×", visualizer.canvas.height);
        }
    }, 100);

    // ボタン
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

    window.addLog("🌍 PANDORA EARTH NODE INITIALIZED", "info");
    requestAnimationFrame(loop);
});
