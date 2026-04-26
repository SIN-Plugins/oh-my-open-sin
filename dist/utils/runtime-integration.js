"use strict";
/**
 * Runtime Integration Layer
 *
 * Verbindet alle Module im tatsächlichen Execution-Flow:
 * - Skill-Injection vor Agent-Execution
 * - Context-Aware Routing v2
 * - Self-Healing Loop bei Failures
 * - Checkpoint Auto-Save
 * - Native OpenCode Hooks
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
/**
 * Initialisiert Session-Kontext mit Skills, Routing und Checkpoint
 */
async function initSessionContext(sessionId, workspace, description, agentType) {
    const ctx = { sessionId, workspace, metadata: {} };
    // 1. Skill Discovery & Injection
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
                session_id: sessionId,
                skills: ctx.activeSkills,
                mcp_count: Object.keys(health).length
            });
        }
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'skill_init_failed', { session_id: sessionId, error: e.message });
    }
    // 2. Context-Aware Routing
    try {
        const routingDecision = await (0, router_v2_js_1.routeTaskV2)(description, agentType, workspace);
        ctx.routingDecision = routingDecision;
        ctx.metadata.routing_decision = routingDecision;
        (0, telemetry_js_1.structuredLog)('info', 'session_routing_decided', {
            session_id: sessionId,
            selected_agent: routingDecision.selectedAgent,
            confidence: routingDecision.confidence
        });
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'routing_init_failed', { session_id: sessionId, error: e.message });
    }
    // 3. Initial Checkpoint
    try {
        const checkpointState = {
            sessionId,
            workspace,
            timestamp: Date.now(),
            phase: 'initialized',
            metadata: ctx.metadata,
            taskHistory: []
        };
        const checkpointId = await (0, checkpoint_manager_v2_js_1.saveCheckpoint)(checkpointState);
        ctx.checkpointId = checkpointId;
        ctx.metadata.checkpoint_id = checkpointId;
        (0, telemetry_js_1.structuredLog)('info', 'session_checkpoint_saved', {
            session_id: sessionId,
            checkpoint_id: checkpointId
        });
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'checkpoint_init_failed', { session_id: sessionId, error: e.message });
    }
    sessionContexts.set(sessionId, ctx);
    return ctx;
}
/**
 * Bereitet Task vor mit Skill-Injection, Policy-Check und Checkpoint
 */
async function prepareTaskExecution(sessionId, description) {
    const ctx = sessionContexts.get(sessionId);
    if (!ctx) {
        throw new Error(`Session ${sessionId} not initialized`);
    }
    // Skill-Injection in Description
    const skillContext = ctx.metadata.skill_injection || '';
    const preparedDescription = skillContext
        ? `${description}\n\n${skillContext}`.trim()
        : description;
    // Policy-Check
    const policyResult = await policyEngine.evaluate('task_execution', {
        session_id: sessionId,
        description,
        agent_type: ctx.metadata.routing_decision?.selectedAgent
    });
    if (!policyResult.allowed) {
        throw new Error(`Policy violation: ${policyResult.violations.map(v => v.message).join(', ')}`);
    }
    // Pre-Execution Checkpoint
    if (ctx.checkpointId) {
        try {
            const state = {
                sessionId,
                workspace: ctx.workspace,
                timestamp: Date.now(),
                phase: 'pre_execution',
                metadata: ctx.metadata,
                taskHistory: [...(ctx.metadata.task_history || []), { description, timestamp: Date.now() }]
            };
            ctx.checkpointId = await (0, checkpoint_manager_v2_js_1.saveCheckpoint)(state);
            ctx.metadata.checkpoint_id = ctx.checkpointId;
        }
        catch (e) {
            (0, telemetry_js_1.structuredLog)('warn', 'pre_execution_checkpoint_failed', { session_id: sessionId, error: e.message });
        }
    }
    return { preparedDescription, context: ctx };
}
/**
 * Führt Task aus mit Self-Healing bei Failures
 */
