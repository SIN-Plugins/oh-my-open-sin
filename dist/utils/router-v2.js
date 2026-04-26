"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeTaskV2 = routeTaskV2;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const ast_scanner_1 = require("./ast-scanner");
const intent_classifier_1 = require("./intent-classifier");
const agent_scorer_1 = require("./agent-scorer");
const telemetry_1 = require("./telemetry");
const CACHE_FILE = path_1.default.join(process.cwd(), ".opencode", "route-cache-v2.json");
const CACHE_TTL_MS = 20 * 60 * 1000;
async function getContentHash(paths) {
    const hash = (0, crypto_1.createHash)("sha256");
    for (const p of paths) {
        try {
            const stat = await promises_1.default.stat(p);
            hash.update(`${p}:${stat.mtimeMs}`);
        }
        catch { }
    }
    return hash.digest("hex").slice(0, 12);
}
async function routeTaskV2(opts) {
    const safePaths = opts.target_paths?.length ? opts.target_paths : [process.cwd()];
    const contentHash = await getContentHash(safePaths);
    const cacheKey = `${contentHash}|${opts.description.slice(0, 60)}`;
    // Cache check
    try {
        const raw = await promises_1.default.readFile(CACHE_FILE, "utf-8").catch(() => "{}");
        const cache = JSON.parse(raw);
        const entry = cache[cacheKey];
        if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
            entry.decision.cache_hit = true;
            return entry.decision;
        }
    }
    catch { }
    // 1. AST Scan
    const metrics = await (0, ast_scanner_1.scanPaths)(safePaths);
    // 2. Intent Classification
    const intent = (0, intent_classifier_1.classifyIntent)(opts.description);
    // 3. Multi-Layer Detection
    const layers = new Set();
    if (metrics.hasUI)
        layers.add("frontend");
    if (metrics.hasDB)
        layers.add("database");
    if (metrics.layer === "backend")
        layers.add("backend");
    const multi_layer_split = layers.size > 1;
    // 4. Agent Scoring
    const scores = await (0, agent_scorer_1.scoreAgents)(intent.category, metrics.complexity, metrics.layer, opts.budget_pct, opts.config, opts.breakerStates);
    const best = scores[0];
    // 5. Coordinator Override for Multi-Layer
    let finalAgent = best.agent;
    let finalModel = best.model;
    let finalCategory = opts.config.agents?.[best.agent]?.category || "quick";
    let fallbackReason = best.fallback_reason;
    if (multi_layer_split && !["prometheus", "hermes"].includes(best.agent)) {
        finalAgent = "hermes";
        finalModel = opts.config.agents?.hermes?.models?.[0] || "openai/gpt-5.4-mini-fast";
        finalCategory = "quick";
        fallbackReason = "Multi-layer task detected. Routed to coordinator for split/dispatch.";
        (0, telemetry_1.structuredLog)("info", "routing_coordinator_override", { layers: Array.from(layers), coordinator: finalAgent });
    }
    const decision = {
        agent: finalAgent,
        model: finalModel,
        category: finalCategory,
        intent: intent.category,
        metrics,
        scores,
        fallback_reason: fallbackReason,
        cache_hit: false,
        multi_layer_split
    };
    // Cache write
    try {
        const raw = await promises_1.default.readFile(CACHE_FILE, "utf-8").catch(() => "{}");
        const cache = JSON.parse(raw);
        cache[cacheKey] = { decision, ts: Date.now() };
        await promises_1.default.mkdir(path_1.default.dirname(CACHE_FILE), { recursive: true });
        await promises_1.default.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
    }
    catch { }
    (0, telemetry_1.structuredLog)("info", "routing_decision_v2", {
        agent: decision.agent,
        model: decision.model,
        intent: decision.intent,
        complexity: metrics.complexity,
        budget_pct: opts.budget_pct,
        multi_layer: decision.multi_layer_split,
        top_score: decision.scores[0]?.total_score,
        fallback: decision.fallback_reason || "none"
    });
    return decision;
}
//# sourceMappingURL=router-v2.js.map