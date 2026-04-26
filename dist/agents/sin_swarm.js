"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinSwarm = void 0;
const SubAgent_js_1 = require("../core/SubAgent.js");
const PolicyEngine_js_1 = require("../core/PolicyEngine.js");
const TelemetryManager_js_1 = require("../core/TelemetryManager.js");
const DAGTaskScheduler_js_1 = require("../core/DAGTaskScheduler.js");
const NATSMessageBus_js_1 = require("../core/NATSMessageBus.js");
/**
 * sin_swarm - Coordinates swarm-based task execution with enterprise features
 * Manages parallel and sequential agent collaboration with:
 * - Policy enforcement for swarm creation
 * - Telemetry tracking for swarm metrics
 * - DAG-based task scheduling
 * - NATS messaging for cross-swarm communication
 * - Self-healing capabilities
 */
class SinSwarm extends SubAgent_js_1.SubAgent {
    activeSwarms = new Map();
    policyEngine;
    telemetry;
    scheduler;
    messageBus;
    constructor() {
        super({
            name: 'sin_swarm',
            description: 'Coordinates swarm-based multi-agent collaboration with enterprise governance',
            capabilities: ['swarm-orchestration', 'parallel-execution', 'collaborative-tasks', 'dag-scheduling', 'policy-enforcement'],
            priority: 2,
        });
        this.policyEngine = (0, PolicyEngine_js_1.getPolicyEngine)();
        this.telemetry = (0, TelemetryManager_js_1.getTelemetryManager)();
        this.scheduler = (0, DAGTaskScheduler_js_1.getDAGTaskScheduler)();
        this.messageBus = (0, NATSMessageBus_js_1.getNATSMessageBus)();
    }
    async execute(context, input) {
        return this.trackExecution(context.taskId, async () => {
            if (!this.validateInput(input)) {
                this.telemetry.recordEvent('swarm_invalid_input', {
                    sessionId: context.sessionId,
                    taskId: context.taskId
                });
                return this.error('Invalid input for swarm execution');
            }
            const swarmRequest = input;
            // Policy check for swarm creation
            const policyCheck = await this.policyEngine.evaluate({
                action: 'swarm.create',
                resource: `swarm:${swarmRequest.name || context.taskId}`,
                subject: context.sessionId,
                context: {
                    agentCount: swarmRequest.agents?.length || 0,
                    orchestration: swarmRequest.orchestration,
                    workspace: context.workspace
                }
            });
            if (!policyCheck.allowed) {
                this.telemetry.recordEvent('swarm_policy_violation', {
                    sessionId: context.sessionId,
                    taskId: context.taskId,
                    reason: policyCheck.reason
                });
                return this.error(`Swarm creation blocked by policy: ${policyCheck.reason}`, {
                    policy_violation: true
                });
            }
            const config = {
                name: swarmRequest.name || `swarm-${context.taskId}`,
                agents: swarmRequest.agents || [],
                orchestration: swarmRequest.orchestration || 'dynamic',
            };
            if (config.agents.length === 0) {
                this.telemetry.recordEvent('swarm_no_agents', {
                    sessionId: context.sessionId,
                    taskId: context.taskId
                });
                return this.error('No agents specified for swarm');
            }
            const startTime = Date.now();
            this.activeSwarms.set(config.name, config);
            try {
                // Record swarm creation
                this.telemetry.recordEvent('swarm_created', {
                    swarmId: config.name,
                    sessionId: context.sessionId,
                    taskId: context.taskId,
                    agentCount: config.agents.length,
                    orchestration: config.orchestration
                });
                // Publish swarm creation to message bus
                await this.messageBus.publish('swarm.events', {
                    type: 'swarm_created',
                    swarmId: config.name,
                    config,
                    timestamp: Date.now()
                });
                const duration = Date.now() - startTime;
                // Return swarm configuration ready for execution by orchestrator
                return this.success({
                    swarmId: config.name,
                    configured: true,
                    agentCount: config.agents.length,
                    orchestration: config.orchestration,
                    ready: true,
                    policyApproved: true,
                    duration
                }, {
                    taskId: context.taskId,
                    sessionId: context.sessionId,
                    swarmCreationDuration: duration
                });
            }
            catch (error) {
                this.telemetry.recordEvent('swarm_creation_error', {
                    swarmId: config.name,
                    sessionId: context.sessionId,
                    taskId: context.taskId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                throw error;
            }
            finally {
                this.activeSwarms.delete(config.name);
            }
        });
    }
    /**
     * Create a DAG-based swarm with task dependencies
     */
    async createDagSwarm(context, agents, dependencies) {
        const startTime = Date.now();
        try {
            // Schedule tasks with DAG
            const scheduleResult = await this.scheduler.schedule(agents.map((agent, idx) => ({
                id: `task-${agent}-${idx}`,
                name: agent,
                dependencies: dependencies
                    .filter(d => d.to === agent)
                    .map(d => `task-${d.from}-${agents.indexOf(d.from)}`),
                priority: 'normal',
                payload: { agent, context }
            })));
            const duration = Date.now() - startTime;
            this.telemetry.recordEvent('swarm_dag_scheduled', {
                sessionId: context.sessionId,
                taskId: context.taskId,
                taskCount: agents.length,
                dependencyCount: dependencies.length,
                duration
            });
            return this.success({
                scheduled: true,
                taskId: scheduleResult.executionId,
                taskCount: agents.length,
                parallelGroups: scheduleResult.parallelGroups.length,
                estimatedDuration: scheduleResult.estimatedDuration
            });
        }
        catch (error) {
            this.telemetry.recordEvent('swarm_dag_error', {
                sessionId: context.sessionId,
                taskId: context.taskId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return this.error(`DAG scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getActiveSwarms() {
        return Array.from(this.activeSwarms.keys());
    }
    getSwarmConfig(name) {
        return this.activeSwarms.get(name);
    }
    /**
     * Get swarm statistics
     */
    getSwarmStats() {
        return {
            activeSwarms: this.activeSwarms.size,
            schedulerStats: this.scheduler.getStats(),
            messageBusStats: this.messageBus.getStats()
        };
    }
}
exports.SinSwarm = SinSwarm;
//# sourceMappingURL=sin_swarm.js.map