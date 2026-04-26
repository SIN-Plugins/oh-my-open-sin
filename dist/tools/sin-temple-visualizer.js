#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const TEMPLE_DIR = path_1.default.join(process.cwd(), ".opencode", "plan-temples");
const BLACKBOARD_DIR = path_1.default.join(process.cwd(), ".opencode", "swarm-blackboard");
const TELEMETRY_LOG = path_1.default.join(process.env.HOME || "", ".config", "opencode", "logs", "telemetry.jsonl");
function parseArgs(args) {
    const opts = { temple: null, mode: "ascii", watch: false, json: false };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--temple" && args[i + 1])
            opts.temple = args[++i];
        if (["ascii", "mermaid", "live", "json"].includes(args[i]))
            opts.mode = args[i];
        if (args[i] === "--watch")
            opts.watch = true;
        if (args[i] === "--json")
            opts.json = true;
    }
    return opts;
}
async function loadTemple(id) {
    const file = path_1.default.join(TEMPLE_DIR, `${id}.json`);
    const raw = await promises_1.default.readFile(file, "utf-8");
    return JSON.parse(raw);
}
async function getLiveStatus(templeId) {
    const statusMap = {};
    try {
        const files = await promises_1.default.readdir(BLACKBOARD_DIR).catch(() => []);
        for (const f of files.filter(f => f.startsWith(`temple:${templeId}:`))) {
            const nodeId = f.replace(`temple:${templeId}:`, "").replace(".json", "");
            const raw = await promises_1.default.readFile(path_1.default.join(BLACKBOARD_DIR, f), "utf-8");
            const entry = JSON.parse(raw);
            statusMap[nodeId] = entry.value?.status || "completed";
        }
    }
    catch { }
    // Fallback: telemetry scan
    try {
        const raw = await promises_1.default.readFile(TELEMETRY_LOG, "utf-8").catch(() => "");
        const lines = raw.split("\n").filter(Boolean);
        for (const line of lines) {
            try {
                const e = JSON.parse(line);
                if (e.temple_id === templeId && e.node_id) {
                    if (e.msg === "task_complete")
                        statusMap[e.node_id] = "completed";
                    else if (e.msg === "task_error")
                        statusMap[e.node_id] = "failed";
                    else if (e.msg === "task_start")
                        statusMap[e.node_id] = "running";
                }
            }
            catch { }
        }
    }
    catch { }
    return statusMap;
}
function statusIcon(s) {
    switch (s) {
        case "completed": return "🟢";
        case "running": return "🔄";
        case "failed": return "🔴";
        case "blocked": return "🚫";
        default: return "⏳";
    }
}
function renderASCII(temple, live) {
    console.clear();
    console.log(`🏛️ PLAN TEMPLE: ${temple.id}`);
    console.log(`🎯 Goal: ${temple.goal}`);
    console.log(`📅 Generated: ${new Date(temple.ts).toISOString()}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const visited = new Set();
    function printNode(id, depth) {
        if (visited.has(id))
            return;
        visited.add(id);
        const node = temple.nodes.find(n => n.id === id);
        if (!node)
            return;
        const status = live[id] || node.status;
        const indent = "  ".repeat(depth);
        console.log(`${indent}${statusIcon(status)} ${id} [${node.agent_role}] ${node.description.slice(0, 60)}`);
        for (const dep of temple.hypergraph[id] || []) {
            printNode(dep, depth + 1);
        }
    }
    const roots = temple.nodes.filter(n => n.dependencies.length === 0);
    for (const r of roots)
        printNode(r.id, 0);
    console.log("");
}
function renderMermaid(temple, live) {
    let mermaid = "flowchart TD\n";
    for (const node of temple.nodes) {
        const status = live[node.id] || node.status;
        const color = status === "completed" ? "#4caf50" : status === "running" ? "#2196f3" : status === "failed" ? "#f44336" : "#9e9e9e";
        mermaid += `  ${node.id}[\"${statusIcon(status)} ${node.id}\\n${node.agent_role}\"]:::node${node.id}\n`;
        mermaid += `  classDef node${node.id} fill:${color},stroke:#333,stroke-width:2px,color:#fff\n`;
    }
    for (const [from, tos] of Object.entries(temple.hypergraph)) {
        for (const to of tos) {
            mermaid += `  ${from} --> ${to}\n`;
        }
    }
    console.log("```mermaid");
    console.log(mermaid);
    console.log("```");
}
async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (!opts.temple) {
        const files = await promises_1.default.readdir(TEMPLE_DIR).catch(() => []);
        console.log("📦 Available Temples:");
        for (const f of files.filter(f => f.endsWith(".json"))) {
            const raw = await promises_1.default.readFile(path_1.default.join(TEMPLE_DIR, f), "utf-8");
            const t = JSON.parse(raw);
            console.log(`  ${t.id} | ${t.goal.slice(0, 60)} | ${new Date(t.ts).toISOString()}`);
        }
        console.log("\nUsage: sin-temple-visualizer.ts --temple <id> [ascii|mermaid|live|json] [--watch]");
        return;
    }
    if (opts.watch) {
        console.log("👁️ Live watch mode (2s polling). Ctrl+C to stop.");
        while (true) {
            const temple = await loadTemple(opts.temple);
            const live = await getLiveStatus(opts.temple);
            if (opts.mode === "ascii" || opts.mode === "live")
                renderASCII(temple, live);
            else if (opts.mode === "mermaid")
                renderMermaid(temple, live);
            else if (opts.mode === "json")
                console.log(JSON.stringify({ temple, live }, null, 2));
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    else {
        const temple = await loadTemple(opts.temple);
        const live = await getLiveStatus(opts.temple);
        if (opts.mode === "ascii")
            renderASCII(temple, live);
        else if (opts.mode === "mermaid")
            renderMermaid(temple, live);
        else if (opts.mode === "json")
            console.log(JSON.stringify({ temple, live }, null, 2));
        else
            renderASCII(temple, live);
    }
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
//# sourceMappingURL=sin-temple-visualizer.js.map