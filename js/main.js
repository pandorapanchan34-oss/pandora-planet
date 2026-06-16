import { PandoraEngine } from './core/Engine.js';
import { PLANET_EARTH }  from '../config/planets/earth.js';

let engine, visualizer;
let lastTime = 0;
let timeScale = 1.0; 

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
 * UIの同期
 */
function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function updateUI(status) {
    setEl('year',      status.year);
    setEl('phase',     status.phase);
    setEl('phi',       status.body.phi.toFixed(4));
    setEl('strain',    status.body.strain.toFixed(2));
    setEl('temp',      status.climate.surfaceTemp.toFixed(1) + '°C');
    setEl('stability', (status.climate.stability * 100).toFixed(0) + '%');
    setEl('pop',       (status.species.population * 100).toFixed(1) + '%');
    setEl('drive',     status.species.drive.toFixed(4));
    setEl('currentSpeed', timeScale.toFixed(1) + 'x');

    // 🟥 コロシアム要塞群の動的UIインジェクション
    updateFortressUI(status.fortresses);

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

/**
 * 🟥 惑星表層の要塞ノード群の状態をリアルタイムラスタライズ
 */
function updateFortressUI(fortresses) {
    const container = document.getElementById('fortress-list');
    if (!container || !fortresses) return;

    container.innerHTML = '';
    
    fortresses.forEach(fort => {
        const fortEl = document.createElement('div');
        fortEl.className = `fortress-node-ui ${fort.status.toLowerCase()}`;
        
        const alertClass = fort.defenseRate < 50.0 ? 'critical-pulse' : '';
        
        fortEl.innerHTML = `
            <div class="fort-header">
                <span class="fort-name">🏰 ${fort.name}</span>
                <span class="fort-tier">T${fort.tier}</span>
            </div>
            <div class="fort-meta">
                <span class="fort-rate ${alertClass}">防御率: ${fort.defenseRate.toFixed(1)}%</span>
                <span class="fort-status-tag">[${fort.status}]</span>
            </div>
        `;
        container.appendChild(fortEl);
    });
}

/**
 * メメインループ
 */
function loop(now) {
    if (!lastTime) lastTime = now;
    const delta = Math.min((now - lastTime) / 1000, 0.1) * timeScale;
    lastTime = now;

    if (engine && engine.active) {
        engine.update(delta);
    }

    const status = engine.getFullStatus();
    if (visualizer) visualizer.draw(status, now);
    updateUI(status);

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

    const { SphereVisualizer } = await import('./visuals/Sphere.js');
    visualizer = new SphereVisualizer('sphere');

    window.addLog('PLANET NODE CONNECTED.');

    // 実行・停止ボタン
    const runBtn = document.getElementById('runBtn');
    if (runBtn) {
        runBtn.addEventListener('click', () => {
            engine.active = !engine.active;
            runBtn.textContent = engine.active ? "FREEZE FLOW" : "OBSERVE SINGULARITY";
            runBtn.classList.toggle('active', engine.active);
        });
    }

    // スピード調整ボタン（手動微調整用）
    const speedUp = document.getElementById('speedUp');
    const speedDown = document.getElementById('speedDown');
    
    if (speedUp) {
        speedUp.addEventListener('click', () => {
            timeScale = Math.min(timeScale + 0.5, 10.0);
            window.addLog(`TIME SCALE: ${timeScale.toFixed(1)}x`, 'info');
        });
    }
    if (speedDown) {
        speedDown.addEventListener('click', () => {
            timeScale = Math.max(timeScale - 0.5, 0.5);
            window.addLog(`TIME SCALE: ${timeScale.toFixed(1)}x`, 'info');
        });
    }

    // ==================================================================
    // ⚡ スピード倍率ボタンの制御（data-speed属性ハック版）
    // ==================================================================
    const domSpeedButtons = document.querySelectorAll('.speed-btn');

    domSpeedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const speedValue = parseFloat(btn.getAttribute('data-speed'));
            
            if (!isNaN(speedValue)) {
                timeScale = speedValue;
                
                domSpeedButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                window.addLog(`TIME ACCELERATED: ${timeScale}x`, 'warn');
            }
        });
    });

    requestAnimationFrame(loop);
});
