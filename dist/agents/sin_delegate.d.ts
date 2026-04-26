import { SubAgent } from '../core/SubAgent.js';
import { TaskContext, SubAgentResult } from '../types/index.js';
/**
 * sin_delegate - Delegates tasks to appropriate subagents
 * Acts as a router and task dispatcher with enterprise features:
 * - Policy-based routing decisions
 * - Telemetry tracking for routing metrics
 * - Session-aware load balancing
 * - Zero-Trust delegation
 */
export declare class SinDelegate extends SubAgent {
    private policyEngine;
    private telemetry;
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private analyzeTask;
    /**
     * Get routing statistics from telemetry
     */
    getRoutingStats(): any;
}
//# sourceMappingURL=sin_delegate.d.ts.map