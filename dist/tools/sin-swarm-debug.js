#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const CFG_DIR = path_1.default.join(process.env.HOME || "", ".config", "opencode");
const BLACKBOARD_DIR = path_1.default.join(process.cwd(), ".opencode", "swarm-blackboard");
const TELEMETRY_LOG = path_1.default.join(CFG_DIR, "logs", "telemetry.jsonl");
const HANDOFF_JSON = path_1.default.join(process.cwd(), ".opencode", "handoff.json");
const HMAC_SECRET = process.env.SIN_HMAC_SECRET || "sin-swarm-zero-trust-default";
function parseArgs(args) {
    const opts = { json: false, watch: false, session: null, mode: "all" };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--json")
            opts.json = true;
        if (args[i] === "--watch")
            opts.watch = true;
        if (args[i] === "--session" && args[i + 1])
            opts.session = args[++i];
        if (["blackboard", "votes", "health", "audit", "all"].includes(args[i]))
            opts.mode = args[i];
    }
    return opts;
}
async function readBlackboard() {
    const entries = [];
    try {
        const files = await promises_1.default.readdir(BLACKBOARD_DIR).catch(() => []);
        for (const f of files.filter(f => f.endsWith(".json"))) {
            const raw = await promises_1.default.readFile(path_1.default.join(BLACKBOARD_DIR, f), "utf-8");
            entries.push(JSON.parse(raw));
        }
    }
    catch { }
    return entries.sort((a, b) => b.ts - a.ts);
}
async function readTelemetry(filter) {
    const raw = await promises_1.default.readFile(TELEMETRY_LOG, "utf-8").catch(() => "");
    return raw.split("\n").filter(Boolean).map(l => {
        try {
            return JSON.parse(l);
        }
        catch {
            return null;
        }
    }).filter(Boolean).filter(e => !filter || e.msg?.includes(filter));
}
async function getHealthMatrix() {
    const logs = await readTelemetry("swarm_health_updated");
    const matrix = {};
    for (const e of logs) {
        const sid = e.session_id || e.correlation_id || "unknown";
        const agent = e.agent || "unknown";
        if (!matrix[sid])
            matrix[sid] = {};
        matrix[sid][agent] = { score: e.score, status: e.status, latency_ms: e.latency_ms, error_rate: e.error_rate, ts: e.ts };
    }
    return matrix;
}
async function getVotes() {
    const logs = await readTelemetry("swarm_fusion");
    const votes = [];
    for (const e of logs) {
        votes.push({ session_id: e.session_id, strategy: e.strategy, agreed: e.agreed, decision: e.decision?.slice(0, 120), confidence: e.confidence, ts: e.ts });
    }
    return votes.sort((a, b) => b.ts - a.ts);
}
function verifyHMAC(from, to, type, payload, ts, signature) {
    const payloadStr = JSON.stringify(payload, Object.keys(payload).sort());
    const hmac = crypto_1.default.createHmac("sha256", HMAC_SECRET);
    hmac.update(`${from}:${to}:${type}:${payloadStr}:${ts}`);
    return hmac.digest("hex") === signature;
}
async function getMessageAudit() {
    const logs = await readTelemetry("swarm_message");
    return logs.map(e => ({
        from: e.from, to: e.to, type: e.type, verified: e.verified, payload_keys: e.payload_keys, ts: e.ts
    })).sort((a, b) => b.ts - a.ts);
}
function printTable(rows, cols) {
    if (rows.length === 0) {
        console.log("  (empty)");
        return;
    }
    const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] || "").length)));
    console.log("  " + cols.map((c, i) => c.padEnd(widths[i])).join(" │ "));
    console.log("  " + widths.map(w => "─".repeat(w)).join("─┼─"));
    for (const r of rows) {
        console.log("  " + cols.map((c, i) => String(r[c] || "").padEnd(widths[i])).join(" │ "));
    }
}
async function render(opts) {
    console.clear();
    console.log("🔍 SIN SWARM DEBUG DASHBOARD");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (opts.mode === "all" || opts.mode === "blackboard") {
        console.log("\n📦 BLACKBOARD");
        const bb = await readBlackboard();
        if (opts.json) {
            console.log(JSON.stringify({ blackboard: bb }, null, 2));
            return;
        }
        printTable(bb.slice(0, 10), ["key", "version", "author", "ts"]);
    }
    if (opts.mode === "all" || opts.mode === "health") {
        console.log("\n🩺 HEALTH MATRIX");
        const hm = await getHealthMatrix();
        if (opts.json) {
            console.log(JSON.stringify({ health_matrix: hm }, null, 2));
            return;
        }
        for (const [sid, agents] of Object.entries(hm)) {
            console.log(`  Session: ${sid}`);
            const rows = Object.entries(agents).map(([a, v]) => ({ agent: a, score: v.score, status: v.status, latency: v.latency_ms, errors: v.error_rate }));
            printTable(rows, ["agent", "score", "status", "latency", "errors"]);
        }
    }
    if (opts.mode === "all" || opts.mode === "votes") {
        console.log("\n⚖️ VOTE TRACKER");
        const votes = await getVotes();
        if (opts.json) {
            console.log(JSON.stringify({ votes }, null, 2));
            return;
        }
        printTable(votes.slice(0, 10), ["session_id", "strategy", "agreed", "confidence", "ts"]);
    }
    if (opts.mode === "all" || opts.mode === "audit") {
        console.log("\n🔐 MESSAGE AUDIT");
        const audit = await getMessageAudit();
        if (opts.json) {
            console.log(JSON.stringify({ audit }, null, 2));
            return;
        }
        printTable(audit.slice(0, 10), ["from", "to", "type", "verified", "ts"]);
    }
}
async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.watch) {
        console.log("👁️ Watch mode active (2s polling). Ctrl+C to stop.");
        while (true) {
            await render(opts);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    else {
        await render(opts);
    }
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
//# sourceMappingURL=sin-swarm-debug.js.map