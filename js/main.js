import { PandoraEngine } from './core/Engine.js';
import { PLANET_EARTH }  from '../config/planets/earth.js';
import { Events, EVENT } from './core/Events.js'; // 🌟 明示的なインポート

let engine, visualizer;
let lastTime = 0;
let timeScale = 1.0; 

window.addLog = function(msg, level = 'info') {
    const logEl = document.getElementById('log');
    if (!logEl) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.textContent = `> ${msg}`;
    logEl.prepend(entry);
    if (logEl.children.length > 15) logEl.removeChild(logEl.lastChild);
};

function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function updateUI(status) {
    // status.year の代わりに、進み続ける世代カウントを注入
    setEl('year', "STEP " + (status.generation || 0));
    setEl('phase', status.phase);
    setEl('phi', status.body.phi.toFixed(4));
    setEl('strain', status.body.strain.toFixed(2));
    setEl('temp',      status.climate.surfaceTemp.toFixed(1) + '°C');
    setEl('stability', (status.climate.stability * 100).toFixed(0) + '%');
    setEl('pop',       (status.species.population * 100).toFixed(1) + '%');
    setEl('drive',     status.species.drive.toFixed(4));
}
    updateFortressUI(status.fortresses);

    const alertBox = document.getElementById('alert-box');
    if (alertBox) {
        if (status.body.isDischargeBlocked) {
            alertBox.classList.add('active');
            alertBox.textContent = "CRITICAL: DISCHARGE BLOCKED";
        } else {
            alertBox.classList.remove('active');
        }
    }
}

function updateFortressUI(fortresses) {
    const container = document.getElementById('fortress-list');
    if (!container || !fortresses) return;
    container.innerHTML = '';
    fortresses.forEach(fort => {
        const fortEl = document.createElement('div');
        fortEl.className = `fortress-node-ui ${fort.status.toLowerCase()}`;
        fortEl.innerHTML = `🏰 ${fort.name}: ${fort.defenseRate.toFixed(1)}%`;
        container.appendChild(fortEl);
    });
}

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

    requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 🌟 惑星の初期化
    engine = new PandoraEngine(PLANET_EARTH);
    const { SphereVisualizer } = await import('./visuals/Sphere.js');
    visualizer = new SphereVisualizer('sphere');

    // 🌟 競合防止リスナー
    // main.js の DOMContentLoaded 内に追加/修正
Events.on(EVENT.PHASE_CHANGED, (payload) => {
    const topPanel = document.querySelector('.top-panel');
    const logo = document.querySelector('.logo');
    
    if (payload.to === 'Singularity') {
        // パネル全体を覚醒モードへ
        topPanel.classList.add('singularity');
        
        // 特異点同期メッセージをログへ注入
        window.addLog("SYSTEM_SYNC: 特異点同期モードへ移行しました。超越防壁をロック。", 'critical');
        
        // フェーズバッジも特異点仕様へ
        const phaseBadge = document.getElementById('phase');
        if (phaseBadge) {
            phaseBadge.textContent = 'SINGULARITY';
            phaseBadge.style.color = '#aaff44';
            phaseBadge.style.borderColor = '#aaff44';
        }
    }
});

    const runBtn = document.getElementById('runBtn');
    if (runBtn) {
        runBtn.addEventListener('click', () => {
            engine.active = !engine.active;
            runBtn.textContent = engine.active ? "FREEZE FLOW" : "OBSERVE SINGULARITY";
            runBtn.classList.toggle('active', engine.active);
        });
    }

    // ⚡ スピード調整の安全な適用
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            timeScale = parseFloat(btn.getAttribute('data-speed'));
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.addLog(`TIME SCALE: ${timeScale}x`, 'warn');
        });
    });

    requestAnimationFrame(loop);
});
