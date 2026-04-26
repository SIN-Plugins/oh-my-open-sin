import { structuredLog } from "./telemetry";
import { createCheckpoint, restoreCheckpoint, rollbackPartial, CheckpointMeta } from "./checkpoint-manager-v2";
import { classifyFailureV2, FailureAnalysis } from "./failure-classifier-v2";
import { STRATEGY_MAP, StrategyResult } from "./healing-strategies";
import { loadMatrix, updateMatrix, recommendStrategy } from "./healing-learner";

export interface HealingContextV2 {
  session_id: string;
  attempt: number;
  max_attempts: number;
  budget_pct: number;
  last_analysis: FailureAnalysis;
  strategy_history: string[];
  checkpoint: CheckpointMeta;
  worktree_path?: string;
  circuit_breakers: Record<string, boolean>; // strategy -> healthy
}

export function calculateDynamicBudget(complexity: "low"|"medium"|"high", budget_pct: number, historical_success: number): number {
  let base = complexity === "high" ? 5 : complexity === "medium" ? 3 : 2;
  if (budget_pct > 90) base = Math.max(1, base - 2);
  else if (budget_pct > 70) base = Math.max(1, base - 1);
  if (historical_success < 0.4) base = Math.max(1, base - 1);
  return base;
}

export async function initHealingLoopV2(sessionId: string, worktreePath?: string, complexity: "low"|"medium"|"high" = "medium", budget_pct = 0): Promise<HealingContextV2> {
  const cp = await createCheckpoint(sessionId, worktreePath);
  const matrix = await loadMatrix();
  const histSuccess = Object.values(matrix).reduce((acc, v) => acc + Object.values(v).reduce((a, e) => a + e.success_rate, 0), 0) / Math.max(1, Object.keys(matrix).length);
  const maxAttempts = calculateDynamicBudget(complexity, budget_pct, histSuccess);

  return {
    session_id: sessionId,
    attempt: 0,
    max_attempts: maxAttempts,
    budget_pct,
    last_analysis: { types: [], primary_type: "unknown", root_cause: "unknown", confidence: 0, is_flaky: false, hint: "", error_snippet: "" },
    strategy_history: [],
    checkpoint: cp,
    worktree_path: worktreePath,
    circuit_breakers: {}
  };
}

export async function executeHealingStepV2(
  ctx: HealingContextV2,
  errorOutput: string,
  lspOutput?: string,
  exitCode?: number
): Promise<{ should_retry: boolean; strategy_result?: StrategyResult; adapted_prompt: string; updated_ctx: HealingContextV2 }> {
  ctx.attempt++;
  const analysis = classifyFailureV2(errorOutput, exitCode, lspOutput);
  ctx.last_analysis = analysis;

  if (ctx.attempt > ctx.max_attempts) {
    structuredLog("warn", "healing_exhausted_v2", { session_id: ctx.session_id, attempts: ctx.attempt });
    return { should_retry: false, adapted_prompt: "", updated_ctx: ctx };
  }

  // Rollback
  await restoreCheckpoint(ctx.checkpoint.id, ctx.worktree_path);

  // Strategy selection
  const matrix = await loadMatrix();
  let strategy = recommendStrategy(analysis.primary_type, matrix);
  if (ctx.circuit_breakers[strategy] === false) {
    strategy = "lsp_auto_fix"; // fallback if circuit open
  }
  ctx.strategy_history.push(strategy);

  // Execute strategy
  const strategyFn = STRATEGY_MAP[strategy];
  let result: StrategyResult = { success: false, output: "Strategy not implemented", artifacts: [], strategy };
  if (strategyFn) {
    result = await strategyFn(ctx.worktree_path || process.cwd(), {
      files: analysis.lsp_diagnostics?.map(d => d.file) || [],
      session_id: ctx.session_id,
      test_cmd: "npm test",
      description: errorOutput.slice(0, 100)
    });
  }

  // Update circuit breaker & matrix
  await updateMatrix(analysis.primary_type, strategy, result.success);
  if (!result.success) {
    ctx.circuit_breakers[strategy] = false;
  } else {
    ctx.circuit_breakers[strategy] = true;
  }

  const prompt = `\n🔄 SELF-HEALING RETRY (Attempt ${ctx.attempt}/${ctx.max_attempts})
Failure: ${analysis.primary_type.toUpperCase()} | Root: ${analysis.root_cause} | Confidence: ${(analysis.confidence*100).toFixed(0)}%
Strategy executed: ${strategy} | Result: ${result.success ? "SUCCESS" : "FAILED"}
Output: ${result.output.slice(0, 300)}
Directive: ${analysis.hint}
History: ${ctx.strategy_history.join(" → ")}
Apply fix surgically. Validate with diagnostics/tests before completion. Do not repeat failed strategies.
`.trim();

  return { should_retry: !result.success, strategy_result: result, adapted_prompt: prompt, updated_ctx: ctx };
}
