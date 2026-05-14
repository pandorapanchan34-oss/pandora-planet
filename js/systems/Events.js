export class EventSystem {
    static trigger(engine) {
        const excess = engine.state.strain - engine.config.strainThresh;
        if (excess > 0 && Math.random() < Math.tanh(excess / 5) * 0.02) {
            // 絶滅の実行
            engine.state.phi *= 0.88; // MAJORレベル
            engine.state.strain *= 0.5; // 圧力解放
            return { type: "火山活動", severity: "MAJOR" };
        }
        return null;
    }
}
