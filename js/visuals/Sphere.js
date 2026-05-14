// ============================================================
// PANDORA EARTH — js/visuals/Sphere.js
// 惑星ビジュアライザー
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

    this.particles = Array.from({ length: 200 }, () => ({
      x: 0, y: 0,
      size:   Math.random() * 3 + 1,
      speed:  Math.random() * 0.02 + 0.005,
      angle:  Math.random() * Math.PI * 2,
      offset: Math.random() * 100,
    }));

    this._prevPhase  = null;
    this._flashAlpha = 0;
    this._flashColor = '255,255,255';
    this._rafId      = null;
  }

  resize() {
    // parentElement経由だとfixed/absolute構成で0を返すことがある
    // window.innerWidth/Height を直接使うのが確実
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  draw(snap, time) {
    const { body, climate, species, phase } = snap;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#020810'; ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    const r  = Math.min(W, H) * 0.32;

    // 1. 大気圏オーラ
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
    const gColor = phase === 'Sapient' ? '255,120,180' : phase === 'Complex' ? '255,200,80' : '0,200,255';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) {
      const rot = time * 0.0004 + i * (Math.PI / 5);
      ctx.strokeStyle = `rgba(${gColor},${gAlpha})`;
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.12, r * 0.62, rot, 0, Math.PI * 2); ctx.stroke();
    }

    // 4. コア
    const pulse   = 1.0 + Math.sin(time * 0.01) * (body.strain / 20);
    const coreHue = phase === 'Sapient' ? 320 : phase === 'Complex' ? 40 : phase === 'Multicellular' ? 140 : 200;
    const grad    = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0,            `hsla(${coreHue},100%,85%,1)`);
    grad.addColorStop(0.15 * pulse, `hsla(${coreHue},80%,45%,0.9)`);
    grad.addColorStop(1,            'rgba(5,10,20,1)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    if (body.strain > 8.5) {
      const sa = Math.min(0.6, (body.strain - 8.5) / 10);
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,30,50,${sa * (0.5 + Math.sin(time * 0.02) * 0.5)})`;
      ctx.lineWidth = 4; ctx.stroke();
    }

    // 5. 南極排出
    const outCount = Math.min(Math.floor(body.entropyOutflow * 800), 150);
    const dCol     = body.isDischargeBlocked ? '255,0,0' : '255,100,50';
    const blink    = body.isDischargeBlocked ? (Math.sin(time * 0.05) > 0 ? 1 : 0.2) : 1;
    for (let i = 0; i < outCount; i++) {
      const t = (time * 0.003 + i * 0.05) % 1.0;
      const x = cx + Math.cos(i * 1.1) * r * t * 0.8;
      const y = cy + r * 0.5 + t * r * 1.5;
      ctx.fillStyle = `rgba(${dCol},${(1 - t) * blink})`; ctx.fillRect(x, y, 3, 3);
    }

    // 6. 生命圏リング
    if (species.population > 0.05) {
      const bioR = r * (1.05 + species.biodiversity * 0.08);
      const bCol = species.techLevel > 0.5 ? `rgba(255,200,50,${species.population * 0.4})` : `rgba(50,255,120,${species.population * 0.35})`;
      ctx.beginPath(); ctx.arc(cx, cy, bioR, 0, Math.PI * 2);
      ctx.strokeStyle = bCol; ctx.lineWidth = 2 + species.biodiversity * 3;
      ctx.shadowColor = bCol; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
      if (species.techLevel > 0.1) {
        const tRot = time * 0.001 * species.techLevel;
        ctx.beginPath(); ctx.arc(cx, cy, r * (1.15 + species.techLevel * 0.1), tRot, tRot + Math.PI * 2 * species.techLevel);
        ctx.strokeStyle = `rgba(255,180,0,${species.techLevel * 0.6})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }

    // 7. 気象エフェクト
    const efMap = {
      EXTREME_STORM: ['255,255,255', 0.12, 0.08],
      HEAVY_RAIN:    ['100,180,255', 0.07, 0.04],
      BLIZZARD:      ['200,230,255', 0.10, 0.03],
      HEATWAVE:      ['255,100,0',   0.08, 0.05],
    };
    if (climate.weatherEvent && efMap[climate.weatherEvent]) {
      const [ec, ea, ep] = efMap[climate.weatherEvent];
      ctx.fillStyle = `rgba(${ec},${ea * (0.5 + Math.sin(time * ep) * 0.5)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 8. bgf メーター
    const ratio = body.strain / PANDORA_DERIVED.BGF;
    const mCol  = ratio >= 1.2 ? '#ff2244' : ratio >= 1.0 ? '#ff8800' : '#00e5a0';
    const mx = W - 112, my = H - 28;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(mx - 4, my - 18, 108, 30);
    ctx.fillStyle = 'rgba(0,40,20,0.5)'; ctx.fillRect(mx, my, 100, 6);
    ctx.fillStyle = mCol; ctx.shadowColor = mCol; ctx.shadowBlur = ratio >= 1 ? 8 : 0;
    ctx.fillRect(mx, my, Math.min(1, ratio / 1.5) * 100, 6); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(180,220,200,0.55)'; ctx.font = '9px "Courier New"'; ctx.textAlign = 'left';
    ctx.fillText(`Φ ${body.phi.toFixed(3)}`, mx, my - 5);
    ctx.fillStyle = mCol; ctx.textAlign = 'right';
    ctx.fillText(`Strain ${body.strain.toFixed(2)}`, mx + 100, my - 5);

    // 9. フェーズフラッシュ
    if (phase !== this._prevPhase) {
      this._flashAlpha = 0.35;
      this._flashColor = phase === 'Sapient' ? '255,100,200' : phase === 'Complex' ? '255,200,50' : '50,255,150';
      this._prevPhase  = phase;
    }
    if (this._flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(${this._flashColor},${this._flashAlpha})`; ctx.fillRect(0, 0, W, H);
      this._flashAlpha *= 0.88;
    }
  }

  startLoop(getSnapshot) {
    const loop = ts => { const s = getSnapshot(); if (s) this.draw(s, ts); this._rafId = requestAnimationFrame(loop); };
    this._rafId = requestAnimationFrame(loop);
  }

  stopLoop() { if (this._rafId) cancelAnimationFrame(this._rafId); }
}
