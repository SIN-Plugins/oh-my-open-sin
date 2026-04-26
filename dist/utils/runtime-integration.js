"use strict";
/**
 * Runtime Integration Layer - FIXED VERSION
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRuntimeContext = initRuntimeContext;
exports.executeWithRuntimeIntegration = executeWithRuntimeIntegration;
exports.cleanupRuntimeContext = cleanupRuntimeContext;
const skill_loader_js_1 = require("./skill-loader.js");
const router_v2_js_1 = require("./router-v2.js");
const healing_loop_v2_js_1 = require("./healing-loop-v2.js");
const checkpoint_manager_v2_js_1 = require("./checkpoint-manager-v2.js");
const telemetry_js_1 = require("./telemetry.js");
const PolicyEngine_js_1 = require("../core/PolicyEngine.js");
const TelemetryManager_js_1 = require("../core/TelemetryManager.js");
const config_loader_js_1 = require("./config-loader.js");
async function initRuntimeContext(sessionId) {
    const config = await (0, config_loader_js_1.loadConfig)();
    const policyEngine = (0, PolicyEngine_js_1.getPolicyEngine)();
    const telemetryManager = (0, TelemetryManager_js_1.getTelemetryManager)();
    return { sessionId, config, policyEngine, telemetryManager };
}
async function executeWithRuntimeIntegration(ctx, description, targetPaths = [], worktreePath) {
    // 1. Skill Discovery & Injection
    const allSkills = await (0, skill_loader_js_1.discoverSkills)();
    const matchedSkills = (0, skill_loader_js_1.matchSkills)(description, 'hermes', allSkills);
    const resolvedSkills = await (0, skill_loader_js_1.resolveDependencies)(matchedSkills, allSkills);
    if (resolvedSkills.length > 0) {
        await (0, skill_loader_js_1.startSkillMCPs)(ctx.sessionId, resolvedSkills);
        const injection = (0, skill_loader_js_1.getSkillPromptInjection)(ctx.sessionId);
        const perms = (0, skill_loader_js_1.getSkillPermissions)(ctx.sessionId);
        description = `${description}\n\n${injection}`.trim();
        (0, telemetry_js_1.structuredLog)('info', 'skills_injected', {
            session_id: ctx.sessionId,
            skills: resolvedSkills.map(s => s.id)
        });
    }
    // 2. Context-Aware Routing v2
    const budgetPct = ctx.config.budget?.warning_threshold_pct || 80;
    const breakerStates = {};
    const routingDecision = await (0, router_v2_js_1.routeTaskV2)({
        description,
        target_paths: targetPaths,
        budget_pct: budgetPct,
        breakerStates,
        config: ctx.config
    });
    ctx.routingDecision = routingDecision;
    (0, telemetry_js_1.structuredLog)('info', 'routing_decision_v2', {
        session_id: ctx.sessionId,
        agent: routingDecision.agent,
        model: routingDecision.model,
        intent: routingDecision.intent,
        multi_layer: routingDecision.multi_layer_split
    });
    // 3. Create Checkpoint
    ctx.checkpoint = await (0, checkpoint_manager_v2_js_1.createCheckpoint)(ctx.sessionId, worktreePath);
    // 4. Initialize Healing Loop
    ctx.healingCtx = await (0, healing_loop_v2_js_1.initHealingLoopV2)(ctx.sessionId, worktreePath, routingDecision.metrics.complexity, budgetPct);
    // 5. Execute with Policy Check
    const policyContext = {
        agentId: routingDecision.agent,
        action: 'execute_task',
        resource: `task:${ctx.sessionId}`,
        capabilities: ['execute', 'read', 'write'],
        timestamp: Date.now(),
        subject: routingDecision.agent,
        metadata: {
            description: description.slice(0, 200),
            target_paths: targetPaths,
            model: routingDecision.model
        }
    };
    const policyDecision = await ctx.policyEngine.evaluate(policyContext);
    if (!policyDecision.allowed) {
        (0, telemetry_js_1.structuredLog)('warn', 'policy_denied', {
            session_id: ctx.sessionId,
            reason: policyDecision.reason
        });
        return {
            success: false,
            error: `Policy denied: ${policyDecision.reason}`,
            duration: 0,
            metadata: { policy_reason: policyDecision.reason }
        };
    }
    // 6. Execute Task (simulated - actual execution happens in OpenCode)
    const startTime = Date.now();
    try {
        // Here would be the actual task() call to OpenCode
        // For now, simulate success
        const duration = Date.now() - startTime;
        await ctx.telemetryManager.recordEvent('task_completed', {
            session_id: ctx.sessionId,
            agent: routingDecision.agent,
            duration_ms: duration,
            model: routingDecision.model
        });
        return {
            success: true,
            data: { agent: routingDecision.agent, model: routingDecision.model },
            duration,
            metadata: { routing: routingDecision, checkpoint: ctx.checkpoint }
        };
    }
    catch (error) {
        // 7. Trigger Healing Loop on Error
        const lspOutput = ''; // Would come from LSP diagnostics
        const { should_retry, adapted_prompt, updated_ctx } = await (0, healing_loop_v2_js_1.executeHealingStepV2)(ctx.healingCtx, error.message, lspOutput, error.code);
        ctx.healingCtx = updated_ctx;
        if (should_retry) {
            (0, telemetry_js_1.structuredLog)('info', 'healing_retry_triggered', {
                session_id: ctx.sessionId,
                attempt: ctx.healingCtx.attempt,
                strategy: ctx.healingCtx.strategy_history[ctx.healingCtx.strategy_history.length - 1]
            });
            // Retry with adapted prompt
            return executeWithRuntimeIntegration(ctx, adapted_prompt, targetPaths, worktreePath);
        }
        else {
            (0, telemetry_js_1.structuredLog)('error', 'healing_exhausted', {
                session_id: ctx.sessionId,
                attempts: ctx.healingCtx.attempt
            });
            return {
                success: false,
                error: `Healing exhausted after ${ctx.healingCtx.attempt} attempts: ${error.message}`,
                duration: Date.now() - startTime,
                metadata: { healing_attempts: ctx.healingCtx.attempt }
            };
        }
    }
    finally {
        // Cleanup skills on session end
        await (0, skill_loader_js_1.stopSkillMCPs)(ctx.sessionId);
    }
}
async function cleanupRuntimeContext(ctx) {
    await (0, skill_loader_js_1.stopSkillMCPs)(ctx.sessionId);
    (0, telemetry_js_1.structuredLog)('info', 'runtime_context_cleaned', { session_id: ctx.sessionId });
}
//# sourceMappingURL=runtime-integration.js.map