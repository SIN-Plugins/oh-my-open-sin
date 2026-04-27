"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestrator = void 0;
const PolicyEngine_js_1 = require("./PolicyEngine.js");
const NATSMessageBus_js_1 = require("./NATSMessageBus.js");
const TelemetryManager_js_1 = require("./TelemetryManager.js");
const DAGTaskScheduler_js_1 = require("./DAGTaskScheduler.js");
const runtime_integration_js_1 = require("../utils/runtime-integration.js");
/**
 * Orchestrates multiple subagents and manages task routing
 * Implements non-blocking, session-aware execution with enterprise features:
 * - Policy enforcement (Zero-Trust)
 * - Cryptographic provenance (Sigstore)
 * - Cross-swarm messaging (NATS)
 * - Telemetry & SLO monitoring
 * - DAG-based parallel orchestration
 * - Skill Injection & Context-Aware Routing v2
 * - Self-Healing Execution Loop
 */
class AgentOrchestrator {
    agents = new Map();
    messageQueue = [];
    sessionContexts = new Map();
    policyEngine;
    messageBus;
    telemetry;
    scheduler;
    constructor() {
        this.policyEngine = (0, PolicyEngine_js_1.getPolicyEngine)();
        this.messageBus = (0, NATSMessageBus_js_1.getNATSMessageBus)();
        this.telemetry = (0, TelemetryManager_js_1.getTelemetryManager)();
        this.scheduler = (0, DAGTaskScheduler_js_1.getDAGTaskScheduler)();
    }
    register(agent) {
        const name = agent.getName();
        if (this.agents.has(name)) {
            throw new Error(`Agent with name "${name}" already registered`);
        }
        this.agents.set(name, agent);
    }
    getAgent(name) {
        return this.agents.get(name);
    }
    listAgents() {
        return Array.from(this.agents.keys());
    }
    async getSessionContext(sessionId, workspace, description, agentType) {
        if (!this.sessionContexts.has(sessionId)) {
            const ctx = await (0, runtime_integration_js_1.initSessionContext)(sessionId, workspace, description || 'General task', agentType || 'general');
            this.sessionContexts.set(sessionId, ctx);
        }
        return this.sessionContexts.get(sessionId);
    }
    async execute(agentName, context, input) {
        const startTime = Date.now();
        // Initialize runtime context
        let sessionCtx;
        try {
            sessionCtx = await this.getSessionContext(context.sessionId, context.workspace, context.description || '', agentName);
        }
        catch (e) {
            this.telemetry.recordEvent('session_init_failed', { agent: agentName, sessionId: context.sessionId, error: e.message });
            return { success: false, error: `Session initialization failed: ${e.message}`, metadata: { session_init_error: true } };
        }
        // Prepare task with skill injection
        let preparedDescription;
        try {
            const prep = await (0, runtime_integration_js_1.prepareTaskExecution)(context.sessionId, context.description || '');
            preparedDescription = prep.preparedDescription;
        }
        catch (e) {
            this.telemetry.recordEvent('task_prep_failed', { agent: agentName, sessionId: context.sessionId, error: e.message });
            return { success: false, error: `Task preparation failed: ${e.message}`, metadata: { task_prep_error: true } };
        }
        const enrichedContext = { ...context, description: preparedDescription };
        // Policy check
        const policyCheck = await this.policyEngine.evaluate({
            agentId: context.sessionId,
            action: 'agent.execute',
            resource: `agent:${agentName}`,
            capabilities: ['agent:execute'],
            timestamp: Date.now(),
            subject: context.sessionId,
            sessionId: context.sessionId,
            taskId: context.taskId,
            agent_type: agentName
        });
        if (!policyCheck.allowed) {
            this.telemetry.recordEvent('policy_violation', { agent: agentName, sessionId: context.sessionId, reason: policyCheck.reason });
            return { success: false, error: `Policy violation: ${policyCheck.reason}`, metadata: { policy_violation: true } };
        }
        const agent = this.agents.get(agentName);
        if (!agent) {
            return { success: false, error: `Agent "${agentName}" not found` };
        }
        if (agent.isBusy()) {
            this.sendMessage({ from: 'orchestrator', to: agentName, type: 'request', payload: { context: enrichedContext, input, queued: true }, timestamp: Date.now() });
            return { success: false, error: `Agent "${agentName}" is currently busy, task queued`, metadata: { queued: true } };
        }
        try {
            const result = await (0, runtime_integration_js_1.executeWithHealing)(context.sessionId, async () => {
                this.telemetry.recordEvent('agent_execution_start', { agent: agentName, sessionId: context.sessionId, taskId: context.taskId });
                const result = await agent.execute(enrichedContext, input);
                const duration = Date.now() - startTime;
                result.duration = duration;
                this.telemetry.recordEvent('agent_execution_complete', { agent: agentName, sessionId: context.sessionId, success: result.success, duration });
                await this.messageBus.publish('agent.results', { agent: agentName, result, timestamp: Date.now() });
                return result;
            }, 3);
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.telemetry.recordEvent('agent_execution_error', { agent: agentName, sessionId: context.sessionId, error: error instanceof Error ? error.message : 'Unknown error', duration, healing_exhausted: true });
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error', duration, metadata: { healing_attempts_exhausted: true } };
        }
        finally {
            await (0, runtime_integration_js_1.cleanupSession)(context.sessionId).catch(e => {
                this.telemetry.recordEvent('session_cleanup_failed', { sessionId: context.sessionId, error: e.message });
            });
        }
    }
    async executeSwarm(config, context, input) {
        this.telemetry.recordEvent('swarm_execution_start', { swarmConfig: config, sessionId: context.sessionId, taskId: context.taskId });
        if (config.orchestration === 'parallel') {
            const results = await Promise.all(config.agents.map(agentName => this.execute(agentName, context, input)));
            this.telemetry.recordEvent('swarm_execution_complete', { sessionId: context.sessionId, resultsCount: results.length, successCount: results.filter(r => r.success).length });
            return results;
        }
        else if (config.orchestration === 'sequential') {
            const results = [];
            let currentInput = input;
            for (const agentName of config.agents) {
                const result = await this.execute(agentName, context, currentInput);
                results.push(result);
                if (result.success && result.data !== undefined)
                    currentInput = result.data;
            }
            this.telemetry.recordEvent('swarm_execution_complete', { sessionId: context.sessionId, resultsCount: results.length, successCount: results.filter(r => r.success).length });
            return results;
        }
        else {
            const results = await this.executeDynamic(config, context, input);
            this.telemetry.recordEvent('swarm_execution_complete', { sessionId: context.sessionId, resultsCount: results.length, successCount: results.filter(r => r.success).length });
            return results;
        }
    }
    async executeDynamic(config, context, input) {
        const results = [];
        for (const agentName of config.agents) {
            const agent = this.agents.get(agentName);
            if (agent && !agent.isBusy()) {
                const result = await this.execute(agentName, context, input);
                results.push(result);
            }
        }
        return results;
    }
    sendMessage(message) {
        this.messageQueue.push(message);
        this.messageBus.publish('agent.messages', message).catch(console.error);
    }
    processMessages() {
        const processed = [...this.messageQueue];
        this.messageQueue = [];
        return processed;
    }
    getStatus() {
        const agentStats = Array.from(this.agents.values()).map(a => ({ name: a.getName(), busy: a.isBusy(), currentTask: a.getCurrentTaskId() }));
        return {
            totalAgents: this.agents.size,
            activeAgents: agentStats.filter(a => a.busy).length,
            pendingMessages: this.messageQueue.length,
            activeSessions: this.sessionContexts.size,
            agents: agentStats,
            messageBusStats: this.messageBus.getStats(),
            telemetryEnabled: this.telemetry.isEnabled()
        };
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
//# sourceMappingURL=AgentOrchestrator.js.map