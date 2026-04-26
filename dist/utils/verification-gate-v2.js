"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runVerificationGateV2 = runVerificationGateV2;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const telemetry_1 = require("./telemetry");
const verifier_ui_v2_1 = require("./verifier-ui-v2");
const verifier_tests_v2_1 = require("./verifier-tests-v2");
const verifier_lsp_v2_1 = require("./verifier-lsp-v2");
const healing_learner_1 = require("./healing-learner");
const HANDOFF_JSON = path_1.default.join(process.cwd(), ".opencode", "handoff.json");
const CACHE_FILE = path_1.default.join(process.cwd(), ".opencode", "verify-cache.json");
async function getScopeHash(cwd) {
    const files = await promises_1.default.readdir(cwd, { recursive: true }).catch(() => []);
    const hash = (0, crypto_1.createHash)("sha256");
    for (const f of files.slice(0, 100)) {
        try {
            const full = path_1.default.join(cwd, f);
            if ((await promises_1.default.stat(full)).isFile())
                hash.update(f + ":" + (await promises_1.default.readFile(full, "utf-8")).slice(0, 200));
        }
        catch { }
    }
    return hash.digest("hex").slice(0, 12);
}
async function runVerificationGateV2(sessionId, cwd, cfg = {}) {
    const scopeHash = await getScopeHash(cwd);
    const cacheKey = `${scopeHash}|${cfg.project_type || "fullstack"}`;
    // Cache check
    try {
        const raw = await promises_1.default.readFile(CACHE_FILE, "utf-8").catch(() => "{}");
        const cache = JSON.parse(raw);
        if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 15 * 60 * 1000) {
            cache[cacheKey].report.cache_hit = true;
            return cache[cacheKey].report;
        }
    }
    catch { }
    const baselineDir = path_1.default.join(cwd, ".opencode", "baselines", sessionId);
    const failures = [];
    let score = 100;
    // Parallel execution
    const [ui, tests, lsp] = await Promise.all([
        cfg.require_ui ? (0, verifier_ui_v2_1.diffUIV2)(path_1.default.join(cwd, ".opencode/screenshots", `${sessionId}-before.html`), path_1.default.join(cwd, ".opencode/screenshots", `${sessionId}-after.html`), baselineDir) : Promise.resolve({ changed: false, structural_score: 0, layout_shifts: 0, dynamic_ignored: true, method: "skipped", baseline_exists: false }),
        (0, verifier_tests_v2_1.runTestsV2)(cfg.test_cmd || "npm test", cwd, baselineDir),
        (0, verifier_lsp_v2_1.runLSPV2)(cwd, baselineDir)
    ]);
    // Adaptive scoring per project type
    const type = cfg.project_type || "fullstack";
    const weights = type === "frontend" ? { ui: 40, test: 30, lsp: 30 } : type === "backend" ? { ui: 0, test: 50, lsp: 50 } : { ui: 25, test: 40, lsp: 35 };
    if (ui.changed && ui.structural_score > (cfg.max_ui_structural_score ?? 0.4)) {
        failures.push(`UI structural regression: ${ui.structural_score}`);
        score -= weights.ui;
    }
    if (!tests.passed) {
        failures.push(`Tests failed: ${tests.failed_tests.length}`);
        score -= weights.test * 0.7;
    }
    if (tests.coverage_delta < (cfg.min_coverage_delta ?? -5)) {
        failures.push(`Coverage delta ${tests.coverage_delta}% < threshold`);
        score -= weights.test * 0.3;
    }
    if (tests.flaky_tests.length > 0) {
        failures.push(`Flaky tests detected: ${tests.flaky_tests.length}`);
        score -= 5;
        await (0, healing_learner_1.updateMatrix)("flaky_test", "test_flaky_quarantine", true);
    }
    if (lsp.new_errors > (cfg.max_new_lsp_errors ?? 0)) {
        failures.push(`New LSP errors: ${lsp.new_errors}`);
        score -= weights.lsp;
    }
    score = Math.max(0, score);
    const verified = failures.length === 0;
    const next_action = verified ? "pass" : score > 45 ? "heal" : "escalate";
    const report = { verified, score, ui, tests, lsp, failures, next_action, cache_hit: false, ts: new Date().toISOString() };
    // Cache & Handoff sync
    try {
        const raw = await promises_1.default.readFile(CACHE_FILE, "utf-8").catch(() => "{}");
        const cache = JSON.parse(raw);
        cache[cacheKey] = { report, ts: Date.now() };
        await promises_1.default.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
        const handoff = JSON.parse(await promises_1.default.readFile(HANDOFF_JSON, "utf-8").catch(() => "{}"));
        handoff.verification_v2 = report;
        await promises_1.default.writeFile(HANDOFF_JSON, JSON.stringify(handoff, null, 2));
    }
    catch { }
    (0, telemetry_1.structuredLog)("info", "verification_gate_v2", { session_id: sessionId, verified, score, next_action, project_type: type, cache_hit: false });
    return report;
}
//# sourceMappingURL=verification-gate-v2.js.map