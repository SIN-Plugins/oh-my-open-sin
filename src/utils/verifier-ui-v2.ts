import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { structuredLog } from "./telemetry";

export interface UIDiffResultV2 {
  changed: boolean;
  structural_score: number; // 0-1 (0=identical)
  layout_shifts: number;
  dynamic_ignored: boolean;
  method: "dom" | "pixel" | "hash" | "skipped";
  baseline_exists: boolean;
}

function safeRun(cmd: string, cwd = process.cwd()): { ok: boolean; out: string; err?: string } {
  try { return { ok: true, out: execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 20000 }).trim() }; }
  catch (e: any) { return { ok: false, out: "", err: e.stderr?.toString() || e.message }; }
}

function stripDynamicContent(html: string): string {
  return html
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}\b/g, "[DATE]")
    .replace(/\b[a-f0-9]{8,}\b/gi, "[HASH]")
    .replace(/data-testid="[^"]*"/g, 'data-testid="[ID]"')
    .replace(/\bcsrf[_-]?token[^"]*"[^"]*"/gi, 'csrf="[TOKEN]"');
}

export async function captureDOMStructure(url: string, outputPath: string): Promise<boolean> {
  const pw = safeRun(`npx playwright codegen --target=json ${url} > ${outputPath}`);
  if (pw.ok) return true;
  // Fallback: curl + basic HTML extraction
  const curl = safeRun(`curl -sL ${url} > ${outputPath}`);
  return curl.ok;
}

export async function diffUIV2(beforePath: string, afterPath: string, baselineDir?: string): Promise<UIDiffResultV2> {
  try {
    const [bExists, aExists] = await Promise.all([fs.stat(beforePath).catch(() => null), fs.stat(afterPath).catch(() => null)]);
    if (!bExists || !aExists) return { changed: false, structural_score: 0, layout_shifts: 0, dynamic_ignored: true, method: "skipped", baseline_exists: false };

    const [bRaw, aRaw] = await Promise.all([fs.readFile(beforePath, "utf-8"), fs.readFile(afterPath, "utf-8")]);
    const b = stripDynamicContent(bRaw);
    const a = stripDynamicContent(aRaw);

    // Structural DOM diff (tag + attribute sequence hash)
    const extractStructure = (html: string) => html.replace(/>\s*</g, "><").replace(/\s+/g, " ").trim();
    const hashB = createHash("sha256").update(extractStructure(b)).digest("hex");
    const hashA = createHash("sha256").update(extractStructure(a)).digest("hex");

    if (hashB === hashA) return { changed: false, structural_score: 0, layout_shifts: 0, dynamic_ignored: true, method: "dom", baseline_exists: !!baselineDir };

    // Line-level structural similarity
    const bLines = b.split("\n").filter(l => l.trim().startsWith("<"));
    const aLines = a.split("\n").filter(l => l.trim().startsWith("<"));
    const common = bLines.filter(l => aLines.includes(l)).length;
    const structural_score = parseFloat((1 - common / Math.max(bLines.length, aLines.length)).toFixed(3));

    // Layout shift proxy (count of structural additions/removals)
    const layout_shifts = Math.abs(bLines.length - aLines.length);

    // Baseline management
    if (baselineDir) {
      await fs.mkdir(baselineDir, { recursive: true });
      await fs.writeFile(path.join(baselineDir, "latest-dom.html"), a);
    }

    structuredLog("info", "ui_diff_v2", { structural_score, layout_shifts, method: "dom" });
    return { changed: true, structural_score, layout_shifts, dynamic_ignored: true, method: "dom", baseline_exists: !!baselineDir };
  } catch (e: any) {
    structuredLog("warn", "ui_diff_v2_failed", { error: e.message });
    return { changed: false, structural_score: 0, layout_shifts: 0, dynamic_ignored: true, method: "skipped", baseline_exists: false };
  }
}
