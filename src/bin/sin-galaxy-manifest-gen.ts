#!/usr/bin/env tsx
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const CFG_DIR = path.join(process.env.HOME || "", ".config", "opencode");
const LOCAL_DIR = path.join(process.cwd(), ".opencode");
const MANIFEST_PATH = path.join(LOCAL_DIR, "galaxy-manifest.json");
const TELEMETRY_LOG = path.join(CFG_DIR, "logs", "telemetry.jsonl");
const PATTERNS_FILE = path.join(LOCAL_DIR, "temple-patterns.json");
const FABRIC_STATE = path.join(LOCAL_DIR, "fabric-state.json");

export interface GalaxyPatterns {
  verification_thresholds?: {
    min_coverage_delta?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ClusterTopology {
  domains: {
    [key: string]: { max_concurrency: number; [k: string]: any };
  };
}

export interface AuditSchema {
  board_report_mapping: {
    [key: string]: { healing_attempts: number; [k: string]: any };
  };
}

export interface SupernovaTriggers {
  budget_exhaustion_pct: number;
  error_rate_spike: number;
}

export interface ConsensusEngine {
  min_confidence_score: number;
}

export interface GalaxyManifest {
  cluster_topology: ClusterTopology;
  policy_matrix: any;
  consensus_engine: ConsensusEngine;
  supernova_triggers: SupernovaTriggers;
  audit_schema: AuditSchema;
  telemetry_evolution: any;
  fleet_sync: any;
  generated_at?: string;
  version?: string;
  [key: string]: any;
}

function safeRun(cmd: string, cwd = process.cwd()): { ok: boolean; out: string; err?: string } {
  try { return { ok: true, out: execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe","pipe","pipe"], timeout: 8000 }).trim() }; }
  catch (e: any) { return { ok: false, out: "", err: e.stderr?.toString() || e.message }; }
}

export async function loadJSON<T>(p: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(p, "utf-8")); } catch { return fallback; }
}

async function getTelemetryMetrics() {
  const raw = await fs.readFile(TELEMETRY_LOG, "utf-8").catch(() => "");
  const logs = raw.split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  let cost = 0, tokens = 0, errors = 0, total = 0, latencySum = 0;
  for (const e of logs) {
    cost += e.cost_usd || 0; tokens += e.tokens || 0; total++;
    if (e.latency_ms) latencySum += e.latency_ms;
    if (e.msg?.includes("error") || e.msg?.includes("fail")) errors++;
  }
  return {
    total_cost_usd: cost,
    total_tokens: tokens,
    error_rate: total > 0 ? errors / total : 0,
    avg_latency: total > 0 ? latencySum / total : 0,
    request_count: total
  };
}

export class SinGalaxyManifestGen {
  async generate(): Promise<void> {
    const tel = await getTelemetryMetrics();
    const patterns = await loadJSON<GalaxyPatterns>(PATTERNS_FILE, {});
    const state = await loadJSON<any>(FABRIC_STATE, { global_budget_usd: 50, budget_consumed_usd: 0 });
    
    let base = await loadJSON<GalaxyManifest>(MANIFEST_PATH, {
      cluster_topology: { domains: { backend: { max_concurrency: 10 }, frontend: { max_concurrency: 10 } } },
      policy_matrix: {},
      consensus_engine: { min_confidence_score: 0.8 },
      supernova_triggers: { budget_exhaustion_pct: 80, error_rate_spike: 0.5 },
      audit_schema: { board_report_mapping: { cost_efficiency: { healing_attempts: -5 } } },
      telemetry_evolution: {},
      fleet_sync: {},
      version: "1.0.0"
    } as GalaxyManifest);

    // Initialize missing sections with defaults
    if (!base.supernova_triggers) base.supernova_triggers = { budget_exhaustion_pct: 80, error_rate_spike: 0.5 };
    if (!base.consensus_engine) base.consensus_engine = { min_confidence_score: 0.8 };
    if (!base.cluster_topology) base.cluster_topology = { domains: { backend: { max_concurrency: 10 }, frontend: { max_concurrency: 10 } } };
    if (!base.audit_schema) base.audit_schema = { board_report_mapping: { cost_efficiency: { healing_attempts: -5 } } };

    // Dynamic threshold adjustment based on telemetry
    const budgetPct = base.global_budget_usd && base.global_budget_usd > 0 ? (base.budget_consumed_usd / base.global_budget_usd) * 100 : 0;
    if (budgetPct > 70) {
      base.supernova_triggers.budget_exhaustion_pct = Math.max(60, base.supernova_triggers.budget_exhaustion_pct - 5);
    }
    if (tel.error_rate > 0.3) {
      base.consensus_engine.min_confidence_score = Math.min(0.9, base.consensus_engine.min_confidence_score + 0.05);
      base.supernova_triggers.error_rate_spike = Math.max(0.2, base.supernova_triggers.error_rate_spike - 0.05);
    }
    if (tel.avg_latency > 600) {
      const domains = base.cluster_topology.domains;
      if (domains.backend) domains.backend.max_concurrency = Math.max(2, domains.backend.max_concurrency - 1);
      if (domains.frontend) domains.frontend.max_concurrency = Math.max(2, domains.frontend.max_concurrency - 1);
    }

    // Pattern inheritance sync
    if (patterns.verification_thresholds) {
      base.audit_schema.board_report_mapping.cost_efficiency.healing_attempts = patterns.verification_thresholds.min_coverage_delta || -5;
    }

    base.generated_at = new Date().toISOString();
    base.version = "1.0." + (parseInt(base.version?.split(".")[2] || "0") + 1);

    await fs.writeFile(MANIFEST_PATH, JSON.stringify(base, null, 2));
    console.log(`✅ Galaxy manifest evolved to v${base.version} (budget:${budgetPct.toFixed(1)}% err:${(tel.error_rate*100).toFixed(1)}% lat:${Math.round(tel.avg_latency)}ms)`);
  }

  async validate(): Promise<boolean> {
    const m = await loadJSON<GalaxyManifest>(MANIFEST_PATH, {} as GalaxyManifest);
    const required = ["cluster_topology","policy_matrix","consensus_engine","supernova_triggers","audit_schema","telemetry_evolution","fleet_sync"];
    const missing = required.filter(k => !m[k]);
    if (missing.length > 0) { 
      console.log(`❌ Missing sections: ${missing.join(", ")}`); 
      return false; 
    }
    console.log("✅ Manifest schema valid");
    return true;
  }
}

async function main() {
  const gen = new SinGalaxyManifestGen();
  const [,, cmd] = process.argv;
  if (cmd === "evolve") {
    await gen.generate();
  } else if (cmd === "validate") {
    const valid = await gen.validate();
    process.exit(valid ? 0 : 1);
  } else {
    console.log("Usage: sin-galaxy-manifest-gen.ts <evolve|validate>");
    process.exit(1);
  }
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
