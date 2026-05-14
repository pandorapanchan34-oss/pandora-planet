// js/main.js
import { PandoraEngine } from './core/Engine.js';
import { SphereVisualizer } from './visuals/Sphere.js';
import { PLANET } from '../config.js';

let engine, visualizer;
let lastTime = 0;
let animationFrame;

window.addLog = function(msg) {
    const log = document.getElementById('log');
    const entry = document.createElement('div');
    entry.textContent = `> ${msg}`;
    log.prepend(entry);
    if (log.children.length > 12) log.removeChild(log.lastChild);
};

function updateUI(state) {
    document.getElementById('phi').textContent = state.phi.toFixed(3);
    document.getElementById('temp').textContent = state.temp.toFixed(1) + '°C';
    document.getElementById('strain').textContent = state.strain.toFixed(2);
    document.getElementById('drive').textContent = state.drive.toFixed(3);
    document.getElementById('phase').textContent = state.phase;
}

function loop(now) {
    if (!lastTime) lastTime = now;
    const delta = now - lastTime;
    lastTime = now;

    engine.update(delta);
    const state = engine.getState();

    visualizer.draw(state, now / 1000);
    updateUI(state);

    animationFrame = requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log(`%cPANDORA PLANET NODE: ${PLANET.name}`, 'color:#00ffaa; font-size:14px');

    engine = new PandoraEngine();
    visualizer = new SphereVisualizer('sphere');

    window.addLog(`Planet ${PLANET.name} initialized.`);
    window.addLog("bgf ≈ " + engine.universal.bgf.toFixed(2));

    // ボタン
    document.getElementById('runBtn').addEventListener('click', () => {
        engine.active = !engine.active;
        const btn = document.getElementById('runBtn');
        btn.textContent = engine.active ? "FREEZE FLOW" : "OBSERVE SINGULARITY";
        btn.style.background = engine.active ? '#ff4488' : '#00ffaa';
        window.addLog(engine.active ? "DIMENSION FLOW: ACTIVE" : "DIMENSION FLOW: FROZEN");
    });

    requestAnimationFrame(loop);
});
