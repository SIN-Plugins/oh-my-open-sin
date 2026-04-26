/**
 * Enhanced Skill Loader v2
 * Production-grade skill discovery, dependency resolution, MCP lifecycle management
 */

import fs from "fs/promises";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { validateSkillManifest, type SkillManifest } from "./skill-schema.js";

interface ActiveSkill {
  manifest: SkillManifest;
  mcp_pids: Record<string, number>;
  mcp_health: Record<string, boolean>;
  injected_at: number;
}

const SKILL_DIRS = [
  path.join(process.env.HOME || "", ".config", "opencode", "skills"),
  path.join(process.cwd(), ".opencode", "skills")
];

const activeSkills: Record<string, ActiveSkill[]> = {};
let skillCache: SkillManifest[] | null = null;
let cacheTimestamp = 0;

export async function discoverSkills(forceRefresh = false): Promise<SkillManifest[]> {
  if (!forceRefresh && skillCache && Date.now() - cacheTimestamp < 60000) {
    return skillCache;
  }
  
  const skills: SkillManifest[] = [];
  
  for (const dir of SKILL_DIRS) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(dir, entry.name, "skill.json");
        try {
          const raw = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
          skills.push(validateSkillManifest(raw));
        } catch (e: any) {
          console.warn(`[SkillLoader] skill_manifest_invalid: ${dir}/${entry.name} - ${e.message}`);
        }
      }
    } catch (e: any) {
      // Directory doesn't exist or not accessible
    }
  }
  
  skillCache = skills;
  cacheTimestamp = Date.now();
  return skills;
}

export function matchSkills(description: string, agent: string, allSkills: SkillManifest[]): SkillManifest[] {
  const descLower = description.toLowerCase();
  return allSkills.filter(s => {
    const agentMatch = s.agents.length === 0 || s.agents.includes(agent);
    const triggerMatch = s.triggers.some(t => descLower.includes(t.toLowerCase()));
    return agentMatch && triggerMatch;
  });
}

export async function resolveDependencies(
  skills: SkillManifest[], 
  allSkills: SkillManifest[]
): Promise<SkillManifest[]> {
  const resolved = new Map<string, SkillManifest>();
  const queue = [...skills];
  
  while (queue.length > 0) {
    const s = queue.shift()!;
    if (resolved.has(s.id)) continue;
    resolved.set(s.id, s);
    
    if (s.dependencies) {
      for (const depId of s.dependencies) {
        const dep = allSkills.find(x => x.id === depId);
        if (!dep) {
          throw new Error(`❌ Skill ${s.id} depends on missing skill: ${depId}`);
        }
        queue.push(dep);
      }
    }
  }
  
  return Array.from(resolved.values());
}

export async function startSkillMCPs(sessionId: string, skills: SkillManifest[]): Promise<void> {
  if (!skills.length) return;
  activeSkills[sessionId] = activeSkills[sessionId] || [];

  for (const skill of skills) {
    const active: ActiveSkill = { 
      manifest: skill, 
      mcp_pids: {}, 
      mcp_health: {}, 
      injected_at: Date.now() 
    };
    
    if (skill.mcp_servers) {
      for (const [name, cfg] of Object.entries(skill.mcp_servers)) {
        try {
          const proc = spawn(cfg.command, cfg.args, {
            env: { ...process.env, ...cfg.env },
            stdio: ["pipe", "pipe", "pipe"],
            detached: true
          });
          proc.unref();
          active.mcp_pids[name] = proc.pid!;
          active.mcp_health[name] = true;
          
          proc.stderr?.on("data", (d) => {
            const msg = d.toString();
            if (msg.includes("error") || msg.includes("fatal")) {
              active.mcp_health[name] = false;
              console.error(`[SkillLoader] skill_mcp_stderr: session=${sessionId}, skill=${skill.id}, mcp=${name}, log=${msg.slice(0, 200)}`);
            }
          });
          
          proc.on("exit", (code) => {
            active.mcp_health[name] = false;
            console.warn(`[SkillLoader] skill_mcp_exited: session=${sessionId}, skill=${skill.id}, mcp=${name}, code=${code}`);
          });

          console.log(`[SkillLoader] skill_mcp_started: session=${sessionId}, skill=${skill.id}, mcp=${name}, pid=${proc.pid}`);
        } catch (e: any) {
          console.warn(`[SkillLoader] skill_mcp_start_failed: session=${sessionId}, skill=${skill.id}, mcp=${name}, error=${e.message}`);
        }
      }
    }
    activeSkills[sessionId].push(active);
  }
}

export async function stopSkillMCPs(sessionId: string): Promise<void> {
  const skills = activeSkills[sessionId];
  if (!skills) return;

  for (const active of skills) {
    for (const [name, pid] of Object.entries(active.mcp_pids)) {
      try {
        process.kill(pid, "SIGTERM");
        console.log(`[SkillLoader] skill_mcp_stopped: session=${sessionId}, skill=${active.manifest.id}, mcp=${name}, pid=${pid}`);
      } catch {
        try { 
          process.kill(pid, "SIGKILL"); 
        } catch {}
      }
    }
  }
  delete activeSkills[sessionId];
  console.log(`[SkillLoader] skill_session_cleaned: session=${sessionId}`);
}

export function getSkillPromptInjection(sessionId: string): string {
  const skills = activeSkills[sessionId];
  if (!skills) return "";
  return skills
    .map(s => s.manifest.system_prompt_injection)
    .filter(Boolean)
    .join("\n\n");
}

export function getSkillPermissions(sessionId: string): Record<string, any> {
  const skills = activeSkills[sessionId];
  if (!skills) return {};
  
  const merged: any = { fs: "deny", network: "deny", exec: "none" };
  
  for (const s of skills) {
    if (s.manifest.permissions) {
      if (s.manifest.permissions.fs === "write") merged.fs = "write";
      else if (s.manifest.permissions.fs === "read" && merged.fs !== "write") merged.fs = "read";
      
      if (s.manifest.permissions.network === "allow") merged.network = "allow";
      
      if (s.manifest.permissions.exec === "sandbox") merged.exec = "sandbox";
    }
  }
  
  return merged;
}

export function getSkillHealth(sessionId: string): Record<string, boolean> {
  const skills = activeSkills[sessionId];
  if (!skills) return {};
  
  const health: Record<string, boolean> = {};
  for (const s of skills) {
    for (const [mcp, ok] of Object.entries(s.mcp_health)) {
      health[`${s.manifest.id}:${mcp}`] = ok;
    }
  }
  return health;
}
