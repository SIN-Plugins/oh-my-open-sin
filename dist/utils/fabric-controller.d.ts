#!/usr/bin/env tsx
export interface TempleMeta {
    id: string;
    goal: string;
    phase: "plan" | "execution" | "test";
    status: "active" | "paused" | "completed" | "failed";
    budget_allocated_usd: number;
    budget_consumed_usd: number;
    risk_score: number;
    priority: number;
    health: number;
    nodes_total: number;
    nodes_completed: number;
    ts: number;
}
export interface FabricState {
    temples: Record<string, TempleMeta>;
    global_budget_usd: number;
    budget_consumed_usd: number;
    active_concurrency: number;
    max_concurrency: number;
    proxy_latency_ms: number;
    last_optimization_ts: number;
}
export declare function safeRun(cmd: string, cwd?: string): {
    ok: boolean;
    out: string;
    err?: string;
};
export declare function loadFabricState(): Promise<FabricState>;
export declare function saveFabricState(state: FabricState): Promise<void>;
export declare class BudgetAllocator {
    static allocate(templeId: string, phase: string, complexity: "low" | "medium" | "high", state: FabricState): Promise<number>;
    static rebalance(state: FabricState): Promise<void>;
}
export declare class RiskController {
    static score(complexity: string, securityScope: boolean, verificationHistory: number, agentHealth: number): number;
    static enforceGate(templeId: string, risk: number, state: FabricState): Promise<"allow" | "throttle" | "block">;
}
export declare class PortfolioScheduler {
    static dispatchQueue(state: FabricState): Promise<string[]>;
    static reapStale(state: FabricState): Promise<number>;
}
export declare class CrossTempleRouter {
    static routeHandoff(fromTemple: string, toTemple: string, payload: any, state: FabricState): Promise<{
        valid: boolean;
        routed: boolean;
    }>;
}
export declare function runFabricController(cmd: string, args: string[]): Promise<void>;
//# sourceMappingURL=fabric-controller.d.ts.map