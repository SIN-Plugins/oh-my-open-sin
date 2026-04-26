import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { structuredLog } from "./telemetry";
import { CheckpointState, serializeState, deserializeState } from "./checkpoint-state";

const CKPT_DIR = path.join(process.cwd(), ".opencode", "checkpoints", "state");
const MAX_RETENTION = 14 * 24 * 60 * 60 * 1000; // 14 days

async function ensureDir() {
  await fs.mkdir(CKPT_DIR, { recursive: true });
}

export async function saveCheckpoint(state: Omit<CheckpointState, "checksum">): Promise<string> {
  await ensureDir();
  const id = state.session_id;
  const json = serializeState(state);
  const tmpPath = path.join(CKPT_DIR, `${id}.json.tmp`);
  const finalPath = path.join(CKPT_DIR, `${id}.json`);
  
  await fs.writeFile(tmpPath, json, "utf-8");
  await fs.rename(tmpPath, finalPath);
  
  structuredLog("info", "state_checkpoint_saved", { session_id: id, phase: state.phase, size_bytes: Buffer.byteLength(json) });
  return id;
}

export async function loadCheckpoint(sessionId: string): Promise<CheckpointState | null> {
  await ensureDir();
  const filePath = path.join(CKPT_DIR, `${sessionId}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return deserializeState(raw);
  } catch (e: any) {
    if (e.code === "ENOENT") return null;
    structuredLog("warn", "state_checkpoint_load_failed", { session_id: sessionId, error: e.message });
    return null;
  }
}

export async function listCheckpoints(): Promise<{ id: string; phase: string; ts: number; size: number }[]> {
  await ensureDir();
  const files = await fs.readdir(CKPT_DIR).catch(() => []);
  const entries: { id: string; phase: string; ts: number; size: number }[] = [];
  for (const f of files.filter(f => f.endsWith(".json"))) {
    try {
      const raw = await fs.readFile(path.join(CKPT_DIR, f), "utf-8");
      const state = JSON.parse(raw);
      entries.push({ id: state.session_id, phase: state.phase, ts: state.timestamp, size: Buffer.byteLength(raw) });
    } catch {}
  }
  return entries.sort((a, b) => b.ts - a.ts);
}

export async function cleanupStaleCheckpoints(): Promise<number> {
  await ensureDir();
  const cutoff = Date.now() - MAX_RETENTION;
  const files = await fs.readdir(CKPT_DIR).catch(() => []);
  let removed = 0;
  for (const f of files) {
    try {
      const p = path.join(CKPT_DIR, f);
      const stat = await fs.stat(p);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(p);
        removed++;
      }
    } catch {}
  }
  structuredLog("info", "state_checkpoints_cleaned", { removed });
  return removed;
}
