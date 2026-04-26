#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateTelemetry = aggregateTelemetry;
exports.macroConsensus = macroConsensus;
exports.gravitationalRoute = gravitationalRoute;
exports.supernovaFallback = supernovaFallback;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const child_process_1 = require("child_process");
// ─── PATHS & CONFIG ─────────────────────────────────────────────────────
const CFG_DIR = path_1.default.join(process.env.HOME || "", ".config", "opencode");
const LOCAL_DIR = path_1.default.join(process.cwd(), ".opencode");
const TELEMETRY_LOG = path_1.default.join(CFG_DIR, "logs", "telemetry.jsonl");
const FABRIC_STATE = path_1.default.join(LOCAL_DIR, "fabric-state.json");
const AUDIT_CHAIN = path_1.default.join(LOCAL_DIR, "audit-chain.jsonl");
const BLACKBOARD_DIR = path_1.default.join(LOCAL_DIR, "swarm-blackboard");
const HMAC_SECRET = process.env.SIN_HMAC_SECRET || "sin-galaxy-zero-trust";
// ─── HELPERS ────────────────────────────────────────────────────────────
function safeRun(cmd, cwd = process.cwd()) {
    try {
        return { ok: true, out: (0, child_process_1.execSync)(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 8000 }).trim() };
    }
    catch (e) {
        return { ok: false, out: "", err: e.stderr?.toString() || e.message };
    }
}
async function loadState() {
    try {
        return JSON.parse(await promises_1.default.readFile(FABRIC_STATE, "utf-8"));
    }
    catch {
        return { temples: {}, global_budget_usd: 50, budget_consumed_usd: 0, active_concurrency: 0, max_concurrency: 8 };
    }
}
async function appendAudit(entry) {
    const raw = await promises_1.default.readFile(AUDIT_CHAIN, "utf-8").catch(() => "");
    const lines = raw.split("\n").filter(Boolean);
    const parentHash = lines.length > 0 ? JSON.parse(lines[lines.length - 1]).merkle_hash : "genesis";
    const payloadHash = crypto_1.default.createHash("sha256").update(JSON.stringify(entry, Object.keys(entry).sort())).digest("hex");
    const merkleHash = crypto_1.default.createHash("sha256").update(`${parentHash}:${payloadHash}:${Date.now()}`).digest("hex");
    const hmac = crypto_1.default.createHmac("sha256", HMAC_SECRET);
    hmac.update(JSON.stringify({ ...entry, parent_hash: parentHash, payload_hash: payloadHash, ts: Date.now() }));
    const auditEntry = { ...entry, parent_hash: parentHash, payload_hash: payloadHash, merkle_hash: merkleHash, signature: hmac.digest("hex"), ts: Date.now() };
    await promises_1.default.appendFile(AUDIT_CHAIN, JSON.stringify(auditEntry) + "\n");
}
// ─── 1. CROSS-CLUSTER TELEMETRY AGGREGATOR ──────────────────────────────
async function aggregateTelemetry() {
    const raw = await promises_1.default.readFile(TELEMETRY_LOG, "utf-8").catch(() => "");
    const logs = raw.split("\n").filter(Boolean).map(l => { try {
        return JSON.parse(l);
    }
    catch {
        return null;
    } }).filter(Boolean);
    let tokens = 0, cost = 0, healthSum = 0, latencySum = 0, errors = 0, total = 0;
    const state = await loadState();
    for (const e of logs) {
        tokens += e.tokens || 0;
        cost += e.cost_usd || 0;
        if (e.health !== undefined) {
            healthSum += e.health;
            total++;
        }
        if (e.latency_ms !== undefined)
            latencySum += e.latency_ms;
        if (e.msg?.includes("error") || e.msg?.includes("fail"))
            errors++;
    }
    const budgetRemaining = Math.max(0, ((state.global_budget_usd - state.budget_consumed_usd) / state.global_budget_usd) * 100);
    return {
        total_tokens: tokens,
        total_cost_usd: parseFloat(cost.toFixed(4)),
        avg_health: total > 0 ? parseFloat((healthSum / total).toFixed(2)) : 0.8,
        avg_latency_ms: total > 0 ? Math.round(latencySum / total) : 0,
        error_rate: total > 0 ? parseFloat((errors / total).toFixed(2)) : 0,
        budget_remaining_pct: parseFloat(budgetRemaining.toFixed(1)),
        ts: Date.now()
    };
}
// ─── 2. MACRO-CONSENSUS ENGINE ──────────────────────────────────────────
async function macroConsensus(topic, votes, quorumThreshold = 0.6, minConfidence = 0.7) {
    if (votes.length === 0)
        return { agreed: false, decision: "none", confidence: 0, reason: "no_votes" };
    const weighted = {};
    for (const v of votes) {
        if (!weighted[v.decision])
            weighted[v.decision] = { confSum: 0, count: 0 };
        weighted[v.decision].confSum += v.confidence;
        weighted[v.decision].count++;
    }
    const sorted = Object.entries(weighted).sort((a, b) => b[1].confSum - a[1].confSum);
    const best = sorted[0];
    const avgConf = best[1].confSum / best[1].count;
    const voteShare = best[1].count / votes.length;
    const agreed = voteShare >= quorumThreshold && avgConf >= minConfidence;
    const reason = agreed ? "quorum_reached" : voteShare < quorumThreshold ? "quorum_failed" : "confidence_too_low";
    await appendAudit({ type: "macro_consensus", topic, votes: votes.length, decision: best[0], confidence: avgConf, agreed, reason });
    return { agreed, decision: best[0], confidence: parseFloat(avgConf.toFixed(2)), reason };
}
// ─── 3. GRAVITATIONAL POLICY ROUTER ─────────────────────────────────────
async function gravitationalRoute(clusters, taskDomain, budgetAvailable, policy) {
    const scored = clusters.map(c => {
        let score = 0;
        score += c.health * 40;
        score += Math.max(0, (1000 - c.latency_ms) / 1000) * 20;
        score += (1 - c.error_rate) * 20;
        score += (1 - c.budget_consumed_pct) * 10;
        score += c.domain === taskDomain ? 10 : 0;
        let status = "allow";
        let reason = "optimal_route";
        if (c.status === "critical" || c.error_rate > 0.4) {
            status = "block";
            reason = "cluster_critical";
        }
        else if (c.budget_consumed_pct > 0.85 || c.latency_ms > 800) {
            status = "throttle";
            reason = "resource_constrained";
        }
        else if (c.status === "degraded") {
            status = "reroute";
            reason = "cluster_degraded";
        }
        return { cluster: c.id, score, status, reason, budget: Math.max(2, budgetAvailable * 0.15) };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    await appendAudit({ type: "gravity_route", domain: taskDomain, target: best.cluster, score: best.score, status: best.status, reason: best.reason });
    return { target_cluster: best.cluster, score: best.score, status: best.status, reason: best.reason, budget_allocated: best.budget };
}
// ─── 4. SUPERNOVA FALLBACK ORCHESTRATOR ─────────────────────────────────
async function supernovaFallback(state, telemetry, criticalThresholds) {
    const budgetCritical = telemetry.budget_remaining_pct < (100 - criticalThresholds.budget_pct);
    const healthCritical = telemetry.avg_health < criticalThresholds.health;
    const latencyCritical = telemetry.avg_latency_ms > criticalThresholds.latency_ms;
    if (!budgetCritical && !healthCritical && !latencyCritical) {
        return { triggered: false, reason: "nominal", action: "scope_reduce", ts: Date.now() };
    }
    let action = "scope_reduce";
    let reason = "supernova_triggered";
    if (budgetCritical) {
        action = "model_downgrade";
        reason = "budget_exhaustion_imminent";
    }
    else if (healthCritical) {
        action = "emergency_consensus";
        reason = "cluster_health_collapse";
    }
    else if (latencyCritical) {
        action = "sub_galaxy_spawn";
        reason = "latency_cascade_detected";
    }
    // Log & audit
    await appendAudit({ type: "supernova_fallback", reason, action, budget_remaining: telemetry.budget_remaining_pct, avg_health: telemetry.avg_health, avg_latency: telemetry.avg_latency_ms });
    // Update state for graceful degradation
    state.max_concurrency = Math.max(2, Math.floor(state.max_concurrency * 0.6));
    state.budget_consumed_usd = Math.min(state.global_budget_usd, state.budget_consumed_usd + 1); // reserve buffer
    await promises_1.default.writeFile(FABRIC_STATE, JSON.stringify(state, null, 2));
    return { triggered: true, reason, action, ts: Date.now() };
}
// ─── CLI ROUTER ─────────────────────────────────────────────────────────
async function main() {
    const [, , cmd, ...args] = process.argv;
    switch (cmd) {
        case "telemetry": {
            const agg = await aggregateTelemetry();
            console.log(JSON.stringify(agg, null, 2));
            break;
        }
        case "consensus": {
            const [topic, votesJson] = args;
            if (!topic || !votesJson) {
                console.log("Usage: consensus <topic> '<votes-json>'");
                process.exit(1);
            }
            const votes = JSON.parse(votesJson);
            const res = await macroConsensus(topic, votes);
            console.log(JSON.stringify(res, null, 2));
            break;
        }
        case "route": {
            const [domain, budget] = args;
            if (!domain || !budget) {
                console.log("Usage: route <domain> <budget>");
                process.exit(1);
            }
            const state = await loadState();
            const clusters = Object.values(state.temples || {}).map((t) => ({
                id: t.id, domain: t.phase, health: t.health || 0.8, latency_ms: 200, error_rate: 0.1, budget_consumed_pct: t.budget_allocated_usd > 0 ? t.budget_consumed_usd / t.budget_allocated_usd : 0, active_tasks: 1, status: t.status === "active" ? "healthy" : "degraded"
            }));
            const decision = await gravitationalRoute(clusters, domain, parseFloat(budget), { max_risk: 0.7, require_hmac: true });
            console.log(JSON.stringify(decision, null, 2));
            break;
        }
        case "supernova": {
            const state = await loadState();
            const tel = await aggregateTelemetry();
            const plan = await supernovaFallback(state, tel, { budget_pct: 90, health: 0.4, latency_ms: 900 });
            console.log(JSON.stringify(plan, null, 2));
            break;
        }
        default:
            console.log("Usage: sin-galaxy-core.ts <telemetry|consensus|route|supernova> [args]");
            process.exit(1);
    }
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
//# sourceMappingURL=sin-galaxy-core.js.map