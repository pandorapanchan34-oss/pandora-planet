import { PandoraEngine } from './core/Engine.js';
import { SphereVisualizer } from './visuals/Sphere.js';
import { PLANET } from '../config.js';

let engine, visualizer;
let lastTime = 0;

/**
 * ログを表示エリアに追加する
 * @param {string} msg 
 */
window.addLog = function(msg) {
    const log = document.getElementById('log');
    if (!log) return;
    
    const entry = document.createElement('div');
    entry.textContent = `> ${msg}`;
    log.prepend(entry);
    
    // ログが溜まりすぎないように調整
    if (log.children.length > 12) {
        log.removeChild(log.lastChild);
    }
};

/**
 * UIの数値を更新する
 * @param {object} state 
 */
function updateUI(state) {
    // Engineの状態をDOMに反映
    document.getElementById('phi').textContent = state.phi.toFixed(4);
    document.getElementById('temp').textContent = state.temp.toFixed(1) + '°C';
    document.getElementById('strain').textContent = state.strain.toFixed(2);
    
    // config.jsから導入した drive などの追加項目がある場合
    if (document.getElementById('drive')) {
        document.getElementById('drive').textContent = state.drive.toFixed(3);
    }
    
    document.getElementById('phase').textContent = state.phase;
}

/**
 * メインループ
 * @param {number} now 
 */
function loop(now) {
    if (!lastTime) lastTime = now;
    const delta = now - lastTime;
    lastTime = now;

    // エンジンの計算更新（deltaを渡して時間精度を確保）
    engine.update(delta);
    
    // 最新の状態を取得
    const state = engine.getState();

    // ビジュアライザーの描画更新
    visualizer.draw(state, now / 1000);
    
    // UI表示の更新
    updateUI(state);

    requestAnimationFrame(loop);
}

// 初期化処理
document.addEventListener('DOMContentLoaded', () => {
    // コンソールに起動メッセージを表示
    console.log(`%cPANDORA PLANET NODE: ${PLANET.name}`, 'color:#00ffaa; font-size:14px; font-weight:bold;');

    // 各インスタンスの生成
    engine = new PandoraEngine();
    visualizer = new SphereVisualizer('sphere');

    window.addLog(`Planet ${PLANET.name} initialized.`);
    
    // エンジン内の定数（bgf等）を表示
    if (engine.universal && engine.universal.bgf) {
        window.addLog("bgf ≈ " + engine.universal.bgf.toFixed(2));
    }

    // 観測開始ボタンの制御
    const runBtn = document.getElementById('runBtn');
    if (runBtn) {
        runBtn.addEventListener('click', () => {
            engine.active = !engine.active;
            
            // ボタンの見た目を切り替え
            runBtn.textContent = engine.active ? "FREEZE FLOW" : "OBSERVE SINGULARITY";
            runBtn.style.background = engine.active ? '#ff4488' : '#00ffaa';
            
            window.addLog(engine.active ? "DIMENSION FLOW: ACTIVE" : "DIMENSION FLOW: FROZEN");
        });
    }

    // ループ開始
    requestAnimationFrame(loop);
});
