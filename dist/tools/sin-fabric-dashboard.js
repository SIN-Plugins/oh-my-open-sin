#!/usr/bin/env tsx
"use strict";
/**
 * SIN Fabric-Welt Dashboard
 * Live ASCII/Mermaid Portfolio + Heatmap + Queue Visualization
 * Zero-dependency, native OpenCode, production-ready
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sinFabricDashboard = void 0;
exports.SinFabricDashboard = SinFabricDashboard;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const CFG_DIR = path_1.default.join(process.env.HOME || "", ".config", "opencode");
const LOCAL_DIR = path_1.default.join(process.cwd(), ".opencode");
const FABRIC_STATE = path_1.default.join(LOCAL_DIR, "fabric-state.json");
const TELEMETRY_LOG = path_1.default.join(CFG_DIR, "logs", "telemetry.jsonl");
const TEMPLE_DIR = path_1.default.join(LOCAL_DIR, "plan-temples");
function parseArgs(args) {
    const opts = { mode: "ascii", watch: false, json: false, temple: null };
    for (let i = 0; i < args.length; i++) {
        if (["ascii", "mermaid", "heatmap", "queue", "json"].includes(args[i]))
            opts.mode = args[i];
        if (args[i] === "--watch")
            opts.watch = true;
        if (args[i] === "--json")
            opts.json = true;
        if (args[i] === "--temple" && args[i + 1])
            opts.temple = args[++i];
    }
    return opts;
}
async function loadState() {
    try {
        return JSON.parse(await promises_1.default.readFile(FABRIC_STATE, "utf-8"));
    }
    catch {
        return {
            temples: {},
            global_budget_usd: 50,
            budget_consumed_usd: 0,
            active_concurrency: 0,
            max_concurrency: 8,
            proxy_latency_ms: 0,
            last_optimization_ts: 0,
        };
    }
}
async function getTelemetry() {
    const raw = await promises_1.default.readFile(TELEMETRY_LOG, "utf-8").catch(() => "");
    const logs = raw
        .split("\n")
        .filter(Boolean)
        .map((l) => {
        try {
            return JSON.parse(l);
        }
        catch {
            return null;
        }
    })
        .filter(Boolean);
    let cost = 0, tokens = 0;
    for (const e of logs) {
        cost += e.cost_usd || 0;
        tokens += e.tokens || 0;
    }
    return { cost, tokens };
}
function bar(pct, len = 20) {
    const filled = Math.round(len * Math.min(1, Math.max(0, pct)));
    return "█".repeat(filled) + "░".repeat(len - filled);
}
function statusIcon(s) {
    return s === "active"
        ? "🟢"
        : s === "paused"
            ? "🟡"
            : s === "completed"
                ? "⚪"
                : s === "failed"
                    ? "🔴"
                    : "⏳";
}
function riskColor(r) {
    if (r < 0.4)
        return `\x1b[32m${r.toFixed(2)}\x1b[0m`;
    if (r < 0.7)
        return `\x1b[33m${r.toFixed(2)}\x1b[0m`;
    return `\x1b[31m${r.toFixed(2)}\x1b[0m`;
}
async function renderASCII(state, tel) {
    console.clear();
    console.log("🌐 SIN FABRIC-WELT DASHBOARD");
    console.log(`💰 Budget: $${state.budget_consumed_usd.toFixed(2)} / $${state.global_budget_usd.toFixed(2)} ${bar(state.budget_consumed_usd / state.global_budget_usd)}`);
    console.log(`⚡ Concurrency: ${state.active_concurrency}/${state.max_concurrency} | Proxy: ${state.proxy_latency_ms}ms | Tokens: ${tel.tokens.toLocaleString()}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("ID               │ Phase      │ Status │ Pri │ Risk  │ Health │ Budget      │ Progress");
    console.log("─────────────────┼────────────┼────────┼─────┼───────┼────────┼─────────────┼──────────");
    for (const [id, t] of Object.entries(state.temples).sort((a, b) => b[1].priority - a[1].priority)) {
        const prog = t.nodes_total > 0 ? t.nodes_completed / t.nodes_total : 0;
        console.log(`${id.slice(0, 16).padEnd(16)} │ ${t.phase.padEnd(10)} │ ${statusIcon(t.status)} ${t.status.padEnd(6)} │ ${String(t.priority).padStart(3)} │ ${riskColor(t.risk_score)} │ ${t.health.toFixed(2).padStart(6)} │ $${t.budget_consumed_usd.toFixed(1)}/${t.budget_allocated_usd.toFixed(1)} │ ${bar(prog, 10)} ${Math.round(prog * 100)}%`);
    }
    console.log("");
}
async function renderHeatmap(state) {
    console.clear();
    console.log("🔥 BUDGET / RISK HEATMAP");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    for (const [id, t] of Object.entries(state.temples)) {
        const bPct = t.budget_allocated_usd > 0 ? t.budget_consumed_usd / t.budget_allocated_usd : 0;
        const r = t.risk_score;
        const heat = bPct > 0.8 || r > 0.7
            ? "\x1b[41m 🔴 HIGH \x1b[0m"
            : bPct > 0.5 || r > 0.4
                ? "\x1b[43m 🟡 MED  \x1b[0m"
                : "\x1b[42m 🟢 LOW  \x1b[0m";
        console.log(`${id.slice(0, 20).padEnd(20)} │ Budget: ${bar(bPct, 15)} ${Math.round(bPct * 100)}% │ Risk: ${riskColor(r)} │ ${heat}`);
    }
    console.log("");
}
async function renderQueue(state) {
    console.clear();
    console.log("📅 PORTFOLIO QUEUE & DISPATCH");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const queue = Object.values(state.temples)
        .filter((t) => t.status === "active")
        .sort((a, b) => b.priority - a.priority);
    const slots = Math.max(0, state.max_concurrency - state.active_concurrency);
    console.log(`🟢 Available Slots: ${slots} / ${state.max_concurrency} | Proxy Latency: ${state.proxy_latency_ms}ms`);
    console.log("────────────────────────────────────────");
    queue.forEach((t, i) => {
        const dispatch = i < slots ? "🚀 DISPATCHED" : "⏳ QUEUED";
        console.log(`${String(i + 1).padStart(2)}. ${t.id.slice(0, 20).padEnd(20)} │ Pri:${t.priority} │ Risk:${t.risk_score.toFixed(2)} │ ${dispatch}`);
    });
    console.log("");
}
async function renderMermaid(state) {
    let m = "flowchart TD\n";
    for (const [id, t] of Object.entries(state.temples)) {
        const color = t.status === "active"
            ? "#4caf50"
            : t.status === "paused"
                ? "#ff9800"
                : t.status === "failed"
                    ? "#f44336"
                    : "#9e9e9e";
        m += `  ${id}["${statusIcon(t.status)} ${id}\\n${t.phase} | $${t.budget_consumed_usd.toFixed(1)}"]:::n${id}\n`;
        m += `  classDef n${id} fill:${color},stroke:#333,stroke-width:2px,color:#fff\n`;
    }
    // Simple dependency simulation (plan→exec→test)
    const ids = Object.keys(state.temples);
    for (let i = 0; i < ids.length - 1; i++) {
        m += `  ${ids[i]} --> ${ids[i + 1]}\n`;
    }
    console.log("```mermaid");
    console.log(m);
    console.log("```");
}
async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.watch) {
        console.log("👁️ Live watch mode (2s polling). Ctrl+C to stop.");
        while (true) {
            const state = await loadState();
            const tel = await getTelemetry();
            if (opts.mode === "ascii")
                await renderASCII(state, tel);
            else if (opts.mode === "heatmap")
                await renderHeatmap(state);
            else if (opts.mode === "queue")
                await renderQueue(state);
            else if (opts.mode === "mermaid")
                await renderMermaid(state);
            else if (opts.mode === "json")
                console.log(JSON.stringify({ state, telemetry: tel }, null, 2));
            await new Promise((r) => setTimeout(r, 2000));
        }
        return;
    }
    const state = await loadState();
    const tel = await getTelemetry();
    if (opts.mode === "ascii")
        await renderASCII(state, tel);
    else if (opts.mode === "heatmap")
        await renderHeatmap(state);
    else if (opts.mode === "queue")
        await renderQueue(state);
    else if (opts.mode === "mermaid")
        await renderMermaid(state);
    else if (opts.mode === "json")
        console.log(JSON.stringify({ state, telemetry: tel }, null, 2));
    else
        await renderASCII(state, tel);
}
function SinFabricDashboard() { main().catch((e) => { console.error("❌", e.message); process.exit(1); }); }
exports.sinFabricDashboard = SinFabricDashboard;
main().catch((e) => {
    console.error("❌", e.message);
    process.exit(1);
});
//# sourceMappingURL=sin-fabric-dashboard.js.map