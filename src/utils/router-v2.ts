import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { scanPaths, CodeMetrics } from "./ast-scanner";
import { classifyIntent, IntentCategory } from "./intent-classifier";
import { scoreAgents, AgentScore } from "./agent-scorer";
import { structuredLog } from "./telemetry";

const CACHE_FILE = path.join(process.cwd(), ".opencode", "route-cache-v2.json");
const CACHE_TTL_MS = 20 * 60 * 1000;

export interface RoutingDecisionV2 {
  agent: string;
  model: string;
  category: string;
  intent: IntentCategory;
  metrics: CodeMetrics;
  scores: AgentScore[];
  fallback_reason?: string;
  cache_hit: boolean;
  multi_layer_split: boolean;
}

async function getContentHash(paths: string[]): Promise<string> {
  const hash = createHash("sha256");
  for (const p of paths) {
    try {
      const stat = await fs.stat(p);
      hash.update(`${p}:${stat.mtimeMs}`);
    } catch {}
  }
  return hash.digest("hex").slice(0, 12);
}

export async function routeTaskV2(opts: {
  description: string;
  target_paths?: string[];
  budget_pct: number;
  breakerStates: Record<string, boolean>;
  config: any;
}): Promise<RoutingDecisionV2> {
  const safePaths = opts.target_paths?.length ? opts.target_paths : [process.cwd()];
  const contentHash = await getContentHash(safePaths);
  const cacheKey = `${contentHash}|${opts.description.slice(0, 60)}`;

  // Cache check
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8").catch(() => "{}");
    const cache: Record<string, { decision: RoutingDecisionV2; ts: number }> = JSON.parse(raw);
    const entry = cache[cacheKey];
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
      entry.decision.cache_hit = true;
      return entry.decision;
    }
  } catch {}

  // 1. AST Scan
  const metrics = await scanPaths(safePaths);

  // 2. Intent Classification
  const intent = classifyIntent(opts.description);

  // 3. Multi-Layer Detection
  const layers = new Set<string>();
  if (metrics.hasUI) layers.add("frontend");
  if (metrics.hasDB) layers.add("database");
  if (metrics.layer === "backend") layers.add("backend");
  const multi_layer_split = layers.size > 1;

  // 4. Agent Scoring
  const scores = await scoreAgents(intent.category, metrics.complexity, metrics.layer, opts.budget_pct, opts.config, opts.breakerStates);
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
    structuredLog("info", "routing_coordinator_override", { layers: Array.from(layers), coordinator: finalAgent });
  }

  const decision: RoutingDecisionV2 = {
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
    const raw = await fs.readFile(CACHE_FILE, "utf-8").catch(() => "{}");
    const cache: Record<string, { decision: RoutingDecisionV2; ts: number }> = JSON.parse(raw);
    cache[cacheKey] = { decision, ts: Date.now() };
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {}

  structuredLog("info", "routing_decision_v2", {
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
