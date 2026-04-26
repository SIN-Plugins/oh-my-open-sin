#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossTempleRouter = exports.PortfolioScheduler = exports.RiskController = exports.BudgetAllocator = void 0;
exports.safeRun = safeRun;
exports.loadFabricState = loadFabricState;
exports.saveFabricState = saveFabricState;
exports.runFabricController = runFabricController;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const child_process_1 = require("child_process");
// ─── PATHS & CONFIG ─────────────────────────────────────────────────────
const CFG_DIR = path_1.default.join(process.env.HOME || "", ".config", "opencode");
const LOCAL_DIR = path_1.default.join(process.cwd(), ".opencode");
const FABRIC_STATE = path_1.default.join(LOCAL_DIR, "fabric-state.json");
const TELEMETRY_LOG = path_1.default.join(CFG_DIR, "logs", "telemetry.jsonl");
const AUDIT_CHAIN = path_1.default.join(LOCAL_DIR, "audit-chain.jsonl");
const BLACKBOARD_DIR = path_1.default.join(LOCAL_DIR, "swarm-blackboard");
const HMAC_SECRET = process.env.SIN_HMAC_SECRET || "sin-fabric-zero-trust";
// ─── HELPERS ────────────────────────────────────────────────────────────
function safeRun(cmd, cwd = process.cwd()) {
    try {
        return {
            ok: true,
            out: (0, child_process_1.execSync)(cmd, {
                cwd,
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 10000
            }).trim()
        };
    }
    catch (e) {
        return {
            ok: false,
            out: "",
            err: e.stderr?.toString() || e.message
        };
    }
}
async function loadFabricState() {
    try {
        const raw = await promises_1.default.readFile(FABRIC_STATE, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return {
            temples: {},
            global_budget_usd: parseFloat(process.env.SIN_COST_BUDGET_USD || "50"),
            budget_consumed_usd: 0,
            active_concurrency: 0,
            max_concurrency: 8,
            proxy_latency_ms: 0,
            last_optimization_ts: 0
        };
    }
}
async function saveFabricState(state) {
    await promises_1.default.mkdir(path_1.default.dirname(FABRIC_STATE), { recursive: true });
    const tmp = FABRIC_STATE + ".tmp";
    await promises_1.default.writeFile(tmp, JSON.stringify(state, null, 2));
    await promises_1.default.rename(tmp, FABRIC_STATE);
}
async function appendAudit(entry) {
    const raw = await promises_1.default.readFile(AUDIT_CHAIN, "utf-8").catch(() => "");
    const lines = raw.split("\n").filter(Boolean);
    const parentHash = lines.length > 0 ? JSON.parse(lines[lines.length - 1]).merkle_hash : "genesis";
    const payloadHash = crypto_1.default.createHash("sha256").update(JSON.stringify(entry, Object.keys(entry).sort())).digest("hex");
    const merkleHash = crypto_1.default.createHash("sha256").update(`${parentHash}:${payloadHash}:${Date.now()}`).digest("hex");
    const hmac = crypto_1.default.createHmac("sha256", HMAC_SECRET);
    hmac.update(JSON.stringify({ ...entry, parent_hash: parentHash, payload_hash: payloadHash, ts: Date.now() }, Object.keys({ ...entry, parent_hash: parentHash, payload_hash: payloadHash, ts: Date.now() }).sort()));
    const auditEntry = {
        ...entry,
        parent_hash: parentHash,
        payload_hash: payloadHash,
        merkle_hash: merkleHash,
        signature: hmac.digest("hex"),
        ts: Date.now()
    };
    await promises_1.default.appendFile(AUDIT_CHAIN, JSON.stringify(auditEntry) + "\n");
}
async function getTelemetryMetrics() {
    const raw = await promises_1.default.readFile(TELEMETRY_LOG, "utf-8").catch(() => "");
    const logs = raw.split("\n").filter(Boolean).map(l => {
        try {
            return JSON.parse(l);
        }
        catch {
            return null;
        }
    }).filter(Boolean);
    let totalCost = 0, totalTokens = 0;
    for (const e of logs) {
        totalCost += e.cost_usd || 0;
        totalTokens += e.tokens || 0;
    }
    return { totalCost, totalTokens };
}
// ─── HQ MODULES ─────────────────────────────────────────────────────────
class BudgetAllocator {
    static async allocate(templeId, phase, complexity, state) {
        const base = complexity === "high" ? 15 : complexity === "medium" ? 8 : 3;
        const phaseMultiplier = phase === "execution" ? 1.5 : phase === "test" ? 1.2 : 1.0;
        let allocation = base * phaseMultiplier;
        const remaining = state.global_budget_usd - state.budget_consumed_usd;
        if (remaining < allocation)
            allocation = Math.max(1, remaining * 0.3);
        if (!state.temples[templeId]) {
            state.temples[templeId] = {
                id: templeId, goal: "", phase: phase, status: "active",
                budget_allocated_usd: 0, budget_consumed_usd: 0, risk_score: 0,
                priority: 5, health: 1.0, nodes_total: 0, nodes_completed: 0, ts: Date.now()
            };
        }
        state.temples[templeId].budget_allocated_usd = allocation;
        await appendAudit({ type: "budget_allocated", temple_id: templeId, amount: allocation, phase, complexity });
        return allocation;
    }
    static async rebalance(state) {
        const active = Object.values(state.temples).filter(t => t.status === "active");
        if (active.length === 0)
            return;
        const totalAllocated = active.reduce((s, t) => s + t.budget_allocated_usd, 0);
        const globalRemaining = state.global_budget_usd - state.budget_consumed_usd;
        if (totalAllocated > globalRemaining * 1.2) {
            const factor = globalRemaining / totalAllocated;
            for (const t of active) {
                state.temples[t.id].budget_allocated_usd = Math.max(1, t.budget_allocated_usd * factor);
            }
            await appendAudit({ type: "budget_rebalanced", factor, reason: "global_cap_exceeded" });
        }
    }
}
exports.BudgetAllocator = BudgetAllocator;
class RiskController {
    static score(complexity, securityScope, verificationHistory, agentHealth) {
        let score = 0.2;
        if (complexity === "high")
            score += 0.3;
        if (securityScope)
            score += 0.2;
        if (verificationHistory < 0.6)
            score += 0.2;
        if (agentHealth < 0.5)
            score += 0.1;
        return Math.min(1, parseFloat(score.toFixed(2)));
    }
    static async enforceGate(templeId, risk, state) {
        if (!state.temples[templeId]) {
            state.temples[templeId] = {
                id: templeId, goal: "", phase: "plan", status: "active",
                budget_allocated_usd: 0, budget_consumed_usd: 0, risk_score: risk,
                priority: 5, health: 1.0, nodes_total: 0, nodes_completed: 0, ts: Date.now()
            };
        }
        if (risk > 0.8) {
            state.temples[templeId].status = "paused";
            await appendAudit({ type: "risk_block", temple_id: templeId, risk, reason: "high_risk_requires_review" });
            return "block";
        }
        if (risk > 0.6) {
            state.temples[templeId].priority = Math.max(1, state.temples[templeId].priority - 2);
            await appendAudit({ type: "risk_throttle", temple_id: templeId, risk });
            return "throttle";
        }
        return "allow";
    }
}
exports.RiskController = RiskController;
class PortfolioScheduler {
    static async dispatchQueue(state) {
        const queue = Object.values(state.temples)
            .filter(t => t.status === "active")
            .sort((a, b) => b.priority - a.priority || a.risk_score - b.risk_score);
        const availableSlots = Math.max(0, state.max_concurrency - state.active_concurrency);
        const dispatch = queue.slice(0, availableSlots).map(t => t.id);
        if (state.proxy_latency_ms > 800) {
            state.max_concurrency = Math.max(2, Math.floor(state.max_concurrency * 0.7));
            await appendAudit({ type: "scheduler_scale_down", reason: "proxy_latency_high", latency: state.proxy_latency_ms });
        }
        else if (state.proxy_latency_ms < 200 && state.active_concurrency < state.max_concurrency) {
            state.max_concurrency = Math.min(12, state.max_concurrency + 1);
        }
        return dispatch;
    }
    static async reapStale(state) {
        let reaped = 0;
        const cutoff = Date.now() - 300000; // 5 min
        for (const [id, t] of Object.entries(state.temples)) {
            if (t.status === "active" && t.ts < cutoff && t.nodes_completed >= t.nodes_total && t.nodes_total > 0) {
                state.temples[id].status = "completed";
                reaped++;
            }
        }
        if (reaped > 0)
            await appendAudit({ type: "stale_reaped", count: reaped });
        return reaped;
    }
}
exports.PortfolioScheduler = PortfolioScheduler;
class CrossTempleRouter {
    static async routeHandoff(fromTemple, toTemple, payload, state) {
        const hmac = crypto_1.default.createHmac("sha256", HMAC_SECRET);
        hmac.update(`${fromTemple}:${toTemple}:${JSON.stringify(payload, Object.keys(payload).sort())}:${Date.now()}`);
        const signature = hmac.digest("hex");
        const valid = payload.signature && crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(payload.signature));
        if (!valid) {
            await appendAudit({ type: "route_rejected", from: fromTemple, to: toTemple, reason: "hmac_mismatch" });
            return { valid: false, routed: false };
        }
        // Namespace-isolated blackboard write
        await promises_1.default.mkdir(BLACKBOARD_DIR, { recursive: true });
        const bbPath = path_1.default.join(BLACKBOARD_DIR, `fabric:${toTemple}:handoff.json`);
        await promises_1.default.writeFile(bbPath, JSON.stringify({ from: fromTemple, payload, ts: Date.now() }, null, 2));
        if (state.temples[toTemple]) {
            state.temples[toTemple].health = Math.min(1, state.temples[toTemple].health + 0.1);
        }
        await appendAudit({ type: "route_accepted", from: fromTemple, to: toTemple });
        return { valid: true, routed: true };
    }
}
exports.CrossTempleRouter = CrossTempleRouter;
// ─── CLI MAIN ───────────────────────────────────────────────────────────
async function runFabricController(cmd, args) {
    const state = await loadFabricState();
    switch (cmd) {
        case "status": {
            const metrics = await getTelemetryMetrics();
            console.log("🏛️ SIN FABRIC HQ STATUS");
            console.log(`💰 Budget: $${state.budget_consumed_usd.toFixed(2)} / $${state.global_budget_usd.toFixed(2)}`);
            console.log(`⚡ Concurrency: ${state.active_concurrency}/${state.max_concurrency} | Proxy: ${state.proxy_latency_ms}ms`);
            console.log(`📦 Active Temples: ${Object.values(state.temples).filter(t => t.status === "active").length}`);
            for (const [id, t] of Object.entries(state.temples)) {
                const icon = t.status === "active" ? "🟢" : t.status === "paused" ? "🟡" : "⚪";
                console.log(`  ${icon} ${id} | ${t.phase} | Pri:${t.priority} | Risk:${t.risk_score} | $${t.budget_consumed_usd.toFixed(2)}/${t.budget_allocated_usd.toFixed(2)}`);
            }
            break;
        }
        case "allocate": {
            const [templeId, phase, complexity] = args;
            if (!templeId || !phase || !complexity) {
                console.log("Usage: allocate <templeId> <phase> <low|medium|high>");
                process.exit(1);
            }
            const amt = await BudgetAllocator.allocate(templeId, phase, complexity, state);
            console.log(`✅ Allocated $${amt.toFixed(2)} to ${templeId}`);
            break;
        }
        case "optimize": {
            await BudgetAllocator.rebalance(state);
            await PortfolioScheduler.reapStale(state);
            state.last_optimization_ts = Date.now();
            console.log("✅ Fabric optimized (rebalanced + reaped)");
            break;
        }
        case "route": {
            const [from, to, payloadFile] = args;
            if (!from || !to || !payloadFile) {
                console.log("Usage: route <from> <to> <payload.json>");
                process.exit(1);
            }
            const payload = JSON.parse(await promises_1.default.readFile(payloadFile, "utf-8"));
            const res = await CrossTempleRouter.routeHandoff(from, to, payload, state);
            console.log(res.valid && res.routed ? "✅ Routed securely" : "❌ Route rejected");
            break;
        }
        default:
            console.log("Usage: sin-fabric-controller.ts <status|allocate|optimize|route> [args]");
            process.exit(1);
    }
    await saveFabricState(state);
}
//# sourceMappingURL=fabric-controller.js.map