#!/usr/bin/env tsx
interface ClusterHealth {
    id: string;
    domain: string;
    health: number;
    latency_ms: number;
    error_rate: number;
    budget_consumed_pct: number;
    active_tasks: number;
    status: "healthy" | "degraded" | "critical" | "offline";
}
interface ConsensusVote {
    cluster_id: string;
    decision: string;
    confidence: number;
    ts: number;
}
interface TelemetryAggregate {
    total_tokens: number;
    total_cost_usd: number;
    avg_health: number;
    avg_latency_ms: number;
    error_rate: number;
    budget_remaining_pct: number;
    ts: number;
}
interface RoutingDecision {
    target_cluster: string;
    score: number;
    status: "allow" | "throttle" | "reroute" | "block";
    reason: string;
    budget_allocated: number;
}
interface FallbackPlan {
    triggered: boolean;
    reason: string;
    action: "scope_reduce" | "model_downgrade" | "emergency_consensus" | "sub_galaxy_spawn";
    ts: number;
}
export declare function aggregateTelemetry(): Promise<TelemetryAggregate>;
export declare function macroConsensus(topic: string, votes: ConsensusVote[], quorumThreshold?: number, minConfidence?: number): Promise<{
    agreed: boolean;
    decision: string;
    confidence: number;
    reason: string;
}>;
export declare function gravitationalRoute(clusters: ClusterHealth[], taskDomain: string, budgetAvailable: number, policy: {
    max_risk: number;
    require_hmac: boolean;
}): Promise<RoutingDecision>;
export declare function supernovaFallback(state: any, telemetry: TelemetryAggregate, criticalThresholds: {
    budget_pct: number;
    health: number;
    latency_ms: number;
}): Promise<FallbackPlan>;
export {};
//# sourceMappingURL=sin-galaxy-core.d.ts.map