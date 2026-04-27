"use strict";
/**
 * Runtime Integration Layer - FIXED VERSION
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionContexts = void 0;
exports.initSessionContext = initSessionContext;
exports.prepareTaskExecution = prepareTaskExecution;
exports.executeWithHealing = executeWithHealing;
exports.cleanupSession = cleanupSession;
exports.resumeSessionFromCheckpoint = resumeSessionFromCheckpoint;
const skill_loader_js_1 = require("./skill-loader.js");
const router_v2_js_1 = require("./router-v2.js");
const healing_loop_v2_js_1 = require("./healing-loop-v2.js");
const checkpoint_manager_v2_js_1 = require("./checkpoint-manager-v2.js");
const telemetry_js_1 = require("./telemetry.js");
const PolicyEngine_js_1 = require("../core/PolicyEngine.js");
const TelemetryManager_js_1 = require("../core/TelemetryManager.js");
const sessionContexts = new Map();
exports.sessionContexts = sessionContexts;
const policyEngine = (0, PolicyEngine_js_1.getPolicyEngine)();
const telemetry = (0, TelemetryManager_js_1.getTelemetryManager)();
async function initSessionContext(sessionId, workspace, description, agentType) {
    const ctx = { sessionId, workspace, metadata: {} };
    try {
        const allSkills = await (0, skill_loader_js_1.discoverSkills)();
        const matched = (0, skill_loader_js_1.matchSkills)(description, agentType, allSkills);
        if (matched.length > 0) {
            const resolved = await (0, skill_loader_js_1.resolveDependencies)(matched, allSkills);
            await (0, skill_loader_js_1.startSkillMCPs)(sessionId, resolved);
            const skillInjection = (0, skill_loader_js_1.getSkillPromptInjection)(sessionId);
            const permissions = (0, skill_loader_js_1.getSkillPermissions)(sessionId);
            const health = (0, skill_loader_js_1.getSkillHealth)(sessionId);
            ctx.metadata.skill_injection = skillInjection;
            ctx.metadata.skill_permissions = permissions;
            ctx.metadata.skill_health = health;
            ctx.activeSkills = resolved.map(s => s.id);
            (0, telemetry_js_1.structuredLog)('info', 'session_skills_initialized', {
                sessionId: sessionId,
                skills: ctx.activeSkills,
                mcp_count: Object.keys(health).length
            });
        }
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'skill_init_failed', { sessionId: sessionId, error: e.message });
    }
    try {
        const routingDecision = await (0, router_v2_js_1.routeTaskV2)({
            action: description,
            budget_pct: ctx.metadata.budget_consumed_usd || 50,
            breakerStates: {},
            config: { agents: {} },
            target_paths: [workspace]
        });
        ctx.routingDecision = routingDecision;
        ctx.metadata.routing_decision = routingDecision;
        (0, telemetry_js_1.structuredLog)('info', 'session_routing_decided', {
            sessionId: sessionId,
            selected_agent: routingDecision.agent,
            intent: routingDecision.intent,
            complexity: routingDecision.metrics.complexity
        });
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'routing_init_failed', { sessionId: sessionId, error: e.message });
    }
    try {
        const checkpoint = await (0, checkpoint_manager_v2_js_1.createCheckpoint)(sessionId, workspace, false);
        ctx.checkpointId = checkpoint.id;
        ctx.metadata.checkpoint_id = checkpoint.id;
        (0, telemetry_js_1.structuredLog)('info', 'session_checkpoint_saved', {
            sessionId: sessionId,
            checkpoint_id: checkpoint.id
        });
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'checkpoint_init_failed', { sessionId: sessionId, error: e.message });
    }
    sessionContexts.set(sessionId, ctx);
    return ctx;
}
async function prepareTaskExecution(sessionId, description) {
    const ctx = sessionContexts.get(sessionId);
    if (!ctx) {
        throw new Error(`Session ${sessionId} not initialized`);
    }
    const skillContext = ctx.metadata.skill_injection || '';
    const preparedDescription = skillContext
        ? `${description}\n\n${skillContext}`.trim()
        : description;
    const policyResult = await policyEngine.evaluate({
        sessionId: sessionId,
        action: description,
        agent_type: ctx.metadata.routing_decision?.agent
    });
    if (!policyResult.allowed) {
        const violations = policyResult.violations || [];
        throw new Error(`Policy violation: ${violations.map(v => v.message).join(', ')}`);
    }
    if (ctx.checkpointId) {
        try {
            const state = await (0, checkpoint_manager_v2_js_1.createCheckpoint)(sessionId, ctx.workspace, false);
            ctx.checkpointId = state.id;
            ctx.metadata.checkpoint_id = ctx.checkpointId;
        }
        catch (e) {
            (0, telemetry_js_1.structuredLog)('warn', 'pre_execution_checkpoint_failed', { sessionId: sessionId, error: e.message });
        }
    }
    return { preparedDescription, context: ctx };
}
async function executeWithHealing(sessionId, agentExecuteFn, maxRetries = 3) {
    const ctx = sessionContexts.get(sessionId);
    let lastError = null;
    let healingAttempts = 0;
    if (!ctx?.healingCtx) {
        ctx.healingCtx = await (0, healing_loop_v2_js_1.initHealingLoopV2)(sessionId, ctx?.workspace, 'medium', 0);
    }
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await agentExecuteFn();
            if (ctx?.checkpointId) {
                try {
                    const state = await (0, checkpoint_manager_v2_js_1.createCheckpoint)(sessionId, ctx.workspace, true);
                    ctx.checkpointId = state.id;
                }
                catch (e) {
                    (0, telemetry_js_1.structuredLog)('warn', 'post_execution_checkpoint_failed', { sessionId: sessionId, error: e.message });
                }
            }
            return {
                ...result,
                checkpointId: ctx?.checkpointId,
                routingDecision: ctx?.routingDecision,
                healingAttempts,
                skillContext: ctx?.metadata.skill_injection
            };
        }
        catch (e) {
            lastError = e;
            healingAttempts++;
            (0, telemetry_js_1.structuredLog)('error', 'task_execution_failed', {
                sessionId: sessionId,
                attempt,
                error: e.message
            });
            if (attempt < maxRetries) {
                try {
                    const healingResult = await (0, healing_loop_v2_js_1.executeHealingStepV2)(ctx.healingCtx, e.message);
                    if (healingResult.should_retry) {
                        (0, telemetry_js_1.structuredLog)('info', 'healing_step_success', {
                            sessionId: sessionId,
                            strategy: healingResult.strategy_result?.strategy || 'unknown'
                        });
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                catch (healingError) {
                    (0, telemetry_js_1.structuredLog)('error', 'healing_loop_failed', {
                        sessionId: sessionId,
                        error: healingError.message
                    });
                }
            }
        }
    }
    throw lastError;
}
async function cleanupSession(sessionId) {
    const ctx = sessionContexts.get(sessionId);
    if (!ctx)
        return;
    try {
        const state = await (0, checkpoint_manager_v2_js_1.createCheckpoint)(sessionId, ctx.workspace, true);
        (0, telemetry_js_1.structuredLog)('info', 'session_final_checkpoint', { sessionId: sessionId, checkpoint_id: state.id });
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'final_checkpoint_failed', { sessionId: sessionId, error: e.message });
    }
    try {
        if (ctx.activeSkills && ctx.activeSkills.length > 0) {
            await (0, skill_loader_js_1.stopSkillMCPs)(sessionId);
            (0, telemetry_js_1.structuredLog)('info', 'session_skills_cleaned', { session_id: sessionId });
        }
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'skill_cleanup_failed', { sessionId: sessionId, error: e.message });
    }
    try {
        await telemetry.shutdown();
        (0, telemetry_js_1.structuredLog)('info', 'session_telemetry_flushed', { session_id: sessionId });
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'telemetry_flush_failed', { sessionId: sessionId, error: e.message });
    }
    sessionContexts.delete(sessionId);
}
async function resumeSessionFromCheckpoint(sessionId, workspace) {
    try {
        const restored = await (0, checkpoint_manager_v2_js_1.restoreCheckpoint)(sessionId, workspace);
        if (!restored)
            return null;
        const ctx = {
            sessionId,
            workspace,
            metadata: {},
            checkpointId: sessionId,
            activeSkills: []
        };
        if (ctx.activeSkills && ctx.activeSkills.length > 0) {
            const allSkills = await (0, skill_loader_js_1.discoverSkills)();
            const toStart = allSkills.filter(s => ctx.activeSkills.includes(s.id));
            if (toStart.length > 0) {
                await (0, skill_loader_js_1.startSkillMCPs)(sessionId, toStart);
            }
        }
        sessionContexts.set(sessionId, ctx);
        (0, telemetry_js_1.structuredLog)('info', 'session_resumed', { sessionId: sessionId, checkpoint_id: sessionId });
        return ctx;
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('error', 'session_resume_failed', { sessionId: sessionId, error: e.message });
        return null;
    }
}
//# sourceMappingURL=runtime-integration.js.map