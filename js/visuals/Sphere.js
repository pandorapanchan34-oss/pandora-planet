// js/visuals/Sphere.js
export class SphereVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    draw(engineState, time) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const r = Math.min(this.canvas.width, this.canvas.height) * 0.32;

        const pulse = Math.sin(time * 0.002) * (engineState.phi * 22);

        // 大気圏
        ctx.shadowBlur = 80;
        ctx.shadowColor = `hsla(${210}, 80%, 70%, 0.25)`;
        ctx.fillStyle = 'rgba(20, 60, 100, 0.15)';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
        ctx.fill();

        // 回転グリッド
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 14; i++) {
            const rot = time * 0.0006 + i * 0.45;
            ctx.strokeStyle = `rgba(0, 255, 180, ${0.15 + engineState.phi * 0.25})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy, r * 1.15, r * 0.78, rot, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (engineState.strain > 8) {
            // Strain粒子（南極排出）
            for (let i = 0; i < 35; i++) {
                const t = (time * 0.0012 + i) % 2.4;
                const x = cx + Math.sin(time * 0.004 + i) * (r * 0.6 + t * r);
                const y = cy + r * 0.4 + t * r * 1.8;
                ctx.fillStyle = `rgba(255, 80, 60, ${1.4 - t})`;
                ctx.fillRect(x - 3, y, 6, 6);
            }
        }

        // 中心コア
        ctx.shadowBlur = 60;
        ctx.shadowColor = engineState.phi > 1.0 ? '#ff44aa' : '#00ffaa';
        ctx.fillStyle = '#112211';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}
