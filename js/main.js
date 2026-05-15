import { PandoraEngine } from './core/Engine.js';
import { PLANET_EARTH }  from '../config/planets/earth.js';

let engine, visualizer;
let lastTime = 0;

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

function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function updateUI(status) {
    setEl('year',   status.year);
    setEl('phase',  status.phase);
    setEl('phi',    status.body.phi.toFixed(4));
    setEl('strain', status.body.strain.toFixed(2));
    setEl('temp',   (status.climate.surfaceTemp ?? 15).toFixed(1) + '°C');
    setEl('stability', ((status.body.stability ?? status.climate.stability) * 100).toFixed(0) + '%');

    // ✅ Biosphere対応（旧species互換も残す）
    const bio = status.biosphere || status.species;
    setEl('pop',   (bio.population * 100).toFixed(1) + '%');
    setEl('drive', (bio.drive ?? 0).toFixed(4));

    const alertBox = document.getElementById('alert-box');
    if (alertBox) {
        if (status.body.isDischargeBlocked) {
            alertBox.classList.add('active');
            alertBox.textContent = "CRITICAL: DISCHARGE BLOCKED";
        } else {
            alertBox.classList.remove('active');
            alertBox.textContent = '';
        }
    }
}

function loop(now) {
    if (!lastTime) lastTime = now;
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (engine && engine.active) {
        engine.update(delta);
    }

    const status = engine ? engine.getFullStatus() : {};

    if (visualizer) visualizer.draw(status, now);
    updateUI(status);

    // 最新ログ表示
    if (status.log && status.log.length > 0) {
        const latest = status.log[0];
        if (!window._lastLogTime || latest.time > window._lastLogTime) {
            window.addLog(`[${latest.year}] ${latest.message}`, latest.level || 'info');
            window._lastLogTime = latest.time;
        }
    }

    requestAnimationFrame(loop);
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    engine = new PandoraEngine(PLANET_EARTH);

    // Visualizer読み込み
    try {
        const { SphereVisualizer } = await import('./visuals/Sphere.js');
        visualizer = new SphereVisualizer('sphere');
    } catch (e) {
        console.warn('Visualizer could not be loaded:', e);
    }

    window.addLog(`PLANET NODE [${PLANET_EARTH.name || 'EARTH'}] CONNECTED.`, 'phase');

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
