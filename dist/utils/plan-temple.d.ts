export interface TempleNode {
    id: string;
    phase: string;
    agent_role: string;
    description: string;
    dependencies: string[];
    constraints: {
        max_tokens?: number;
        timeout_sec?: number;
        budget_pct?: number;
        risk_level?: "low" | "medium" | "high";
    };
    parallel_group?: string;
    verification_gate?: {
        type: string;
        threshold: number;
    };
    status: "pending" | "running" | "completed" | "failed" | "blocked";
}
export interface PlanTemple {
    id: string;
    goal: string;
    nodes: TempleNode[];
    hypergraph: Record<string, string[]>;
    resource_map: Record<string, {
        max_concurrency: number;
        budget_allocation_pct: number;
    }>;
    ts: number;
}
export declare function generatePlanTemple(goal: string, context: string, config: any): Promise<PlanTemple>;
export declare function resolveNextNodes(templeId: string, completedNodeId: string): Promise<TempleNode[]>;
//# sourceMappingURL=plan-temple.d.ts.map