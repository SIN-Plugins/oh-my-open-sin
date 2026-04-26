"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLSPV2 = runLSPV2;
const child_process_1 = require("child_process");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const telemetry_1 = require("./telemetry");
function safeRun(cmd, cwd = process.cwd()) {
    try {
        return { ok: true, out: (0, child_process_1.execSync)(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 45000 }).trim() };
    }
    catch (e) {
        return { ok: false, out: e.stdout?.toString() || "", err: e.stderr?.toString() || e.message };
    }
}
async function loadBaselineErrors(baselineDir) {
    if (!baselineDir)
        return new Set();
    try {
        const raw = await promises_1.default.readFile(path_1.default.join(baselineDir, "lsp-baseline.json"), "utf-8");
        return new Set(JSON.parse(raw).errors || []);
    }
    catch {
        return new Set();
    }
}
async function runLSPV2(cwd = process.cwd(), baselineDir) {
    let output = "";
    // Multi-language diagnostic collection
    const cmds = [
        "npx tsc --noEmit --pretty false",
        "npx eslint . --format compact --no-error-on-unmatched-pattern",
        "npx pylint --output-format=text src/ 2>/dev/null || true",
        "go vet ./... 2>&1 || true",
        "cargo clippy --message-format=short 2>&1 || true"
    ];
    for (const cmd of cmds) {
        const res = safeRun(cmd, cwd);
        if (res.out || res.err)
            output += res.out + "\n" + res.err + "\n";
    }
    // Parse standard diagnostic format
    const diagRegex = /([^:]+):(\d+):(\d+):\s*(error|warning)\s*(.*)/gi;
    const errors = [];
    const warnings = [];
    let m;
    while ((m = diagRegex.exec(output)) !== null) {
        const key = `${m[1]}:${m[2]}:${m[4]}`;
        if (m[4] === "error")
            errors.push(key);
        else
            warnings.push(key);
    }
    const baselineErrors = await loadBaselineErrors(baselineDir);
    const newErrors = errors.filter(e => !baselineErrors.has(e));
    // Save baseline
    if (baselineDir) {
        await promises_1.default.mkdir(baselineDir, { recursive: true });
        await promises_1.default.writeFile(path_1.default.join(baselineDir, "lsp-baseline.json"), JSON.stringify({ errors, ts: Date.now() }));
    }
    const regression_blocked = newErrors.length > 0;
    (0, telemetry_1.structuredLog)("info", "lsp_verification_v2", { total_errors: errors.length, new_errors: newErrors.length, warnings: warnings.length, regression_blocked });
    return {
        clean: newErrors.length === 0,
        new_errors: newErrors.length,
        total_errors: errors.length,
        warnings: warnings.length,
        files: [...new Set(errors.map(e => e.split(":")[0]))],
        regression_blocked
    };
}
//# sourceMappingURL=verifier-lsp-v2.js.map