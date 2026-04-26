"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinDelegate = void 0;
const SubAgent_js_1 = require("../core/SubAgent.js");
const PolicyEngine_js_1 = require("../core/PolicyEngine.js");
const TelemetryManager_js_1 = require("../core/TelemetryManager.js");
/**
 * sin_delegate - Delegates tasks to appropriate subagents
 * Acts as a router and task dispatcher with enterprise features:
 * - Policy-based routing decisions
 * - Telemetry tracking for routing metrics
 * - Session-aware load balancing
 * - Zero-Trust delegation
 */
class SinDelegate extends SubAgent_js_1.SubAgent {
    policyEngine;
    telemetry;
    constructor() {
        super({
            name: 'sin_delegate',
            description: 'Delegates and routes tasks to appropriate subagents with policy enforcement',
            capabilities: ['task-routing', 'delegation', 'load-balancing', 'policy-enforcement'],
            priority: 1,
        });
        this.policyEngine = (0, PolicyEngine_js_1.getPolicyEngine)();
        this.telemetry = (0, TelemetryManager_js_1.getTelemetryManager)();
    }
    async execute(context, input) {
        return this.trackExecution(context.taskId, async () => {
            if (!this.validateInput(input)) {
                this.telemetry.recordEvent('delegate_invalid_input', {
                    sessionId: context.sessionId,
                    taskId: context.taskId
                });
                return this.error('Invalid input for delegation');
            }
            const task = input;
            // Policy check for delegation
            const policyCheck = await this.policyEngine.evaluate({
                action: 'delegate.route',
                resource: `task:${context.taskId}`,
                subject: context.sessionId,
                context: { taskType: task.type, workspace: context.workspace }
            });
            if (!policyCheck.allowed) {
                this.telemetry.recordEvent('delegate_policy_violation', {
                    sessionId: context.sessionId,
                    taskId: context.taskId,
                    reason: policyCheck.reason
                });
                return this.error(`Delegation blocked by policy: ${policyCheck.reason}`, {
                    policy_violation: true
                });
            }
            // Analyze task and route appropriately
            const startTime = Date.now();
            const routing = this.analyzeTask(task);
            const duration = Date.now() - startTime;
            // Record routing decision
            this.telemetry.recordEvent('delegate_routing_decision', {
                sessionId: context.sessionId,
                taskId: context.taskId,
                targetType: routing.targetType,
                confidence: routing.confidence,
                suggestedAgents: routing.suggestedAgents,
                duration
            });
            return this.success({
                routed: true,
                targetType: routing.targetType,
                confidence: routing.confidence,
                suggestedAgents: routing.suggestedAgents,
                policyApproved: true
            }, {
                taskId: context.taskId,
                sessionId: context.sessionId,
                routingDuration: duration
            });
        });
    }
    analyzeTask(task) {
        const type = task.type?.toLowerCase() || '';
        if (type.includes('git') || type.includes('commit') || type.includes('branch')) {
            return {
                targetType: 'git',
                confidence: 0.95,
                suggestedAgents: ['sin_git_orchestrator', 'sin_git_conflict_resolver', 'sin_git_policy_enforcer'],
            };
        }
        if (type.includes('health') || type.includes('monitor') || type.includes('telemetry')) {
            return {
                targetType: 'health',
                confidence: 0.9,
                suggestedAgents: ['sin_health_server', 'sin_monitor', 'telemetry_manager'],
            };
        }
        if (type.includes('edit') || type.includes('modify')) {
            return {
                targetType: 'edit',
                confidence: 0.85,
                suggestedAgents: ['sin_hash_edit'],
            };
        }
        if (type.includes('research') || type.includes('analyze')) {
            return {
                targetType: 'research',
                confidence: 0.88,
                suggestedAgents: ['athena', 'argus', 'daedalus'],
            };
        }
        if (type.includes('plan') || type.includes('strategy')) {
            return {
                targetType: 'planning',
                confidence: 0.87,
                suggestedAgents: ['prometheus', 'metis', 'themis'],
            };
        }
        if (type.includes('validate') || type.includes('verify') || type.includes('test')) {
            return {
                targetType: 'validation',
                confidence: 0.92,
                suggestedAgents: ['zeus', 'aegis', 'hephaestus'],
            };
        }
        if (type.includes('execute') || type.includes('deploy') || type.includes('run')) {
            return {
                targetType: 'execution',
                confidence: 0.89,
                suggestedAgents: ['atlas', 'iris', 'janus'],
            };
        }
        return {
            targetType: 'general',
            confidence: 0.5,
            suggestedAgents: ['sin_swarm'],
        };
    }
    /**
     * Get routing statistics from telemetry
     */
    getRoutingStats() {
        return {
            agentName: this.getName(),
            capabilities: this.getCapabilities(),
            description: this.getDescription()
        };
    }
}
exports.SinDelegate = SinDelegate;
//# sourceMappingURL=sin_delegate.js.map