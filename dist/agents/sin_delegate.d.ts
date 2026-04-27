import { SubAgent } from '../core/SubAgent.js';
import { TaskContext, SubAgentResult } from '../types/index.js';
/**
 * sin_delegate - Delegates tasks to appropriate subagents
 * Acts as a router and task dispatcher with enterprise features:
 * - Policy-based routing decisions
 * - Telemetry tracking for routing metrics
 * - Session-aware load balancing
 * - Zero-Trust delegation
 * - Context-Aware AST-based routing
 * - Feedback loop for continuous improvement
 */
export declare class SinDelegate extends SubAgent {
    private policyEngine;
    private telemetry;
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    /**
     * Context-aware routing using AST analysis
     */
    private analyzeWithContext;
    /**
     * Legacy task analysis based on keywords
     */
    private analyzeTask;
    /**
     * Report task completion for feedback loop
     */
    reportTaskCompletion(taskId: string, sessionId: string, agentId: string, success: boolean): Promise<void>;
    /**
     * Get routing statistics from telemetry
     */
    getRoutingStats(): any;
}
//# sourceMappingURL=sin_delegate.d.ts.map