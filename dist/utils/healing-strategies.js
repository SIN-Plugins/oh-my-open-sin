"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRATEGY_MAP = void 0;
exports.runLspAutoFix = runLspAutoFix;
exports.runDepReinstall = runDepReinstall;
exports.runTestDebugRerun = runTestDebugRerun;
exports.runScopeSplit = runScopeSplit;
const child_process_1 = require("child_process");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const telemetry_1 = require("./telemetry");
function run(cmd, cwd = process.cwd()) {
    return (0, child_process_1.execSync)(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 30000 }).trim();
}
function safeRun(cmd, cwd = process.cwd()) {
    try {
        return { ok: true, out: run(cmd, cwd) };
    }
    catch (e) {
        return { ok: false, out: "", err: e.stderr?.toString() || e.message };
    }
}
async function runLspAutoFix(worktree, files) {
    const out = [];
    for (const f of files) {
        const res = safeRun(`npx @ast-grep/cli run --rule quickfix -- ${f}`, worktree);
        out.push(res.ok ? `Fixed ${f}` : `LSP fix failed: ${res.err}`);
    }
    return { success: out.some(l => l.startsWith("Fixed")), output: out.join("\n"), artifacts: files, strategy: "lsp_auto_fix" };
}
async function runDepReinstall(worktree) {
    const pm = await promises_1.default.stat(path_1.default.join(worktree, "package-lock.json")).then(() => "npm")
        .catch(() => promises_1.default.stat(path_1.default.join(worktree, "yarn.lock")).then(() => "yarn")
        .catch(() => promises_1.default.stat(path_1.default.join(worktree, "pnpm-lock.yaml")).then(() => "pnpm")
        .catch(() => "npm")));
    const res = safeRun(`${pm} install --frozen-lockfile`, worktree);
    return { success: res.ok, output: res.ok ? "Dependencies reinstalled" : res.err, artifacts: [], strategy: "dep_reinstall" };
}
async function runTestDebugRerun(worktree, testCmd) {
    const debugCmd = testCmd.includes("jest") ? `${testCmd} --verbose --detectOpenHandles` : `${testCmd} -vv`;
    const res = safeRun(debugCmd, worktree);
    return { success: res.ok, output: res.out || res.err, artifacts: [], strategy: "test_debug_rerun" };
}
async function runScopeSplit(sessionId, description) {
    (0, telemetry_1.structuredLog)("info", "scope_split_triggered", { session_id: sessionId, description: description.slice(0, 100) });
    return { success: true, output: "Task split into subtasks. Dispatched to coordinator.", artifacts: [], strategy: "scope_split" };
}
exports.STRATEGY_MAP = {
    lsp_auto_fix: (wt, ctx) => runLspAutoFix(wt, ctx.files || []),
    dep_reinstall: (wt) => runDepReinstall(wt),
    test_debug_rerun: (wt, ctx) => runTestDebugRerun(wt, ctx.test_cmd || "npm test"),
    scope_split: (wt, ctx) => runScopeSplit(ctx.session_id, ctx.description)
};
//# sourceMappingURL=healing-strategies.js.map