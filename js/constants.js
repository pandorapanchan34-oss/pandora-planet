// js/constants.js
// Pandora Theory 宇宙定数（全銀河共通・不変）
export const UNIVERSAL = {
    B: 24.0,                    // Finite Bandwidth
    TAU: 0.1194,                // Phase Delay Coefficient
    n: 3.0,                     // Dimensional Compression
    PHI_CRITICAL: 5 / 6,        // ≈ 0.8333

    get bgf() {
        return (this.B / this.n) * (1 - this.TAU) * Math.E; // ≈19.15
    }
};
