import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { structuredLog } from "./telemetry";

export interface LSPResultV2 {
  clean: boolean;
  new_errors: number;
  total_errors: number;
  warnings: number;
  files: string[];
  regression_blocked: boolean;
}

function safeRun(cmd: string, cwd = process.cwd()): { ok: boolean; out: string; err?: string } {
  try { return { ok: true, out: execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 45000 }).trim() }; }
  catch (e: any) { return { ok: false, out: e.stdout?.toString() || "", err: e.stderr?.toString() || e.message }; }
}

async function loadBaselineErrors(baselineDir?: string): Promise<Set<string>> {
  if (!baselineDir) return new Set();
  try {
    const raw = await fs.readFile(path.join(baselineDir, "lsp-baseline.json"), "utf-8");
    return new Set(JSON.parse(raw).errors || []);
  } catch { return new Set(); }
}

export async function runLSPV2(cwd = process.cwd(), baselineDir?: string): Promise<LSPResultV2> {
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
    if (res.out || res.err) output += res.out + "\n" + res.err + "\n";
  }

  // Parse standard diagnostic format
  const diagRegex = /([^:]+):(\d+):(\d+):\s*(error|warning)\s*(.*)/gi;
  const errors: string[] = [];
  const warnings: string[] = [];
  let m;
  while ((m = diagRegex.exec(output)) !== null) {
    const key = `${m[1]}:${m[2]}:${m[4]}`;
    if (m[4] === "error") errors.push(key);
    else warnings.push(key);
  }

  const baselineErrors = await loadBaselineErrors(baselineDir);
  const newErrors = errors.filter(e => !baselineErrors.has(e));
  
  // Save baseline
  if (baselineDir) {
    await fs.mkdir(baselineDir, { recursive: true });
    await fs.writeFile(path.join(baselineDir, "lsp-baseline.json"), JSON.stringify({ errors, ts: Date.now() }));
  }

  const regression_blocked = newErrors.length > 0;
  structuredLog("info", "lsp_verification_v2", { total_errors: errors.length, new_errors: newErrors.length, warnings: warnings.length, regression_blocked });
  
  return {
    clean: newErrors.length === 0,
    new_errors: newErrors.length,
    total_errors: errors.length,
    warnings: warnings.length,
    files: [...new Set(errors.map(e => e.split(":")[0]))],
    regression_blocked
  };
}
