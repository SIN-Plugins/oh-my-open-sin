"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTestsV2 = runTestsV2;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const telemetry_1 = require("./telemetry");
function safeRun(cmd, cwd = process.cwd()) {
    try {
        return { ok: true, out: (0, child_process_1.execSync)(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 120000 }).trim() };
    }
    catch (e) {
        return { ok: false, out: e.stdout?.toString() || "", err: e.stderr?.toString() || e.message };
    }
}
async function loadBaselineCoverage(baselineDir) {
    if (!baselineDir)
        return 0;
    try {
        const raw = await promises_1.default.readFile(path_1.default.join(baselineDir, "coverage-baseline.json"), "utf-8");
        return JSON.parse(raw).coverage_pct || 0;
    }
    catch {
        return 0;
    }
}
async function runTestsV2(testCmd, cwd = process.cwd(), baselineDir) {
    const res = safeRun(testCmd, cwd);
    const output = res.out + "\n" + (res.err || "");
    let framework = "unknown";
    let passed = res.ok;
    let coverage_pct = 0;
    const failed_tests = [];
    const flaky_tests = [];
    if (/jest|vitest|react-scripts|next test/i.test(output))
        framework = "js";
    else if (/pytest|unittest|coverage run/i.test(output))
        framework = "python";
    else if (/go test/i.test(output))
        framework = "go";
    // Coverage extraction (JSON/LCOV fallback)
    const covJsonPath = path_1.default.join(cwd, "coverage/coverage-final.json");
    const covSummaryPath = path_1.default.join(cwd, "coverage/coverage-summary.json");
    if (await promises_1.default.stat(covSummaryPath).catch(() => null)) {
        try {
            const summary = JSON.parse(await promises_1.default.readFile(covSummaryPath, "utf-8"));
            coverage_pct = summary.total?.lines?.pct || summary.total?.statements?.pct || 0;
        }
        catch { }
    }
    else {
        const covMatch = output.match(/(?:coverage|stmts|lines|branches|functions).*?(\d+(?:\.\d+)?)%/i);
        if (covMatch)
            coverage_pct = parseFloat(covMatch[1]);
    }
    // Failed & Flaky detection
    const failRegex = /(?:FAIL|✕|failed|Error:).*?(?:test|spec|it)\s*["']?([^"'\n]+)["']?/gi;
    let m;
    while ((m = failRegex.exec(output)) !== null)
        failed_tests.push(m[1].trim());
    // Flaky heuristic: retry success markers or explicit flaky tags
    const flakyRegex = /(?:retry|flaky|unstable|passed on retry).*?["']?([^"'\n]+)["']?/gi;
    while ((m = flakyRegex.exec(output)) !== null)
        flaky_tests.push(m[1].trim());
    if (failed_tests.length > 0)
        passed = false;
    const baseline = await loadBaselineCoverage(baselineDir);
    const coverage_delta = parseFloat((coverage_pct - baseline).toFixed(2));
    // Save new baseline if passed
    if (passed && baselineDir) {
        await promises_1.default.mkdir(baselineDir, { recursive: true });
        await promises_1.default.writeFile(path_1.default.join(baselineDir, "coverage-baseline.json"), JSON.stringify({ coverage_pct, ts: Date.now() }));
    }
    (0, telemetry_1.structuredLog)("info", "test_verification_v2", { framework, passed, coverage_pct, coverage_delta, failed: failed_tests.length, flaky: flaky_tests.length });
    return { passed, coverage_pct, coverage_delta, failed_tests, flaky_tests, framework, raw_output: output.slice(0, 1500) };
}
//# sourceMappingURL=verifier-tests-v2.js.map