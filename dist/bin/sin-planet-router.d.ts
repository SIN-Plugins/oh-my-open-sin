#!/usr/bin/env tsx
interface RouteDecision {
    target_planet: string;
    status: "allow" | "throttle" | "reroute" | "block";
    reason: string;
    budget_allocated: number;
    risk_score: number;
    confidence: number;
}
export interface GravityPolicy {
    allowed_domains: string[];
    max_budget_pct: number;
    max_risk_score: number;
    require_hmac: boolean;
    network_scope: "allow" | "deny";
    exec_scope: "sandbox" | "none";
}
export interface RouteDecisionExport extends RouteDecision {
}
export declare function analyzeDomain(description: string, context: string): {
    domain: string;
    confidence: number;
};
export declare function evaluateConstraints(domain: string, state: any): Promise<RouteDecision>;
export declare function enforceGravityPolicy(domain: string, payload: any, policy: GravityPolicy): {
    valid: boolean;
    reason?: string;
};
export declare function dispatchCrossPlanet(taskId: string, domain: string, description: string, budget: number, state: any): Promise<{
    dispatched: boolean;
    session_id?: string;
    error?: string;
}>;
export {};
//# sourceMappingURL=sin-planet-router.d.ts.map