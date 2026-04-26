import { SubAgent } from '../core/SubAgent.js';
import { TaskContext, SubAgentResult, SwarmConfig } from '../types/index.js';
/**
 * sin_swarm - Coordinates swarm-based task execution with enterprise features
 * Manages parallel and sequential agent collaboration with:
 * - Policy enforcement for swarm creation
 * - Telemetry tracking for swarm metrics
 * - DAG-based task scheduling
 * - NATS messaging for cross-swarm communication
 * - Self-healing capabilities
 */
export declare class SinSwarm extends SubAgent {
    private activeSwarms;
    private policyEngine;
    private telemetry;
    private scheduler;
    private messageBus;
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    /**
     * Create a DAG-based swarm with task dependencies
     */
    createDagSwarm(context: TaskContext, agents: string[], dependencies: Array<{
        from: string;
        to: string;
    }>): Promise<SubAgentResult>;
    getActiveSwarms(): string[];
    getSwarmConfig(name: string): SwarmConfig | undefined;
    /**
     * Get swarm statistics
     */
    getSwarmStats(): any;
}
//# sourceMappingURL=sin_swarm.d.ts.map