import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { structuredLog } from "./telemetry";
import { diffUIV2, UIDiffResultV2 } from "./verifier-ui-v2";
import { runTestsV2, TestResultV2 } from "./verifier-tests-v2";
import { runLSPV2, LSPResultV2 } from "./verifier-lsp-v2";
import { updateMatrix } from "./healing-learner";

export interface VerificationConfigV2 {
  test_cmd?: string;
  min_coverage_delta?: number;
  max_new_lsp_errors?: number;
  max_ui_structural_score?: number;
  require_ui?: boolean;
  project_type?: "frontend" | "backend" | "fullstack" | "library";
}

export interface VerificationReportV2 {
  verified: boolean;
  score: number;
  ui: UIDiffResultV2;
  tests: TestResultV2;
  lsp: LSPResultV2;
  failures: string[];
  next_action: "pass" | "heal" | "escalate";
  cache_hit: boolean;
  ts: string;
}

const HANDOFF_JSON = path.join(process.cwd(), ".opencode", "handoff.json");
const CACHE_FILE = path.join(process.cwd(), ".opencode", "verify-cache.json");

async function getScopeHash(cwd: string): Promise<string> {
  const files = await fs.readdir(cwd, { recursive: true }).catch(() => []);
  const hash = createHash("sha256");
  for (const f of files.slice(0, 100)) {
    try {
      const full = path.join(cwd, f);
      if ((await fs.stat(full)).isFile()) hash.update(f + ":" + (await fs.readFile(full, "utf-8")).slice(0, 200));
    } catch {}
  }
  return hash.digest("hex").slice(0, 12);
}

export async function runVerificationGateV2(sessionId: string, cwd: string, cfg: VerificationConfigV2 = {}): Promise<VerificationReportV2> {
  const scopeHash = await getScopeHash(cwd);
  const cacheKey = `${scopeHash}|${cfg.project_type || "fullstack"}`;
  
  // Cache check
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8").catch(() => "{}");
    const cache: Record<string, { report: VerificationReportV2; ts: number }> = JSON.parse(raw);
    if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 15 * 60 * 1000) {
      cache[cacheKey].report.cache_hit = true;
      return cache[cacheKey].report;
    }
  } catch {}

  const baselineDir = path.join(cwd, ".opencode", "baselines", sessionId);
  const failures: string[] = [];
  let score = 100;

  // Parallel execution
  const [ui, tests, lsp] = await Promise.all([
    cfg.require_ui ? diffUIV2(
      path.join(cwd, ".opencode/screenshots", `${sessionId}-before.html`),
      path.join(cwd, ".opencode/screenshots", `${sessionId}-after.html`),
      baselineDir
    ) : Promise.resolve({ changed: false, structural_score: 0, layout_shifts: 0, dynamic_ignored: true, method: "skipped", baseline_exists: false } as UIDiffResultV2),
    runTestsV2(cfg.test_cmd || "npm test", cwd, baselineDir),
    runLSPV2(cwd, baselineDir)
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
    await updateMatrix("flaky_test", "test_flaky_quarantine", true);
  }
  if (lsp.new_errors > (cfg.max_new_lsp_errors ?? 0)) {
    failures.push(`New LSP errors: ${lsp.new_errors}`);
    score -= weights.lsp;
  }

  score = Math.max(0, score);
  const verified = failures.length === 0;
  const next_action = verified ? "pass" : score > 45 ? "heal" : "escalate";

  const report: VerificationReportV2 = { verified, score, ui, tests, lsp, failures, next_action, cache_hit: false, ts: new Date().toISOString() };

  // Cache & Handoff sync
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8").catch(() => "{}");
    const cache: Record<string, { report: VerificationReportV2; ts: number }> = JSON.parse(raw);
    cache[cacheKey] = { report, ts: Date.now() };
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
    
    const handoff = JSON.parse(await fs.readFile(HANDOFF_JSON, "utf-8").catch(() => "{}"));
    handoff.verification_v2 = report;
    await fs.writeFile(HANDOFF_JSON, JSON.stringify(handoff, null, 2));
  } catch {}

  structuredLog("info", "verification_gate_v2", { session_id: sessionId, verified, score, next_action, project_type: type, cache_hit: false });
  return report;
}
