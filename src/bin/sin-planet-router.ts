#!/usr/bin/env tsx
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

// ─── PATHS & CONFIG ─────────────────────────────────────────────────────
const CFG_DIR = path.join(process.env.HOME || "", ".config", "opencode");
const LOCAL_DIR = path.join(process.cwd(), ".opencode");
const FABRIC_STATE = path.join(LOCAL_DIR, "fabric-state.json");
const BLACKBOARD_DIR = path.join(LOCAL_DIR, "swarm-blackboard");
const AUDIT_CHAIN = path.join(LOCAL_DIR, "audit-chain.jsonl");
const HMAC_SECRET = process.env.SIN_HMAC_SECRET || "sin-galaxy-zero-trust";

export interface RouteDecision {
  target_planet: string;
  status: "allow" | "throttle" | "reroute" | "block";
  reason: string;
  budget_allocated: number;
  risk_score: number;
  confidence: number;
}

export interface GravityPolicy {
  allowed_domains: string[];
  max_budget_pct: number;
  max_risk_score: number;
  require_hmac: boolean;
  network_scope: "allow" | "deny";
  exec_scope: "sandbox" | "none";
}

// ─── HELPERS ────────────────────────────────────────────────────────────
function safeRun(cmd: string, cwd = process.cwd()): { ok: boolean; out: string; err?: string } {
  try { return { ok: true, out: execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe","pipe","pipe"], timeout: 8000 }).trim() }; }
  catch (e: any) { return { ok: false, out: "", err: e.stderr?.toString() || e.message }; }
}

async function loadState(): Promise<any> {
  try { return JSON.parse(await fs.readFile(FABRIC_STATE, "utf-8")); }
  catch { return { temples: {}, global_budget_usd: 50, budget_consumed_usd: 0, active_concurrency: 0, max_concurrency: 8 }; }
}

async function appendAudit(entry: any) {
  const raw = await fs.readFile(AUDIT_CHAIN, "utf-8").catch(() => "");
  const lines = raw.split("\n").filter(Boolean);
  const parentHash = lines.length > 0 ? JSON.parse(lines[lines.length-1]).merkle_hash : "genesis";
  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(entry, Object.keys(entry).sort())).digest("hex");
  const merkleHash = crypto.createHash("sha256").update(`${parentHash}:${payloadHash}:${Date.now()}`).digest("hex");
  const hmac = crypto.createHmac("sha256", HMAC_SECRET);
  hmac.update(JSON.stringify({ ...entry, parent_hash: parentHash, payload_hash: payloadHash, ts: Date.now() }));
  const auditEntry = { ...entry, parent_hash: parentHash, payload_hash: payloadHash, merkle_hash: merkleHash, signature: hmac.digest("hex"), ts: Date.now() };
  await fs.appendFile(AUDIT_CHAIN, JSON.stringify(auditEntry) + "\n");
}

// ─── CORE ROUTING ENGINE ────────────────────────────────────────────────
export function analyzeDomain(description: string, context: string): { domain: string; confidence: number } {
  const text = `${description} ${context}`.toLowerCase();
  const scores: Record<string, number> = {
    research: 0, backend: 0, frontend: 0, infra: 0, security: 0, data: 0, qa: 0
  };
  const rules: Record<string, RegExp[]> = {
    research: [/research|explore|find|docs|api discovery|market|competitor/i],
    backend: [/backend|api|server|middleware|auth|database|prisma|sql|microservice/i],
    frontend: [/frontend|ui|ux|dashboard|react|vue|svelte|css|tailwind|component/i],
    infra: [/deploy|ci|cd|docker|k8s|monitoring|cloud|oci|vm|network|proxy/i],
    security: [/security|audit|vuln|secret|policy|compliance|zero-trust|penetration/i],
    data: [/data|pipeline|etl|warehouse|analytics|ml|training|vector|embed/i],
    qa: [/test|spec|e2e|playwright|jest|coverage|debug|flaky|assertion/i]
  };
  for (const [domain, patterns] of Object.entries(rules)) {
    for (const p of patterns) {
      const matches = text.match(p);
      if (matches) scores[domain] += matches.length * 2;
    }
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const confidence = Math.min(1, best[1] / 6);
  return { domain: best[0], confidence };
}

export async function evaluateConstraints(domain: string, state: any): Promise<RouteDecision> {
  const budgetRemaining = state.global_budget_usd - state.budget_consumed_usd;
  const concurrencyHeadroom = state.max_concurrency - state.active_concurrency;
  
  let risk = 0.2;
  if (domain === "security") risk += 0.4;
  if (domain === "infra") risk += 0.3;
  if (domain === "data") risk += 0.2;
  if (budgetRemaining < 10) risk += 0.2;
  risk = Math.min(1, parseFloat(risk.toFixed(2)));

  let status: RouteDecision["status"] = "allow";
  let reason = "constraints_met";
  let budgetAlloc = Math.max(2, budgetRemaining * 0.15);

  if (risk > 0.8) { status = "block"; reason = "high_risk_requires_review"; budgetAlloc = 0; }
  else if (risk > 0.6 || budgetRemaining < 15) { status = "throttle"; reason = "risk_or_budget_elevated"; budgetAlloc *= 0.5; }
  else if (concurrencyHeadroom < 2) { status = "reroute"; reason = "concurrency_cap_reached"; budgetAlloc *= 0.7; }

  return { target_planet: domain, status, reason, budget_allocated: parseFloat(budgetAlloc.toFixed(2)), risk_score: risk, confidence: 0.85 };
}

export function enforceGravityPolicy(domain: string, payload: any, policy: GravityPolicy): { valid: boolean; reason?: string } {
  if (!policy.allowed_domains.includes(domain)) return { valid: false, reason: "domain_not_allowed" };
  if (policy.require_hmac && !payload.signature) return { valid: false, reason: "hmac_missing" };
  if (policy.network_scope === "deny" && /http|fetch|curl|api\.|web/i.test(JSON.stringify(payload))) return { valid: false, reason: "network_denied_by_policy" };
  if (policy.exec_scope === "none" && /exec|spawn|shell|bash|sh -c/i.test(JSON.stringify(payload))) return { valid: false, reason: "exec_denied_by_policy" };
  return { valid: true };
}

export async function dispatchCrossPlanet(taskId: string, domain: string, description: string, budget: number, state: any): Promise<{ dispatched: boolean; session_id?: string; error?: string }> {
  const contractPayload = { from: "planet_router", to: domain, phase: "dispatch", artifact: { taskId, description, budget }, ts: Date.now() };
  const hmac = crypto.createHmac("sha256", HMAC_SECRET);
  hmac.update(`${contractPayload.from}:${contractPayload.to}:${JSON.stringify(contractPayload.artifact, Object.keys(contractPayload.artifact).sort())}:${contractPayload.ts}`);
  const signature = hmac.digest("hex");
  const signedContract = { ...contractPayload, signature };

  // CRDT Blackboard Sync
  const bbPath = path.join(BLACKBOARD_DIR, `planet:${domain}:handoff.json`);
  await fs.writeFile(bbPath, JSON.stringify(signedContract, null, 2));

  // Audit Trail
  await appendAudit({ type: "planet_dispatch", domain, task_id: taskId, budget, signature: signature.slice(0, 16) });

  // Native OpenCode Dispatch
  try {
    const session = await (global as any).task?.({
      subagent_type: domain === "research" ? "athena" : domain === "frontend" ? "iris" : domain === "security" ? "aegis" : "atlas",
      run_in_background: true,
      description: `[PLANET:${domain.toUpperCase()}] ${description}`,
      meta: { plugin: "oh-my-open-sin", planet: domain, task_id: taskId, budget_allocated: budget, fabric_route: true }
    });
    return { dispatched: true, session_id: session?.id };
  } catch (e: any) {
    return { dispatched: false, error: e.message };
  }
}

// ─── CLI ROUTER ─────────────────────────────────────────────────────────
async function main() {
  const [,, cmd, ...args] = process.argv;
  const state = await loadState();

  switch (cmd) {
    case "route": {
      const [desc, ctx] = args;
      if (!desc) { console.log("Usage: route <description> [context]"); process.exit(1); }
      const { domain, confidence } = analyzeDomain(desc, ctx || "");
      const decision = await evaluateConstraints(domain, state);
      const policy: GravityPolicy = { allowed_domains: ["research","backend","frontend","infra","security","data","qa"], max_budget_pct: 80, max_risk_score: 0.7, require_hmac: true, network_scope: "allow", exec_scope: "sandbox" };
      const gravity = enforceGravityPolicy(domain, { description: desc }, policy);
      
      console.log(JSON.stringify({ domain, confidence, decision, gravity, ts: Date.now() }, null, 2));
      break;
    }
    case "dispatch": {
      const [taskId, domain, desc, budget] = args;
      if (!taskId || !domain || !desc || !budget) { console.log("Usage: dispatch <taskId> <domain> <desc> <budget>"); process.exit(1); }
      const res = await dispatchCrossPlanet(taskId, domain, desc, parseFloat(budget), state);
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    default:
      console.log("Usage: sin-planet-router.ts <route|dispatch> [args]");
      process.exit(1);
  }
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
