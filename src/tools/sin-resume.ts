#!/usr/bin/env tsx
import { listCheckpoints, loadCheckpoint } from "../utils/checkpoint-storage";
import { prepareResume } from "../utils/checkpoint-resume";

export async function SinResumeCLI(cmd: string, arg?: string): Promise<any> {
  if (cmd === "list") {
    const entries = await listCheckpoints();
    console.log(`📦 ${entries.length} checkpoints:`);
    for (const e of entries) {
      console.log(`  ${e.id} | ${e.phase} | ${new Date(e.ts).toISOString()} | ${(e.size/1024).toFixed(1)}KB`);
    }
    return entries;
  }

  if (cmd === "show" && arg) {
    const state = await loadCheckpoint(arg);
    if (!state) { console.log("❌ Not found"); throw new Error("Checkpoint not found"); }
    console.log(JSON.stringify(state, null, 2));
    return state;
  }

  if (cmd === "resume" && arg) {
    const payload = await prepareResume(arg);
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  }

  throw new Error("Usage: sin-resume <list|show|resume> [session_id]");
}

export async function sinResumeCLI(cmd: string, arg?: string): Promise<any> {
  return SinResumeCLI(cmd, arg);
}

async function main() {
  const [,, cmd, arg] = process.argv;
  
  try {
    await SinResumeCLI(cmd, arg);
  } catch (e: any) {
    console.error("❌", e.message);
    process.exit(1);
  }
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
