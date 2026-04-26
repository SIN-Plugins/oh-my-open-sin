import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { structuredLog } from "./telemetry";

export interface TestResultV2 {
  passed: boolean;
  coverage_pct: number;
  coverage_delta: number; // vs baseline
  failed_tests: string[];
  flaky_tests: string[];
  framework: string;
  raw_output: string;
}

function safeRun(cmd: string, cwd = process.cwd()): { ok: boolean; out: string; err?: string } {
  try { return { ok: true, out: execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 120000 }).trim() }; }
  catch (e: any) { return { ok: false, out: e.stdout?.toString() || "", err: e.stderr?.toString() || e.message }; }
}

async function loadBaselineCoverage(baselineDir?: string): Promise<number> {
  if (!baselineDir) return 0;
  try {
    const raw = await fs.readFile(path.join(baselineDir, "coverage-baseline.json"), "utf-8");
    return JSON.parse(raw).coverage_pct || 0;
  } catch { return 0; }
}

export async function runTestsV2(testCmd: string, cwd = process.cwd(), baselineDir?: string): Promise<TestResultV2> {
  const res = safeRun(testCmd, cwd);
  const output = res.out + "\n" + (res.err || "");
  
  let framework = "unknown";
  let passed = res.ok;
  let coverage_pct = 0;
  const failed_tests: string[] = [];
  const flaky_tests: string[] = [];

  if (/jest|vitest|react-scripts|next test/i.test(output)) framework = "js";
  else if (/pytest|unittest|coverage run/i.test(output)) framework = "python";
  else if (/go test/i.test(output)) framework = "go";

  // Coverage extraction (JSON/LCOV fallback)
  const covJsonPath = path.join(cwd, "coverage/coverage-final.json");
  const covSummaryPath = path.join(cwd, "coverage/coverage-summary.json");
  if (await fs.stat(covSummaryPath).catch(() => null)) {
    try {
      const summary = JSON.parse(await fs.readFile(covSummaryPath, "utf-8"));
      coverage_pct = summary.total?.lines?.pct || summary.total?.statements?.pct || 0;
    } catch {}
  } else {
    const covMatch = output.match(/(?:coverage|stmts|lines|branches|functions).*?(\d+(?:\.\d+)?)%/i);
    if (covMatch) coverage_pct = parseFloat(covMatch[1]);
  }

  // Failed & Flaky detection
  const failRegex = /(?:FAIL|✕|failed|Error:).*?(?:test|spec|it)\s*["']?([^"'\n]+)["']?/gi;
  let m;
  while ((m = failRegex.exec(output)) !== null) failed_tests.push(m[1].trim());

  // Flaky heuristic: retry success markers or explicit flaky tags
  const flakyRegex = /(?:retry|flaky|unstable|passed on retry).*?["']?([^"'\n]+)["']?/gi;
  while ((m = flakyRegex.exec(output)) !== null) flaky_tests.push(m[1].trim());

  if (failed_tests.length > 0) passed = false;

  const baseline = await loadBaselineCoverage(baselineDir);
  const coverage_delta = parseFloat((coverage_pct - baseline).toFixed(2));

  // Save new baseline if passed
  if (passed && baselineDir) {
    await fs.mkdir(baselineDir, { recursive: true });
    await fs.writeFile(path.join(baselineDir, "coverage-baseline.json"), JSON.stringify({ coverage_pct, ts: Date.now() }));
  }

  structuredLog("info", "test_verification_v2", { framework, passed, coverage_pct, coverage_delta, failed: failed_tests.length, flaky: flaky_tests.length });
  return { passed, coverage_pct, coverage_delta, failed_tests, flaky_tests, framework, raw_output: output.slice(0, 1500) };
}
