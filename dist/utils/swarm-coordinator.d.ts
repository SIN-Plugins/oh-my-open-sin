export interface SwarmHealth {
    agent: string;
    score: number;
    latency_ms: number;
    error_rate: number;
    budget_consumed_pct: number;
    status: "healthy" | "degraded" | "critical";
}
export interface ConsensusVote {
    agent: string;
    decision: string;
    confidence: number;
    ts: number;
}
export declare function updateSwarmHealth(sessionId: string, agent: string, metrics: Partial<SwarmHealth>): void;
export declare function rebalanceSwarm(sessionId: string, failedAgent: string, availableAgents: string[]): Promise<string | null>;
export declare function castConsensusVote(sessionId: string, agent: string, decision: string, confidence: number): void;
export declare function getConsensus(sessionId: string, minConfidence?: number): {
    decision: string;
    confidence: number;
    agreed: boolean;
};
export declare function startDeadlockGuard(sessionId: string, timeoutMs: number | undefined, onDeadlock: () => void): void;
export declare function clearDeadlockGuard(sessionId: string): void;
//# sourceMappingURL=swarm-coordinator.d.ts.map