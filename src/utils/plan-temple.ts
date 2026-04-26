import fs from "fs/promises";
import path from "path";
import { structuredLog } from "./telemetry";

export interface TempleNode {
  id: string;
  phase: string;
  agent_role: string;
  description: string;
  dependencies: string[];
  constraints: { max_tokens?: number; timeout_sec?: number; budget_pct?: number; risk_level?: "low"|"medium"|"high" };
  parallel_group?: string;
  verification_gate?: { type: string; threshold: number };
  status: "pending" | "running" | "completed" | "failed" | "blocked";
}

export interface PlanTemple {
  id: string;
  goal: string;
  nodes: TempleNode[];
  hypergraph: Record<string, string[]>; // node_id → dependents
  resource_map: Record<string, { max_concurrency: number; budget_allocation_pct: number }>;
  ts: number;
}

export async function generatePlanTemple(goal: string, context: string, config: any): Promise<PlanTemple> {
  const id = `temple-${Date.now()}`;
  
  // 1. Intent & Constraint Extraction (lightweight heuristic)
  const isComplex = /architect|system|scale|pipeline|infrastructure|enterprise/i.test(context);
  const isSecure = /security|audit|compliance|policy|zero-trust/i.test(context);
  const isUI = /ui|frontend|dashboard|design|ux/i.test(context);
  
  const baseNodes: TempleNode[] = [
    { id: "research", phase: "research", agent_role: "athena", description: "Multi-source discovery & API mapping", dependencies: [], constraints: { timeout_sec: 120, risk_level: "low" }, parallel_group: "discovery", status: "pending" },
    { id: "architecture", phase: "planning", agent_role: "prometheus", description: "System architecture & dependency graph", dependencies: ["research"], constraints: { timeout_sec: 180, risk_level: "medium" }, status: "pending" },
    { id: "security", phase: "validation", agent_role: "aegis", description: "Threat modeling & policy enforcement", dependencies: ["architecture"], constraints: { timeout_sec: 120, risk_level: "high" }, verification_gate: { type: "lsp_regression", threshold: 0 }, status: "pending" },
    { id: "execution_backend", phase: "execution", agent_role: "atlas", description: "Backend/API implementation", dependencies: ["security"], constraints: { timeout_sec: 300, risk_level: "medium" }, parallel_group: "build", verification_gate: { type: "test_coverage", threshold: 80 }, status: "pending" },
    { id: "execution_frontend", phase: "execution", agent_role: "iris", description: "UI/UX implementation", dependencies: ["security"], constraints: { timeout_sec: 300, risk_level: "medium" }, parallel_group: "build", verification_gate: { type: "ui_diff", threshold: 0.4 }, status: "pending" },
    { id: "integration", phase: "validation", agent_role: "hephaestus", description: "Cross-layer integration & E2E verification", dependencies: ["execution_backend", "execution_frontend"], constraints: { timeout_sec: 240, risk_level: "high" }, verification_gate: { type: "consensus", threshold: 0.85 }, status: "pending" }
  ];

  if (isComplex) baseNodes.push({ id: "scaling", phase: "planning", agent_role: "chronos", description: "Scalability & future-proofing", dependencies: ["architecture"], constraints: { timeout_sec: 150, risk_level: "medium" }, parallel_group: "planning", status: "pending" });
  if (isSecure) baseNodes.push({ id: "penetration", phase: "validation", agent_role: "nemesis", description: "Adversarial failure injection", dependencies: ["security"], constraints: { timeout_sec: 120, risk_level: "high" }, parallel_group: "validation", status: "pending" });
  if (isUI) baseNodes.push({ id: "ux_refinement", phase: "execution", agent_role: "apollo", description: "UX polish & accessibility", dependencies: ["execution_frontend"], constraints: { timeout_sec: 180, risk_level: "low" }, parallel_group: "polish", status: "pending" });

  // 2. Hypergraph resolution
  const hypergraph: Record<string, string[]> = {};
  for (const n of baseNodes) {
    for (const dep of n.dependencies) {
      if (!hypergraph[dep]) hypergraph[dep] = [];
      hypergraph[dep].push(n.id);
    }
  }

  // 3. Resource mapping
  const resource_map: Record<string, any> = {};
  const groups = [...new Set(baseNodes.map(n => n.parallel_group).filter((g): g is string => !!g))];
  for (const g of groups) {
    resource_map[g] = { max_concurrency: 4, budget_allocation_pct: Math.round(100 / groups.length) };
  }

  const temple: PlanTemple = { id, goal, nodes: baseNodes, hypergraph, resource_map, ts: Date.now() };
  
  // Persist
  const templeDir = path.join(process.cwd(), ".opencode", "plan-temples");
  await fs.mkdir(templeDir, { recursive: true });
  await fs.writeFile(path.join(templeDir, `${id}.json`), JSON.stringify(temple, null, 2));
  
  structuredLog("info", "plan_temple_generated", { temple_id: id, nodes: baseNodes.length, groups: groups.length });
  return temple;
}

export async function resolveNextNodes(templeId: string, completedNodeId: string): Promise<TempleNode[]> {
  const templeDir = path.join(process.cwd(), ".opencode", "plan-temples");
  const raw = await fs.readFile(path.join(templeDir, `${templeId}.json`), "utf-8");
  const temple: PlanTemple = JSON.parse(raw);
  
  // Mark completed
  const node = temple.nodes.find(n => n.id === completedNodeId);
  if (node) node.status = "completed";
  
  // Find unblocked dependents
  const next: TempleNode[] = [];
  for (const depId of temple.hypergraph[completedNodeId] || []) {
    const dep = temple.nodes.find(n => n.id === depId);
    if (!dep || dep.status !== "pending") continue;
    const allDepsMet = dep.dependencies.every(d => temple.nodes.find(n => n.id === d)?.status === "completed");
    if (allDepsMet) {
      dep.status = "running";
      next.push(dep);
    }
  }
  
  await fs.writeFile(path.join(templeDir, `${templeId}.json`), JSON.stringify(temple, null, 2));
  return next;
}
