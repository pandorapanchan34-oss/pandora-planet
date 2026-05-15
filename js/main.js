import { PandoraEngine } from './core/Engine.js';
const PLANET_EARTH = { name: 'PANDORA', radius: 6371 };

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
 * UIの同期：nullガード付きで安全に更新
 */
function setEl(id, value) {
    // ✅ FIX③: 存在しないIDへのアクセスでTypeErrorが出てループが死ぬのを防ぐ
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
 * メインループ
 * ✅ FIX①: Engineの_loop()は使わず、ここで一元管理する
 * ✅ FIX④: deltaをミリ秒→秒に変換してEngineと単位を合わせる
 */
function loop(now) {
    if (!lastTime) lastTime = now;
    // ミリ秒→秒、スパイク対策で0.1秒上限
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // engineがactiveな時だけupdate（Engine内部のループは使わない）
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

    // ✅ FIX②: canvas IDを 'sphere' に統一（index.htmlの<canvas id="sphere">と一致）
    const { SphereVisualizer } = await import('./visuals/Sphere.js');
    visualizer = new SphereVisualizer('sphere');

    window.addLog(`PLANET NODE [${PLANET_EARTH.name}] CONNECTED.`);

    const runBtn = document.getElementById('runBtn');
    if (runBtn) {
        runBtn.addEventListener('click', () => {
            if (!engine.active) {
                // ✅ FIX①: engine.start()はEngine内部の_loop()を起動するが、
                // ここではactive フラグだけ立てる形にしたい。
                // Engine.start()が_loop()を呼ぶ実装のままなら、
                // Engine側の_loop()内のupdateを無効化する必要がある。
                // → Engine_v2.jsの修正コメント参照（activeフラグのみセット）
                engine.active = true;
                runBtn.textContent = "FREEZE FLOW";
                runBtn.classList.add('active');
            } else {
                engine.active = false;
                runBtn.textContent = "OBSERVE SINGULARITY";
                runBtn.classList.remove('active');
            }
        });
    }

    requestAnimationFrame(loop);
});
