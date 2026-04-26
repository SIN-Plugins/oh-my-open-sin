import fs from "fs/promises";
import path from "path";
import { structuredLog } from "./telemetry";

const WEIGHTS_PATH = path.join(process.cwd(), ".opencode", "routing-weights.json");
const TELEMETRY_LOG = path.join(process.env.HOME || "", ".config/opencode/logs/telemetry.jsonl");

export async function updateRoutingWeights(sessionId: string, agent: string, success: boolean): Promise<void> {
  try {
    const raw = await fs.readFile(WEIGHTS_PATH, "utf-8").catch(() => "{}");
    const weights: Record<string, number> = JSON.parse(raw);
    const current = weights[agent] ?? 0.7;
    // Exponential moving average (alpha=0.2)
    const updated = current * 0.8 + (success ? 1 : 0) * 0.2;
    weights[agent] = parseFloat(updated.toFixed(3));
    await fs.writeFile(WEIGHTS_PATH, JSON.stringify(weights, null, 2));
    structuredLog("info", "routing_weight_updated", { session_id: sessionId, agent, success, new_weight: weights[agent] });
  } catch (e: any) {
    structuredLog("warn", "routing_weight_update_failed", { error: e.message });
  }
}

export async function syncWeightsFromTelemetry(): Promise<void> {
  try {
    const raw = await fs.readFile(TELEMETRY_LOG, "utf-8").catch(() => "");
    const lines = raw.split("\n").filter(Boolean);
    const agentResults: Record<string, { success: number; total: number }> = {};

    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        if (e.msg === "task_complete" || e.msg === "task_error") {
          const agent = e.agent || e.routing_agent;
          if (!agent) continue;
          if (!agentResults[agent]) agentResults[agent] = { success: 0, total: 0 };
          agentResults[agent].total++;
          if (e.msg === "task_complete") agentResults[agent].success++;
        }
      } catch {}
    }

    const weights: Record<string, number> = {};
    for (const [agent, stats] of Object.entries(agentResults)) {
      weights[agent] = parseFloat((stats.success / stats.total).toFixed(3));
    }

    await fs.writeFile(WEIGHTS_PATH, JSON.stringify(weights, null, 2));
    structuredLog("info", "routing_weights_synced_from_telemetry", { agents: Object.keys(weights).length });
  } catch (e: any) {
    structuredLog("warn", "routing_telemetry_sync_failed", { error: e.message });
  }
}