async function executeWithHealing(sessionId, agentExecuteFn, maxRetries = 3) {
    const ctx = sessionContexts.get(sessionId);
    let lastError = null;
    let healingAttempts = 0;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await agentExecuteFn();
            // Success - Save Post-Execution Checkpoint
            if (ctx?.checkpointId) {
                try {
                    const state = {
                        sessionId,
                        workspace: ctx.workspace,
                        timestamp: Date.now(),
                        phase: 'post_execution',
                        metadata: { ...ctx.metadata, result_summary: result.summary },
                        taskHistory: ctx.metadata.task_history || []
                    };
                    ctx.checkpointId = await (0, checkpoint_manager_v2_js_1.saveCheckpoint)(state);
                }
                catch (e) {
                    (0, telemetry_js_1.structuredLog)('warn', 'post_execution_checkpoint_failed', { session_id: sessionId, error: e.message });
                }
            }
            // Routing Feedback
            if (ctx?.routingDecision) {
                try {
                    const feedback = { success: true, duration_ms: result.duration_ms || 0 };
                    // routingFeedbackLoop(ctx.routingDecision, feedback);
                }
                catch (e) {
                    (0, telemetry_js_1.structuredLog)('warn', 'routing_feedback_failed', { session_id: sessionId, error: e.message });
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
                session_id: sessionId,
                attempt,
                error: e.message
            });
            if (attempt < maxRetries) {
                try {
                    const healingResult = await (0, healing_loop_v2_js_1.healingLoopV2)(e, {
                        sessionId,
                        attempt,
                        lastError: e.message
                    });
                    if (healingResult.shouldRetry) {
                        (0, telemetry_js_1.structuredLog)('info', 'healing_retry_scheduled', {
                            session_id: sessionId,
                            strategy: healingResult.strategy,
                            backoff_ms: healingResult.backoffMs
                        });
                        if (healingResult.backoffMs > 0) {
                            await new Promise(resolve => setTimeout(resolve, healingResult.backoffMs));
                        }
                        continue;
                    }
                }
                catch (healingError) {
                    (0, telemetry_js_1.structuredLog)('error', 'healing_loop_failed', {
                        session_id: sessionId,
                        error: healingError.message
                    });
                }
            }
        }
    }
    // All retries exhausted
    throw lastError;
}
/**
 * Cleanup Session am Ende
 */
async function cleanupSession(sessionId) {
    const ctx = sessionContexts.get(sessionId);
    if (!ctx)
        return;
    // Final Checkpoint
    try {
        const state = {
            sessionId,
            workspace: ctx.workspace,
            timestamp: Date.now(),
            phase: 'completed',
            metadata: ctx.metadata,
            taskHistory: ctx.metadata.task_history || []
        };
        await (0, checkpoint_manager_v2_js_1.saveCheckpoint)(state);
        (0, telemetry_js_1.structuredLog)('info', 'session_final_checkpoint', { session_id: sessionId });
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'final_checkpoint_failed', { session_id: sessionId, error: e.message });
    }
    // Skill Cleanup
    try {
        if (ctx.activeSkills && ctx.activeSkills.length > 0) {
            await (0, skill_loader_js_1.stopSkillMCPs)(sessionId);
            (0, telemetry_js_1.structuredLog)('info', 'session_skills_cleaned', { session_id: sessionId });
        }
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'skill_cleanup_failed', { session_id: sessionId, error: e.message });
    }
    // Telemetry Flush
    try {
        await telemetry.flush();
        (0, telemetry_js_1.structuredLog)('info', 'session_telemetry_flushed', { session_id: sessionId });
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('warn', 'telemetry_flush_failed', { session_id: sessionId, error: e.message });
    }
    sessionContexts.delete(sessionId);
}
/**
 * Resume Session von Checkpoint nach Crash
 */
async function resumeSessionFromCheckpoint(sessionId, workspace) {
    try {
        const checkpoint = await (0, checkpoint_manager_v2_js_1.loadCheckpoint)(sessionId);
        if (!checkpoint)
            return null;
        const ctx = {
            sessionId,
            workspace,
            metadata: checkpoint.metadata || {},
            checkpointId: checkpoint.id,
            activeSkills: checkpoint.metadata?.active_skills
        };
        // Re-start Skills wenn vorhanden
        if (ctx.activeSkills && ctx.activeSkills.length > 0) {
            const allSkills = await (0, skill_loader_js_1.discoverSkills)();
            const toStart = allSkills.filter(s => ctx.activeSkills.includes(s.id));
            if (toStart.length > 0) {
                await (0, skill_loader_js_1.startSkillMCPs)(sessionId, toStart);
            }
        }
        sessionContexts.set(sessionId, ctx);
        (0, telemetry_js_1.structuredLog)('info', 'session_resumed', { session_id: sessionId, checkpoint_id: checkpoint.id });
        return ctx;
    }
    catch (e) {
        (0, telemetry_js_1.structuredLog)('error', 'session_resume_failed', { session_id: sessionId, error: e.message });
        return null;
    }
}
//# sourceMappingURL=runtime-integration.js.map