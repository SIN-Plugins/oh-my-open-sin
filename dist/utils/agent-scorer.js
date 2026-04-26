"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreAgents = scoreAgents;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const telemetry_1 = require("./telemetry");
const WEIGHTS_PATH = path_1.default.join(process.cwd(), ".opencode", "routing-weights.json");
async function loadWeights() {
    try {
        const raw = await promises_1.default.readFile(WEIGHTS_PATH, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
async function scoreAgents(intent, complexity, layer, budget_pct, config, breakerStates // agent -> healthy
) {
    const agents = config.agents || {};
    const weights = await loadWeights();
    const scores = [];
    for (const [agentId, cfg] of Object.entries(agents)) {
        const aCfg = cfg;
        const category = aCfg.category || "quick";
        const model = aCfg.models?.[0] || "openai/gpt-5.4-mini-fast";
        // 1. Intent Match
        let intent_match = 0;
        if (intent === "architecture" && category === "ultrabrain")
            intent_match = 3;
        else if (intent === "security" && ["deep", "ultrabrain"].includes(category))
            intent_match = 3;
        else if (intent === "frontend" && category === "visual-engineering")
            intent_match = 3;
        else if (intent === "backend" && category === "deep")
            intent_match = 3;
        else if (intent === "database" && category === "deep")
            intent_match = 3;
        else if (intent === "quick_fix" && category === "quick")
            intent_match = 3;
        else if (intent === "research" && category === "quick")
            intent_match = 2;
        else
            intent_match = 1;
        // 2. Complexity Fit
        let complexity_fit = 0;
        if (complexity === "high" && category === "ultrabrain")
            complexity_fit = 3;
        else if (complexity === "medium" && ["deep", "ultrabrain"].includes(category))
            complexity_fit = 2;
        else if (complexity === "low" && category === "quick")
            complexity_fit = 3;
        else
            complexity_fit = 1;
        // 3. Health Score (Circuit Breaker + Telemetry)
        const healthy = breakerStates[agentId] !== false;
        const history_success = weights[agentId] ?? 0.7; // default 70% success
        const health_score = healthy ? 3 : 0;
        // 4. Budget Penalty
        let budget_penalty = 0;
        if (budget_pct >= 100 && category !== "quick")
            budget_penalty = -5;
        else if (budget_pct >= 80 && category === "ultrabrain")
            budget_penalty = -3;
        else if (budget_pct >= 80 && category === "deep")
            budget_penalty = -1;
        const total = intent_match + complexity_fit + health_score + (history_success * 2) + budget_penalty;
        scores.push({
            agent: agentId,
            model,
            total_score: total,
            breakdown: { intent_match, complexity_fit, health_score, budget_penalty, history_success }
        });
    }
    // Sort descending
    scores.sort((a, b) => b.total_score - a.total_score);
    // Apply dynamic fallback if top is unhealthy or budget-blocked
    if (scores.length > 0) {
        const top = scores[0];
        if (top.breakdown.health_score === 0 || top.breakdown.budget_penalty <= -3) {
            const fallback = scores.find(s => s.breakdown.health_score > 0 && s.breakdown.budget_penalty > -3);
            if (fallback) {
                fallback.fallback_reason = `Primary ${top.agent} degraded/budget-blocked. Auto-routed.`;
                (0, telemetry_1.structuredLog)("warn", "routing_fallback_triggered", { primary: top.agent, fallback: fallback.agent, reason: fallback.fallback_reason });
                // Move fallback to top
                scores.splice(scores.indexOf(fallback), 1);
                scores.unshift(fallback);
            }
        }
    }
    return scores;
}
//# sourceMappingURL=agent-scorer.js.map