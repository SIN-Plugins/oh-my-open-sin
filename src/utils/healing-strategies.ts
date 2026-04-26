import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { structuredLog } from "./telemetry";

function run(cmd: string, cwd = process.cwd()): string {
  return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 30000 }).trim();
}

function safeRun(cmd: string, cwd = process.cwd()): { ok: boolean; out: string; err?: string } {
  try { return { ok: true, out: run(cmd, cwd) }; }
  catch (e: any) { return { ok: false, out: "", err: e.stderr?.toString() || e.message }; }
}

export interface StrategyResult {
  success: boolean;
  output: string;
  artifacts: string[];
  strategy: string;
}

export async function runLspAutoFix(worktree: string, files: string[]): Promise<StrategyResult> {
  const out: string[] = [];
  for (const f of files) {
    const res = safeRun(`npx @ast-grep/cli run --rule quickfix -- ${f}`, worktree);
    out.push(res.ok ? `Fixed ${f}` : `LSP fix failed: ${res.err}`);
  }
  return { success: out.some(l => l.startsWith("Fixed")), output: out.join("\n"), artifacts: files, strategy: "lsp_auto_fix" };
}

export async function runDepReinstall(worktree: string): Promise<StrategyResult> {
  const pm = await fs.stat(path.join(worktree, "package-lock.json")).then(() => "npm")
    .catch(() => fs.stat(path.join(worktree, "yarn.lock")).then(() => "yarn")
    .catch(() => fs.stat(path.join(worktree, "pnpm-lock.yaml")).then(() => "pnpm")
    .catch(() => "npm")));
  const res = safeRun(`${pm} install --frozen-lockfile`, worktree);
  return { success: res.ok, output: res.ok ? "Dependencies reinstalled" : res.err!, artifacts: [], strategy: "dep_reinstall" };
}

export async function runTestDebugRerun(worktree: string, testCmd: string): Promise<StrategyResult> {
  const debugCmd = testCmd.includes("jest") ? `${testCmd} --verbose --detectOpenHandles` : `${testCmd} -vv`;
  const res = safeRun(debugCmd, worktree);
  return { success: res.ok, output: res.out || res.err!, artifacts: [], strategy: "test_debug_rerun" };
}

export async function runScopeSplit(sessionId: string, description: string): Promise<StrategyResult> {
  structuredLog("info", "scope_split_triggered", { session_id: sessionId, description: description.slice(0, 100) });
  return { success: true, output: "Task split into subtasks. Dispatched to coordinator.", artifacts: [], strategy: "scope_split" };
}

export const STRATEGY_MAP: Record<string, (wt: string, ctx: any) => Promise<StrategyResult>> = {
  lsp_auto_fix: (wt, ctx) => runLspAutoFix(wt, ctx.files || []),
  dep_reinstall: (wt) => runDepReinstall(wt),
  test_debug_rerun: (wt, ctx) => runTestDebugRerun(wt, ctx.test_cmd || "npm test"),
  scope_split: (wt, ctx) => runScopeSplit(ctx.session_id, ctx.description)
};
