"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRoutingWeights = updateRoutingWeights;
exports.syncWeightsFromTelemetry = syncWeightsFromTelemetry;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const telemetry_1 = require("./telemetry");
const WEIGHTS_PATH = path_1.default.join(process.cwd(), ".opencode", "routing-weights.json");
const TELEMETRY_LOG = path_1.default.join(process.env.HOME || "", ".config/opencode/logs/telemetry.jsonl");
async function updateRoutingWeights(sessionId, agent, success) {
    try {
        const raw = await promises_1.default.readFile(WEIGHTS_PATH, "utf-8").catch(() => "{}");
        const weights = JSON.parse(raw);
        const current = weights[agent] ?? 0.7;
        // Exponential moving average (alpha=0.2)
        const updated = current * 0.8 + (success ? 1 : 0) * 0.2;
        weights[agent] = parseFloat(updated.toFixed(3));
        await promises_1.default.writeFile(WEIGHTS_PATH, JSON.stringify(weights, null, 2));
        (0, telemetry_1.structuredLog)("info", "routing_weight_updated", { session_id: sessionId, agent, success, new_weight: weights[agent] });
    }
    catch (e) {
        (0, telemetry_1.structuredLog)("warn", "routing_weight_update_failed", { error: e.message });
    }
}
async function syncWeightsFromTelemetry() {
    try {
        const raw = await promises_1.default.readFile(TELEMETRY_LOG, "utf-8").catch(() => "");
        const lines = raw.split("\n").filter(Boolean);
        const agentResults = {};
        for (const line of lines) {
            try {
                const e = JSON.parse(line);
                if (e.msg === "task_complete" || e.msg === "task_error") {
                    const agent = e.agent || e.routing_agent;
                    if (!agent)
                        continue;
                    if (!agentResults[agent])
                        agentResults[agent] = { success: 0, total: 0 };
                    agentResults[agent].total++;
                    if (e.msg === "task_complete")
                        agentResults[agent].success++;
                }
            }
            catch { }
        }
        const weights = {};
        for (const [agent, stats] of Object.entries(agentResults)) {
            weights[agent] = parseFloat((stats.success / stats.total).toFixed(3));
        }
        await promises_1.default.writeFile(WEIGHTS_PATH, JSON.stringify(weights, null, 2));
        (0, telemetry_1.structuredLog)("info", "routing_weights_synced_from_telemetry", { agents: Object.keys(weights).length });
    }
    catch (e) {
        (0, telemetry_1.structuredLog)("warn", "routing_telemetry_sync_failed", { error: e.message });
    }
}
//# sourceMappingURL=routing-feedback.js.map