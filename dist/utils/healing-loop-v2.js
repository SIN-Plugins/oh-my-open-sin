"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDynamicBudget = calculateDynamicBudget;
exports.initHealingLoopV2 = initHealingLoopV2;
exports.executeHealingStepV2 = executeHealingStepV2;
const telemetry_1 = require("./telemetry");
const checkpoint_manager_v2_1 = require("./checkpoint-manager-v2");
const failure_classifier_v2_1 = require("./failure-classifier-v2");
const healing_strategies_1 = require("./healing-strategies");
const healing_learner_1 = require("./healing-learner");
function calculateDynamicBudget(complexity, budget_pct, historical_success) {
    let base = complexity === "high" ? 5 : complexity === "medium" ? 3 : 2;
    if (budget_pct > 90)
        base = Math.max(1, base - 2);
    else if (budget_pct > 70)
        base = Math.max(1, base - 1);
    if (historical_success < 0.4)
        base = Math.max(1, base - 1);
    return base;
}
async function initHealingLoopV2(sessionId, worktreePath, complexity = "medium", budget_pct = 0) {
    const cp = await (0, checkpoint_manager_v2_1.createCheckpoint)(sessionId, worktreePath);
    const matrix = await (0, healing_learner_1.loadMatrix)();
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
async function executeHealingStepV2(ctx, errorOutput, lspOutput, exitCode) {
    ctx.attempt++;
    const analysis = (0, failure_classifier_v2_1.classifyFailureV2)(errorOutput, exitCode, lspOutput);
    ctx.last_analysis = analysis;
    if (ctx.attempt > ctx.max_attempts) {
        (0, telemetry_1.structuredLog)("warn", "healing_exhausted_v2", { session_id: ctx.session_id, attempts: ctx.attempt });
        return { should_retry: false, adapted_prompt: "", updated_ctx: ctx };
    }
    // Rollback
    await (0, checkpoint_manager_v2_1.restoreCheckpoint)(ctx.checkpoint.id, ctx.worktree_path);
    // Strategy selection
    const matrix = await (0, healing_learner_1.loadMatrix)();
    let strategy = (0, healing_learner_1.recommendStrategy)(analysis.primary_type, matrix);
    if (ctx.circuit_breakers[strategy] === false) {
        strategy = "lsp_auto_fix"; // fallback if circuit open
    }
    ctx.strategy_history.push(strategy);
    // Execute strategy
    const strategyFn = healing_strategies_1.STRATEGY_MAP[strategy];
    let result = { success: false, output: "Strategy not implemented", artifacts: [], strategy };
    if (strategyFn) {
        result = await strategyFn(ctx.worktree_path || process.cwd(), {
            files: analysis.lsp_diagnostics?.map(d => d.file) || [],
            session_id: ctx.session_id,
            test_cmd: "npm test",
            description: errorOutput.slice(0, 100)
        });
    }
    // Update circuit breaker & matrix
    await (0, healing_learner_1.updateMatrix)(analysis.primary_type, strategy, result.success);
    if (!result.success) {
        ctx.circuit_breakers[strategy] = false;
    }
    else {
        ctx.circuit_breakers[strategy] = true;
    }
    const prompt = `\n🔄 SELF-HEALING RETRY (Attempt ${ctx.attempt}/${ctx.max_attempts})
Failure: ${analysis.primary_type.toUpperCase()} | Root: ${analysis.root_cause} | Confidence: ${(analysis.confidence * 100).toFixed(0)}%
Strategy executed: ${strategy} | Result: ${result.success ? "SUCCESS" : "FAILED"}
Output: ${result.output.slice(0, 300)}
Directive: ${analysis.hint}
History: ${ctx.strategy_history.join(" → ")}
Apply fix surgically. Validate with diagnostics/tests before completion. Do not repeat failed strategies.
`.trim();
    return { should_retry: !result.success, strategy_result: result, adapted_prompt: prompt, updated_ctx: ctx };
}
//# sourceMappingURL=healing-loop-v2.js.map