export interface AgentScore {
    agent: string;
    model: string;
    total_score: number;
    breakdown: {
        intent_match: number;
        complexity_fit: number;
        health_score: number;
        budget_penalty: number;
        history_success: number;
    };
    fallback_reason?: string;
}
export declare function scoreAgents(intent: string, complexity: "low" | "medium" | "high", layer: string, budget_pct: number, config: any, breakerStates: Record<string, boolean>): Promise<AgentScore[]>;
//# sourceMappingURL=agent-scorer.d.ts.map