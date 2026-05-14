import { PANDORA_CONST } from '../constants.js';

export class SphereVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // 粒子（エントロピー流）の初期化
        this.particles = [];
        for (let i = 0; i < 200; i++) {
            this.particles.push({
                x: 0, y: 0, 
                size: Math.random() * 3 + 1,
                speed: Math.random() * 0.02 + 0.005,
                angle: Math.random() * Math.PI * 2,
                offset: Math.random() * 100
            });
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    draw(engineSnapshot, time) {
        const { body, climate, species, phase } = engineSnapshot;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const r = Math.min(this.canvas.width, this.canvas.height) * 0.32;

        // 1. 背後光（大気圏/オーラ）
        // 温度と安定度によって色が変化
        const hue = 210 - (climate.surfaceTemp * 1.5); // 暑いと赤っぽく、寒いと青く
        ctx.shadowBlur = 100;
        ctx.shadowColor = `hsla(${hue}, 80%, 50%, 0.4)`;
        ctx.fillStyle = `hsla(${hue}, 60%, 20%, 0.1)`;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 2. 北極吸収 (Inflow / Gravity)
        // 青白い粒子が北から中心へ吸い込まれる
        const inflowCount = Math.floor(body.entropyInflow * 500);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
        for (let i = 0; i < Math.min(inflowCount, 100); i++) {
            const t = (time * 0.002 + i * 0.1) % 1.0;
            const x = cx + Math.sin(i) * r * (1 - t);
            const y = cy - r * 1.2 * (1 - t) - r * 0.5;
            ctx.fillRect(x, y, 2, 2);
        }

        // 3. 回転グリッド（磁場/同期層）
        // Φが理想値(5/6)に近いほど線が鮮明になり、Sapientで色が変わる
        const gridAlpha = 0.1 + (body.phi / PANDORA_CONST.PHI_IDEAL) * 0.3;
        const gridColor = phase === "Sapient" ? "255, 120, 180" : "0, 255, 180";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 10; i++) {
            const rot = time * 0.0004 + i * (Math.PI / 5);
            ctx.strokeStyle = `rgba(${gridColor}, ${gridAlpha})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy, r * 1.1, r * 0.6, rot, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 4. 南極排出 (Outflow / Discharge)
        // 赤い粒子が南へ吹き出す。DischargeBlockedだと激しく明滅
        const outflowCount = Math.floor(body.entropyOutflow * 800);
        const dischargeColor = body.isDischargeBlocked ? '255, 0, 0' : '255, 100, 50';
        for (let i = 0; i < Math.min(outflowCount, 150); i++) {
            const t = (time * 0.003 + i * 0.05) % 1.0;
            const x = cx + Math.cos(i) * r * t * 0.8;
            const y = cy + r * 0.5 + t * r * 1.5;
            ctx.fillStyle = `rgba(${dischargeColor}, ${1 - t})`;
            ctx.fillRect(x, y, 3, 3);
        }

        // 5. 地表/コア
        // Strainが溜まるとコアが赤く脈動する
        const pulse = 1.0 + Math.sin(time * 0.01) * (body.strain / 20);
        const coreHue = phase === "Sapient" ? 320 : phase === "Cambrian" ? 140 : 200;
        
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `hsla(${coreHue}, 100%, 80%, 1)`);
        grad.addColorStop(0.2 * pulse, `hsla(${coreHue}, 80%, 40%, 0.8)`);
        grad.addColorStop(1, 'rgba(10, 15, 25, 1)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // 6. 異常気象エフェクト
        if (climate.weatherEvent === 'EXTREME_STORM') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); // フラッシュ
        }
    }
}
