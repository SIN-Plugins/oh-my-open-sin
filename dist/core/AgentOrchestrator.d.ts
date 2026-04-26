import { SubAgent } from './SubAgent.js';
import { TaskContext, SubAgentResult, AgentMessage, SwarmConfig } from '../types/index.js';
/**
 * Orchestrates multiple subagents and manages task routing
 * Implements non-blocking, session-aware execution with enterprise features:
 * - Policy enforcement (Zero-Trust)
 * - Cryptographic provenance (Sigstore)
 * - Cross-swarm messaging (NATS)
 * - Telemetry & SLO monitoring
 * - DAG-based parallel orchestration
 */
export declare class AgentOrchestrator {
    private agents;
    private messageQueue;
    private sessionContexts;
    private policyEngine;
    private messageBus;
    private telemetry;
    private scheduler;
    constructor();
    /**
     * Register a subagent
     */
    register(agent: SubAgent): void;
    /**
     * Get a registered agent by name
     */
    getAgent(name: string): SubAgent | undefined;
    /**
     * List all registered agents
     */
    listAgents(): string[];
    /**
     * Create or get a session context
     */
    getSessionContext(sessionId: string, workspace: string): TaskContext;
    /**
     * Execute a task with a specific agent
     * Includes policy enforcement, telemetry tracking, and audit logging
     */
    execute(agentName: string, context: TaskContext, input: unknown): Promise<SubAgentResult>;
    /**
     * Execute a swarm of agents with DAG-based scheduling
     */
    executeSwarm(config: SwarmConfig, context: TaskContext, input: unknown): Promise<SubAgentResult[]>;
    private executeDynamic;
    /**
     * Send a message between agents
     */
    sendMessage(message: AgentMessage): void;
    /**
     * Process pending messages
     */
    processMessages(): AgentMessage[];
    /**
     * Get orchestrator status with enterprise metrics
     */
    getStatus(): {
        totalAgents: number;
        activeAgents: number;
        pendingMessages: number;
        activeSessions: number;
        agents: {
            name: string;
            busy: boolean;
            currentTask: string | undefined;
        }[];
        messageBusStats: import("./NATSMessageBus.js").MessageStats;
        telemetryEnabled: boolean;
    };
}
//# sourceMappingURL=AgentOrchestrator.d.ts.map