import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { structuredLog } from "./telemetry";

const CKPT_DIR = path.join(process.cwd(), ".opencode", "checkpoints");

function run(cmd: string, cwd = process.cwd()): string {
  return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function safeRun(cmd: string, cwd = process.cwd()): { ok: boolean; out: string; err?: string } {
  try { return { ok: true, out: run(cmd, cwd) }; }
  catch (e: any) { return { ok: false, out: "", err: e.stderr?.toString() || e.message }; }
}

export interface CheckpointMeta {
  id: string;
  type: "git-ref" | "file-delta" | "milestone";
  hash: string;
  files?: string[];
  worktree?: string;
  ts: number;
  validation_passed?: boolean;
}

export async function createCheckpoint(sessionId: string, worktreePath?: string, milestone = false): Promise<CheckpointMeta> {
  const target = worktreePath || process.cwd();
  await fs.mkdir(CKPT_DIR, { recursive: true });

  const gitCheck = safeRun("git rev-parse --is-inside-work-tree", target);
  if (gitCheck.ok) {
    const treeHash = run("git write-tree", target);
    const parent = run("git rev-parse HEAD", target);
    const msg = milestone ? `sin-milestone:${sessionId}` : `sin-checkpoint:${sessionId}`;
    const commitHash = run(`git commit-tree ${treeHash} -p ${parent} -m "${msg}"`, target);
    const ref = `refs/sin-checkpoints/${sessionId}`;
    run(`git update-ref ${ref} ${commitHash}`, target);

    const meta: CheckpointMeta = { id: sessionId, type: "git-ref", hash: commitHash, worktree: target, ts: Date.now(), validation_passed: milestone };
    await fs.writeFile(path.join(CKPT_DIR, `${sessionId}.json`), JSON.stringify(meta, null, 2));
    structuredLog("info", "checkpoint_created", { session_id: sessionId, type: meta.type, milestone });
    return meta;
  }

  // Fallback: file-delta snapshot
  const files = await fs.readdir(target, { recursive: true }).catch(() => []);
  const hash = createHash("sha256");
  const tracked: string[] = [];
  for (const f of files.slice(0, 300)) {
    try {
      const full = path.join(target, f);
      if ((await fs.stat(full)).isFile()) {
        const content = await fs.readFile(full, "utf-8");
        hash.update(`${f}:${content.slice(0, 500)}`);
        tracked.push(f);
      }
    } catch {}
  }
  const meta: CheckpointMeta = { id: sessionId, type: "file-delta", hash: hash.digest("hex").slice(0, 16), files: tracked, worktree: target, ts: Date.now() };
  await fs.writeFile(path.join(CKPT_DIR, `${sessionId}.json`), JSON.stringify(meta, null, 2));
  structuredLog("info", "checkpoint_created", { session_id: sessionId, type: meta.type });
  return meta;
}

export async function rollbackPartial(sessionId: string, files: string[], worktreePath?: string): Promise<boolean> {
  const target = worktreePath || process.cwd();
  const gitCheck = safeRun("git rev-parse --is-inside-work-tree", target);
  if (!gitCheck.ok) return false;

  const ref = `refs/sin-checkpoints/${sessionId}`;
  const exists = safeRun(`git rev-parse --verify ${ref}`, target);
  if (!exists.ok) return false;

  for (const f of files) {
    safeRun(`git checkout ${ref} -- ${f}`, target);
  }
  structuredLog("info", "partial_rollback", { session_id: sessionId, files: files.length });
  return true;
}

export async function restoreCheckpoint(sessionId: string, worktreePath?: string): Promise<boolean> {
  const target = worktreePath || process.cwd();
  const gitCheck = safeRun("git rev-parse --is-inside-work-tree", target);
  if (gitCheck.ok) {
    const ref = `refs/sin-checkpoints/${sessionId}`;
    if (!safeRun(`git rev-parse --verify ${ref}`, target).ok) return false;
    run(`git checkout ${ref} -- .`, target);
    run("git clean -fd", target);
    structuredLog("info", "checkpoint_restored", { session_id: sessionId });
    return true;
  }
  return false;
}

export async function cleanupCheckpoints(maxAgeHours = 24): Promise<void> {
  try {
    const gitCheck = safeRun("git rev-parse --is-inside-work-tree");
    if (!gitCheck.ok) return;
    
    const refs = run("git for-each-ref --format='%(refname)' refs/sin-checkpoints/").split("\n").filter(Boolean);
    const cutoff = Date.now() - maxAgeHours * 3600000;
    for (const ref of refs) {
      const sessionId = ref.split("/").pop()!;
      const metaPath = path.join(CKPT_DIR, `${sessionId}.json`);
      try {
        const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
        if (meta.ts < cutoff) {
          safeRun(`git update-ref -d ${ref}`);
          await fs.unlink(metaPath).catch(() => {});
        }
      } catch {}
    }
  } catch {}
}
