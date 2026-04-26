import { createHash } from "crypto";

export interface CheckpointState {
  version: "1.0.0";
  session_id: string;
  parent_session?: string;
  timestamp: number;
  phase: string;
  agent: string;
  model: string;
  description: string;
  routing_context?: Record<string, any>;
  verification_state?: Record<string, any>;
  healing_state?: Record<string, any>;
  active_skills?: string[];
  pending_tasks?: string[];
  file_deltas?: Record<string, { hash: string; content?: string }>;
  metadata?: Record<string, any>;
  checksum?: string;
}

function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = sortKeys(obj[key]);
    return acc;
  }, {} as any);
}

export function serializeState(state: Omit<CheckpointState, "checksum">): string {
  const sorted = sortKeys(state);
  const json = JSON.stringify(sorted, null, 2);
  const checksum = createHash("sha256").update(json).digest("hex");
  return JSON.stringify({ ...sorted, checksum }, null, 2);
}

export function deserializeState(raw: string): CheckpointState {
  const parsed = JSON.parse(raw) as CheckpointState;
  const { checksum, ...rest } = parsed;
  const expected = createHash("sha256").update(JSON.stringify(sortKeys(rest), null, 2)).digest("hex");
  if (checksum !== expected) throw new Error(`❌ Checkpoint corrupted: checksum mismatch`);
  return parsed;
}
