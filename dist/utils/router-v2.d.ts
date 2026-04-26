import { CodeMetrics } from "./ast-scanner";
import { IntentCategory } from "./intent-classifier";
import { AgentScore } from "./agent-scorer";
export interface RoutingDecisionV2 {
    agent: string;
    model: string;
    category: string;
    intent: IntentCategory;
    metrics: CodeMetrics;
    scores: AgentScore[];
    fallback_reason?: string;
    cache_hit: boolean;
    multi_layer_split: boolean;
}
export declare function routeTaskV2(opts: {
    description: string;
    target_paths?: string[];
    budget_pct: number;
    breakerStates: Record<string, boolean>;
    config: any;
}): Promise<RoutingDecisionV2>;
//# sourceMappingURL=router-v2.d.ts.map