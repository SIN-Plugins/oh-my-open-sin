import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { structuredLog } from "./telemetry";

const BLACKBOARD_DIR = path.join(process.cwd(), ".opencode", "swarm-blackboard");
const MAX_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface BlackboardEntry {
  key: string;
  value: any;
  version: number;
  author: string;
  ts: number;
  hash: string;
}

async function ensureDir() { await fs.mkdir(BLACKBOARD_DIR, { recursive: true }); }

function hashValue(val: any): string {
  return createHash("sha256").update(JSON.stringify(val, Object.keys(val).sort())).digest("hex").slice(0, 12);
}

export async function writeBlackboard(key: string, value: any, author: string): Promise<BlackboardEntry> {
  await ensureDir();
  const filePath = path.join(BLACKBOARD_DIR, `${key}.json`);
  let version = 1;
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const existing = JSON.parse(raw) as BlackboardEntry;
    version = existing.version + 1;
  } catch {}

  const entry: BlackboardEntry = { key, value, version, author, ts: Date.now(), hash: hashValue(value) };
  await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
  structuredLog("info", "blackboard_written", { key, version, author });
  return entry;
}

export async function readBlackboard(key: string): Promise<BlackboardEntry | null> {
  await ensureDir();
  const filePath = path.join(BLACKBOARD_DIR, `${key}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch { return null; }
}

export async function resolveConflict(key: string, newValue: any, author: string): Promise<BlackboardEntry> {
  const existing = await readBlackboard(key);
  if (!existing) return writeBlackboard(key, newValue, author);
  
  // Last-writer-wins with version bump + audit trail
  const merged = { ...existing.value, ...newValue };
  return writeBlackboard(key, merged, author);
}

export async function gcBlackboard(): Promise<number> {
  await ensureDir();
  const cutoff = Date.now() - MAX_RETENTION_MS;
  const files = await fs.readdir(BLACKBOARD_DIR).catch(() => []);
  let removed = 0;
  for (const f of files) {
    try {
      const p = path.join(BLACKBOARD_DIR, f);
      const stat = await fs.stat(p);
      if (stat.mtimeMs < cutoff) { await fs.unlink(p); removed++; }
    } catch {}
  }
  structuredLog("info", "blackboard_gc", { removed });
  return removed;
}
