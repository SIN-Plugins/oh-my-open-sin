import { SubAgent } from './SubAgent.js';
import { TaskContext, SubAgentResult, AgentMessage, SwarmConfig } from '../types/index.js';
import { type SessionContext } from '../utils/runtime-integration.js';
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
export declare class AgentOrchestrator {
    private agents;
    private messageQueue;
    private sessionContexts;
    private policyEngine;
    private messageBus;
    private telemetry;
    private scheduler;
    constructor();
    register(agent: SubAgent): void;
    getAgent(name: string): SubAgent | undefined;
    listAgents(): string[];
    getSessionContext(sessionId: string, workspace: string, description?: string, agentType?: string): Promise<SessionContext>;
    execute(agentName: string, context: TaskContext, input: unknown): Promise<SubAgentResult>;
    executeSwarm(config: SwarmConfig, context: TaskContext, input: unknown): Promise<SubAgentResult[]>;
    private executeDynamic;
    sendMessage(message: AgentMessage): void;
    processMessages(): AgentMessage[];
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