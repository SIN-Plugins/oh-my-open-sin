import { CheckpointMeta } from "./checkpoint-manager-v2";
import { FailureAnalysis } from "./failure-classifier-v2";
import { StrategyResult } from "./healing-strategies";
export interface HealingContextV2 {
    session_id: string;
    attempt: number;
    max_attempts: number;
    budget_pct: number;
    last_analysis: FailureAnalysis;
    strategy_history: string[];
    checkpoint: CheckpointMeta;
    worktree_path?: string;
    circuit_breakers: Record<string, boolean>;
}
export declare function calculateDynamicBudget(complexity: "low" | "medium" | "high", budget_pct: number, historical_success: number): number;
export declare function initHealingLoopV2(sessionId: string, worktreePath?: string, complexity?: "low" | "medium" | "high", budget_pct?: number): Promise<HealingContextV2>;
export declare function executeHealingStepV2(ctx: HealingContextV2, errorOutput: string, lspOutput?: string, exitCode?: number): Promise<{
    should_retry: boolean;
    strategy_result?: StrategyResult;
    adapted_prompt: string;
    updated_ctx: HealingContextV2;
}>;
//# sourceMappingURL=healing-loop-v2.d.ts.map