#!/usr/bin/env tsx
export declare function sinHealingDebugV2(errorFile: string): Promise<{
    analysis: import("../utils/failure-classifier-v2").FailureAnalysis;
    recommended_strategy: string;
    matrix_snapshot: Record<string, import("../utils/healing-learner").MatrixEntry>;
}>;
export declare class SinHealingDebugV2 {
    run(errorFile: string): Promise<{
        analysis: import("../utils/failure-classifier-v2").FailureAnalysis;
        recommended_strategy: string;
        matrix_snapshot: Record<string, import("../utils/healing-learner").MatrixEntry>;
    }>;
}
//# sourceMappingURL=sin-healing-debug-v2.d.ts.map