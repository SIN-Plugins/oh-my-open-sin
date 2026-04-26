"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePlanTemple = generatePlanTemple;
exports.resolveNextNodes = resolveNextNodes;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const telemetry_1 = require("./telemetry");
async function generatePlanTemple(goal, context, config) {
    const id = `temple-${Date.now()}`;
    // 1. Intent & Constraint Extraction (lightweight heuristic)
    const isComplex = /architect|system|scale|pipeline|infrastructure|enterprise/i.test(context);
    const isSecure = /security|audit|compliance|policy|zero-trust/i.test(context);
    const isUI = /ui|frontend|dashboard|design|ux/i.test(context);
    const baseNodes = [
        { id: "research", phase: "research", agent_role: "athena", description: "Multi-source discovery & API mapping", dependencies: [], constraints: { timeout_sec: 120, risk_level: "low" }, parallel_group: "discovery", status: "pending" },
        { id: "architecture", phase: "planning", agent_role: "prometheus", description: "System architecture & dependency graph", dependencies: ["research"], constraints: { timeout_sec: 180, risk_level: "medium" }, status: "pending" },
        { id: "security", phase: "validation", agent_role: "aegis", description: "Threat modeling & policy enforcement", dependencies: ["architecture"], constraints: { timeout_sec: 120, risk_level: "high" }, verification_gate: { type: "lsp_regression", threshold: 0 }, status: "pending" },
        { id: "execution_backend", phase: "execution", agent_role: "atlas", description: "Backend/API implementation", dependencies: ["security"], constraints: { timeout_sec: 300, risk_level: "medium" }, parallel_group: "build", verification_gate: { type: "test_coverage", threshold: 80 }, status: "pending" },
        { id: "execution_frontend", phase: "execution", agent_role: "iris", description: "UI/UX implementation", dependencies: ["security"], constraints: { timeout_sec: 300, risk_level: "medium" }, parallel_group: "build", verification_gate: { type: "ui_diff", threshold: 0.4 }, status: "pending" },
        { id: "integration", phase: "validation", agent_role: "hephaestus", description: "Cross-layer integration & E2E verification", dependencies: ["execution_backend", "execution_frontend"], constraints: { timeout_sec: 240, risk_level: "high" }, verification_gate: { type: "consensus", threshold: 0.85 }, status: "pending" }
    ];
    if (isComplex)
        baseNodes.push({ id: "scaling", phase: "planning", agent_role: "chronos", description: "Scalability & future-proofing", dependencies: ["architecture"], constraints: { timeout_sec: 150, risk_level: "medium" }, parallel_group: "planning", status: "pending" });
    if (isSecure)
        baseNodes.push({ id: "penetration", phase: "validation", agent_role: "nemesis", description: "Adversarial failure injection", dependencies: ["security"], constraints: { timeout_sec: 120, risk_level: "high" }, parallel_group: "validation", status: "pending" });
    if (isUI)
        baseNodes.push({ id: "ux_refinement", phase: "execution", agent_role: "apollo", description: "UX polish & accessibility", dependencies: ["execution_frontend"], constraints: { timeout_sec: 180, risk_level: "low" }, parallel_group: "polish", status: "pending" });
    // 2. Hypergraph resolution
    const hypergraph = {};
    for (const n of baseNodes) {
        for (const dep of n.dependencies) {
            if (!hypergraph[dep])
                hypergraph[dep] = [];
            hypergraph[dep].push(n.id);
        }
    }
    // 3. Resource mapping
    const resource_map = {};
    const groups = [...new Set(baseNodes.map(n => n.parallel_group).filter((g) => !!g))];
    for (const g of groups) {
        resource_map[g] = { max_concurrency: 4, budget_allocation_pct: Math.round(100 / groups.length) };
    }
    const temple = { id, goal, nodes: baseNodes, hypergraph, resource_map, ts: Date.now() };
    // Persist
    const templeDir = path_1.default.join(process.cwd(), ".opencode", "plan-temples");
    await promises_1.default.mkdir(templeDir, { recursive: true });
    await promises_1.default.writeFile(path_1.default.join(templeDir, `${id}.json`), JSON.stringify(temple, null, 2));
    (0, telemetry_1.structuredLog)("info", "plan_temple_generated", { temple_id: id, nodes: baseNodes.length, groups: groups.length });
    return temple;
}
async function resolveNextNodes(templeId, completedNodeId) {
    const templeDir = path_1.default.join(process.cwd(), ".opencode", "plan-temples");
    const raw = await promises_1.default.readFile(path_1.default.join(templeDir, `${templeId}.json`), "utf-8");
    const temple = JSON.parse(raw);
    // Mark completed
    const node = temple.nodes.find(n => n.id === completedNodeId);
    if (node)
        node.status = "completed";
    // Find unblocked dependents
    const next = [];
    for (const depId of temple.hypergraph[completedNodeId] || []) {
        const dep = temple.nodes.find(n => n.id === depId);
        if (!dep || dep.status !== "pending")
            continue;
        const allDepsMet = dep.dependencies.every(d => temple.nodes.find(n => n.id === d)?.status === "completed");
        if (allDepsMet) {
            dep.status = "running";
            next.push(dep);
        }
    }
    await promises_1.default.writeFile(path_1.default.join(templeDir, `${templeId}.json`), JSON.stringify(temple, null, 2));
    return next;
}
//# sourceMappingURL=plan-temple.js.map