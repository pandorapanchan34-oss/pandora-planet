// ============================================================
// PANDORA EARTH — js/visuals/Sphere.js
// 惑星ビジュアライザー（大統合・起源生命圏完全視覚化版）
// ============================================================

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

export class SphereVisualizer {

  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`[SphereVisualizer] canvas#${canvasId} が見つかりません。IDを確認してください。`);
    }
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // 🧬 【粒子エンジンの再起動】生命の胞子（パーティクル）として宇宙空間へ湧き上がる規律
    this.particles = Array.from({ length: 200 }, () => ({
      x: 0, y: 0,
      size:   Math.random() * 2 + 0.5,
      speed:  Math.random() * 0.4 + 0.1, 
      angle:  Math.random() * Math.PI * 2,
      distance: 0, 
      opacity: Math.random(),
    }));

    this._prevPhase  = null;
    this._flashAlpha = 0;
    this._flashColor = '255,255,255';
    this._rafId      = null;
  }

  resize() {
    this.canvas.width  = this.canvas.clientWidth  || window.innerWidth;
    this.canvas.height = this.canvas.clientHeight || window.innerHeight;
  }

  draw(snap, time) {
    // 🌟 拡張されたすべての環境・起源システム（atmosphere, origins等）をスキャン
    const { body, climate, species, phase, biosphere, atmosphere, origins } = snap;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#020810'; ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    const r  = Math.min(W, H) * 0.32;

    // 1. 大気圏オーラ（温度で色調が相転移する規律）
    const hue = 210 - (climate.surfaceTemp * 1.5);
    ctx.shadowBlur = 100; ctx.shadowColor = `hsla(${hue},80%,50%,0.4)`;
    ctx.fillStyle  = `hsla(${hue},60%,20%,${0.15 + climate.stability * 0.2})`;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // 2. 北極吸収
    const inCount = Math.min(Math.floor(body.entropyInflow * 500), 100);
    for (let i = 0; i < inCount; i++) {
      const t = (time * 0.002 + i * 0.1) % 1.0;
      const x = cx + Math.sin(i * 1.3) * r * (1 - t) * 0.6;
      const y = cy - r * 1.2 * (1 - t) - r * 0.4;
      ctx.fillStyle = `rgba(0,220,255,${(1 - t) * 0.7})`; ctx.fillRect(x, y, 2, 2);
    }

    // 3. 磁場グリッド
    const phiR  = body.phi / PANDORA_CONST.PHI_IDEAL;
    const gAlpha = Math.min(0.6, 0.05 + phiR * 0.3);
    // 🌟 フェーズ『Singularity』時は超高密度黄緑ネオン（170, 255, 68）へ相転移
    const gColor = phase === 'Singularity' ? '170,255,68' : phase === 'Sapient' ? '255,120,180' : phase === 'Complex' ? '255,200,80' : '0,200,255';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) {
      const rot = time * 0.0004 + i * (Math.PI / 5);
      ctx.strokeStyle = `rgba(${gColor},${gAlpha})`;
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.12, r * 0.62, rot, 0, Math.PI * 2); ctx.stroke();
    }

    // 4. 惑星コア（地表・大陸レイヤー）
    const pulse   = 1.0 + Math.sin(time * 0.01) * (body.strain / 20);
    
    // 🌟 生命誕生（plantTriggered）の有無でベースのコア色を動的制御
    let coreHue = 200; // 初期デッドブルー
    if (biosphere && biosphere.plantTriggered) {
      coreHue = phase === 'Singularity' ? 90 : phase === 'Sapient' ? 320 : phase === 'Complex' ? 40 : 140; // 140 = カンブリア生命エメラルド
    }

    const grad    = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0,            `hsla(${coreHue},100%,85%,1)`);
    grad.addColorStop(0.15 * pulse, `hsla(${coreHue},80%,45%,0.9)`);
    
    // 🌟 植物（POP）が広がるにつれ、地球の裏側に「深緑の大陸相関図」が侵食して浮かび上がる
    if (species.population > 0) {
      grad.addColorStop(0.85,       `hsla(145, 90%, 12%, ${Math.min(0.8, species.population)})`);
    }
    grad.addColorStop(1,            'rgba(5,10,20,1)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // 🌿 【新マウント：生命のゲノム侵食ニューラル・グリッド】
    if (biosphere && biosphere.plantTriggered) {
      ctx.strokeStyle = `rgba(68, 255, 238, ${0.1 + species.population * 0.4})`;
      ctx.lineWidth = 0.5;
      for (let j = 1; j <= 6; j++) {
        ctx.beginPath();
        // 生物多様性（biodiversity）に応じて、マトリクスの網の目が自律デフラグして回転する
        ctx.arc(cx, cy, r * (j / 6), time * 0.0002, time * 0.0002 + Math.PI * 2);
        ctx.stroke();
      }
    }

    // 🌋 【新マウント：熱水噴出孔（マルチ・ジェネシス）の海底スパーク】
    if (origins && origins.activeVents > 0) {
      ctx.fillStyle = 'rgba(255, 230, 0, 0.8)';
      for (let v = 0; v < origins.activeVents; v++) {
        const vAngle = (v * 2.3 + time * 0.001) % (Math.PI * 2);
        const vx = cx + Math.sin(vAngle) * r * 0.7;
        const vy = cy + Math.cos(vAngle) * r * 0.5; // 南半球寄りに
