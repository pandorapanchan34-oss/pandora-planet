// ============================================================
// PANDORA EARTH — js/visuals/Sphere.js
// 惑星ビジュアライザー
//
// EarthBody / Climate / Species の状態を
// リアルタイムで可視化する。
// ============================================================

import { PANDORA_CONST, PANDORA_DERIVED } from '../constants.js';

export class SphereVisualizer {

  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // ── パーティクル（エントロピー流）────────────────────
    this.particles = Array.from({ length: 200 }, () => ({
      x:      0,
      y:      0,
      size:   Math.random() * 3 + 1,
      speed:  Math.random() * 0.02 + 0.005,
      angle:  Math.random() * Math.PI * 2,
      offset: Math.random() * 100,
      type:   Math.random() < 0.5 ? 'inflow' : 'outflow',
    }));

    // ── フェーズ履歴（トランジション用）─────────────────
    this._prevPhase   = null;
    this._flashAlpha  = 0;
    this._flashColor  = '255,255,255';
  }

  // ── リサイズ ──────────────────────────────────────────
  resize() {
    this.canvas.width  = this.canvas.parentElement?.clientWidth  || window.innerWidth;
    this.canvas.height = this.canvas.parentElement?.clientHeight || window.innerHeight;
  }

  // ── メイン描画 ────────────────────────────────────────
  /**
   * @param {object} engineSnapshot  PandoraEngine.getFullStatus()
   * @param {number} time            経過時間（ms）
   */
  draw(engineSnapshot, time) {
    const { body, climate, species, phase } = engineSnapshot;
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    // 背景
    ctx.fillStyle = '#020810';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    const r  = Math.min(W, H) * 0.32;

    // ── 1. 背後光（大気圏オーラ）────────────────────────
    // 温度と安定度によって色相が変化
    const hue = 210 - (climate.surfaceTemp * 1.5);  // 高温→赤、低温→青
    const auraAlpha = 0.15 + climate.stability * 0.2;
    ctx.shadowBlur  = 100;
    ctx.shadowColor = `hsla(${hue}, 80%, 50%, 0.4)`;
    ctx.fillStyle   = `hsla(${hue}, 60%, 20%, ${auraAlpha})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── 2. 北極吸収（Inflow / 重力エントロピー）─────────
    // 青白い粒子が北から中心へ吸い込まれる
    this._drawInflow(ctx, cx, cy, r, body, time);

    // ── 3. 回転グリッド（磁場 / 同期層）────────────────
    // Φが理想値(5/6)に近いほど鮮明、Sapientで色が変わる
    this._drawMagneticGrid(ctx, cx, cy, r, body, phase, time);

    // ── 4. コア・地表（Strain脈動）──────────────────────
    this._drawCore(ctx, cx, cy, r, body, climate, species, phase, time);

    // ── 5. 南極排出（Outflow / Discharge）───────────────
    // 赤い粒子が南へ。DischargeBlocked で激しく明滅
    this._drawOutflow(ctx, cx, cy, r, body, time);

    // ── 6. 生命圏リング──────────────────────────────────
    if (species.population > 0.05) {
      this._drawBiosphere(ctx, cx, cy, r, species, phase, time);
    }

    // ── 7. 気象エフェクト────────────────────────────────
    this._drawWeatherEffect(ctx, W, H, climate, time);

    // ── 8. bgf 密度メーター──────────────────────────────
    this._drawBGFMeter(ctx, W, H, body);

    // ── 9. フェーズトランジションフラッシュ──────────────
    this._drawFlash(ctx, W, H, phase);
  }

  // ── 北極吸収 ─────────────────────────────────────────
  _drawInflow(ctx, cx, cy, r, body, time) {
    const count = Math.min(Math.floor(body.entropyInflow * 500), 100);
    for (let i = 0; i < count; i++) {
      const t = (time * 0.002 + i * 0.1) % 1.0;
      const x = cx + Math.sin(i * 1.3) * r * (1 - t) * 0.6;
      const y = cy - r * 1.2 * (1 - t) - r * 0.4;
      const a = (1 - t) * 0.7;
      ctx.fillStyle = `rgba(0,220,255,${a})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // ── 磁場グリッド ─────────────────────────────────────
  _drawMagneticGrid(ctx, cx, cy, r, body, phase, time) {
    const phiRatio  = body.phi / PANDORA_CONST.PHI_IDEAL;
    const gridAlpha = Math.min(0.6, 0.05 + phiRatio * 0.3);
    const gridColor = phase === 'Sapient'      ? '255,120,180'
                    : phase === 'Complex'       ? '255,200,80'
                    : phase === 'Multicellular' ? '100,255,180'
                    : '0,200,255';

    ctx.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) {
      const rot = time * 0.0004 + i * (Math.PI / 5);
      ctx.strokeStyle = `rgba(${gridColor},${gridAlpha})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.12, r * 0.62, rot, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ── コア・地表 ───────────────────────────────────────
  _drawCore(ctx, cx, cy, r, body, climate, species, phase, time) {
    const pulse   = 1.0 + Math.sin(time * 0.01) * (body.strain / 20);
    const coreHue = phase === 'Sapient'      ? 320
                  : phase === 'Complex'       ? 40
                  : phase === 'Multicellular' ? 140
                  : phase === 'Cambrian'      ? 160
                  : 200;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0,            `hsla(${coreHue},100%,85%,1)`);
    grad.addColorStop(0.15 * pulse, `hsla(${coreHue},80%,45%,0.9)`);
    grad.addColorStop(0.6,          `hsla(${coreHue},60%,15%,0.8)`);
    grad.addColorStop(1,            'rgba(5,10,20,1)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Strain 過剰時: コア外周が赤く脈動
    if (body.strain > PANDORA_CONST.PHASE.ATTENTION) {
      const strainAlpha = Math.min(0.6, (body.strain - 8.5) / 10);
      const puls2 = 0.5 + Math.sin(time * 0.02) * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,30,50,${strainAlpha * puls2})`;
      ctx.lineWidth   = 4;
      ctx.stroke();
    }
  }

  // ── 南極排出 ─────────────────────────────────────────
  _drawOutflow(ctx, cx, cy, r, body, time) {
    const count        = Math.min(Math.floor(body.entropyOutflow * 800), 150);
    const blocked      = body.isDischargeBlocked;
    const dischargeCol = blocked ? '255,0,0' : '255,100,50';
    const flashBlink   = blocked ? (Math.sin(time * 0.05) > 0 ? 1 : 0.2) : 1;

    for (let i = 0; i < count; i++) {
      const t = (time * 0.003 + i * 0.05) % 1.0;
      const x = cx + Math.cos(i * 1.1) * r * t * 0.8;
      const y = cy + r * 0.5 + t * r * 1.5;
      ctx.fillStyle = `rgba(${dischargeCol},${(1 - t) * flashBlink})`;
      ctx.fillRect(x, y, 3, 3);
    }
  }

  // ── 生命圏リング ─────────────────────────────────────
  _drawBiosphere(ctx, cx, cy, r, species, phase, time) {
    const bioR   = r * (1.05 + species.biodiversity * 0.08);
    const bioCol = species.techLevel > 0.5
      ? `rgba(255,200,50,${species.population * 0.4})`
      : `rgba(50,255,120,${species.population * 0.35})`;

    ctx.beginPath();
    ctx.arc(cx, cy, bioR, 0, Math.PI * 2);
    ctx.strokeStyle = bioCol;
    ctx.lineWidth   = 2 + species.biodiversity * 3;
    ctx.shadowColor = bioCol;
    ctx.shadowBlur  = 12;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // 文明リング（techLevel > 0.1）
    if (species.techLevel > 0.1) {
      const techR   = r * (1.15 + species.techLevel * 0.1);
      const techRot = time * 0.001 * species.techLevel;
      ctx.beginPath();
      ctx.arc(cx, cy, techR, techRot, techRot + Math.PI * 2 * species.techLevel);
      ctx.strokeStyle = `rgba(255,180,0,${species.techLevel * 0.6})`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
  }

  // ── 気象エフェクト ────────────────────────────────────
  _drawWeatherEffect(ctx, W, H, climate, time) {
    if (!climate.weatherEvent) return;

    const effects = {
      EXTREME_STORM: { color: '255,255,255', alpha: 0.12, pulse: 0.08 },
      HEAVY_RAIN:    { color: '100,180,255', alpha: 0.07, pulse: 0.04 },
      BLIZZARD:      { color: '200,230,255', alpha: 0.10, pulse: 0.03 },
      HEATWAVE:      { color: '255,100,0',   alpha: 0.08, pulse: 0.05 },
    };
    const ef = effects[climate.weatherEvent];
    if (!ef) return;

    const a = ef.alpha * (0.5 + Math.sin(time * ef.pulse) * 0.5);
    ctx.fillStyle = `rgba(${ef.color},${a})`;
    ctx.fillRect(0, 0, W, H);
  }

  // ── bgf 密度メーター ─────────────────────────────────
  _drawBGFMeter(ctx, W, H, body) {
    const ratio  = body.strain / PANDORA_DERIVED.BGF;
    const mW     = 100, mH = 6;
    const mx     = W - mW - 12;
    const my     = H - 28;
    const col    = ratio >= 1.2 ? '#ff2244' : ratio >= 1.0 ? '#ff8800' : '#00e5a0';

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(mx - 4, my - 18, mW + 8, mH + 24);

    ctx.fillStyle = 'rgba(0,40,20,0.5)';
    ctx.fillRect(mx, my, mW, mH);

    ctx.fillStyle   = col;
    ctx.shadowColor = col;
    ctx.shadowBlur  = ratio >= 1.0 ? 8 : 0;
    ctx.fillRect(mx, my, Math.min(1, ratio / 1.5) * mW, mH);
    ctx.shadowBlur  = 0;

    ctx.fillStyle = 'rgba(180,220,200,0.55)';
    ctx.font      = '9px "Courier New"';
    ctx.textAlign = 'left';
    ctx.fillText(`Φ ${body.phi.toFixed(3)}`, mx, my - 5);
    ctx.fillStyle = col;
    ctx.textAlign = 'right';
    ctx.fillText(`Strain ${body.strain.toFixed(2)}`, mx + mW, my - 5);
  }

  // ── フェーズフラッシュ ────────────────────────────────
  _drawFlash(ctx, W, H, phase) {
    if (phase !== this._prevPhase) {
      this._flashAlpha = 0.35;
      this._flashColor = phase === 'Sapient'      ? '255,100,200'
                       : phase === 'Complex'       ? '255,200,50'
                       : phase === 'Multicellular' ? '50,255,150'
                       : phase === 'Cambrian'      ? '0,255,180'
                       : '100,150,255';
      this._prevPhase = phase;
    }
    if (this._flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(${this._flashColor},${this._flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
      this._flashAlpha *= 0.88;
    }
  }

  // ── アニメーションループ ─────────────────────────────
  startLoop(getSnapshot) {
    let t = 0;
    const loop = (ts) => {
      t = ts;
      const snap = getSnapshot();
      if (snap) this.draw(snap, t);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }
}
