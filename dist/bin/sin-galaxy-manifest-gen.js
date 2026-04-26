#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadJSON = loadJSON;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const CFG_DIR = path_1.default.join(process.env.HOME || "", ".config", "opencode");
const LOCAL_DIR = path_1.default.join(process.cwd(), ".opencode");
const MANIFEST_PATH = path_1.default.join(LOCAL_DIR, "galaxy-manifest.json");
const TELEMETRY_LOG = path_1.default.join(CFG_DIR, "logs", "telemetry.jsonl");
const PATTERNS_FILE = path_1.default.join(LOCAL_DIR, "temple-patterns.json");
const FABRIC_STATE = path_1.default.join(LOCAL_DIR, "fabric-state.json");
function safeRun(cmd, cwd = process.cwd()) {
    try {
        return { ok: true, out: (0, child_process_1.execSync)(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 8000 }).trim() };
    }
    catch (e) {
        return { ok: false, out: "", err: e.stderr?.toString() || e.message };
    }
}
async function loadJSON(p, fallback) {
    try {
        return JSON.parse(await promises_1.default.readFile(p, "utf-8"));
    }
    catch {
        return fallback;
    }
}
async function getTelemetryMetrics() {
    const raw = await promises_1.default.readFile(TELEMETRY_LOG, "utf-8").catch(() => "");
    const logs = raw.split("\n").filter(Boolean).map(l => { try {
        return JSON.parse(l);
    }
    catch {
        return null;
    } }).filter(Boolean);
    let cost = 0, tokens = 0, errors = 0, total = 0, latencySum = 0;
    for (const e of logs) {
        cost += e.cost_usd || 0;
        tokens += e.tokens || 0;
        total++;
        if (e.latency_ms)
            latencySum += e.latency_ms;
        if (e.msg?.includes("error") || e.msg?.includes("fail"))
            errors++;
    }
    return { cost, tokens, error_rate: total > 0 ? errors / total : 0, avg_latency: total > 0 ? latencySum / total : 0, total };
}
async function evolveManifest() {
    const base = await loadJSON(MANIFEST_PATH, {});
    const tel = await getTelemetryMetrics();
    const state = await loadJSON(FABRIC_STATE, { global_budget_usd: 50, budget_consumed_usd: 0 });
    const patterns = await loadJSON(PATTERNS_FILE, {});
    // Dynamic threshold adjustment based on telemetry
    const budgetPct = state.global_budget_usd > 0 ? (state.budget_consumed_usd / state.global_budget_usd) * 100 : 0;
    if (budgetPct > 70) {
        base.supernova_triggers.budget_exhaustion_pct = Math.max(60, base.supernova_triggers.budget_exhaustion_pct - 5);
    }
    if (tel.error_rate > 0.3) {
        base.consensus_engine.min_confidence_score = Math.min(0.9, base.consensus_engine.min_confidence_score + 0.05);
        base.supernova_triggers.error_rate_spike = Math.max(0.2, base.supernova_triggers.error_rate_spike - 0.05);
    }
    if (tel.avg_latency > 600) {
        base.cluster_topology.domains.backend.max_concurrency = Math.max(2, base.cluster_topology.domains.backend.max_concurrency - 1);
        base.cluster_topology.domains.frontend.max_concurrency = Math.max(2, base.cluster_topology.domains.frontend.max_concurrency - 1);
    }
    // Pattern inheritance sync
    if (patterns.verification_thresholds) {
        base.audit_schema.board_report_mapping.cost_efficiency.healing_attempts = patterns.verification_thresholds.min_coverage_delta || -5;
    }
    base.generated_at = new Date().toISOString();
    base.version = "1.0." + (parseInt(base.version?.split(".")[2] || "0") + 1);
    await promises_1.default.writeFile(MANIFEST_PATH, JSON.stringify(base, null, 2));
    console.log(`✅ Galaxy manifest evolved to v${base.version} (budget:${budgetPct.toFixed(1)}% err:${(tel.error_rate * 100).toFixed(1)}% lat:${Math.round(tel.avg_latency)}ms)`);
}
async function main() {
    const [, , cmd] = process.argv;
    if (cmd === "evolve") {
        await evolveManifest();
    }
    else if (cmd === "validate") {
        const m = await loadJSON(MANIFEST_PATH, {});
        const required = ["cluster_topology", "policy_matrix", "consensus_engine", "supernova_triggers", "audit_schema", "telemetry_evolution", "fleet_sync"];
        const missing = required.filter(k => !m[k]);
        if (missing.length > 0) {
            console.log(`❌ Missing sections: ${missing.join(", ")}`);
            process.exit(1);
        }
        console.log("✅ Manifest schema valid");
    }
    else {
        console.log("Usage: sin-galaxy-manifest-gen.ts <evolve|validate>");
        process.exit(1);
    }
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
//# sourceMappingURL=sin-galaxy-manifest-gen.js.map