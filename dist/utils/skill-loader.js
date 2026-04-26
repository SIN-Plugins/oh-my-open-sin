"use strict";
/**
 * Enhanced Skill Loader v2
 * Production-grade skill discovery, dependency resolution, MCP lifecycle management
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverSkills = discoverSkills;
exports.matchSkills = matchSkills;
exports.resolveDependencies = resolveDependencies;
exports.startSkillMCPs = startSkillMCPs;
exports.stopSkillMCPs = stopSkillMCPs;
exports.getSkillPromptInjection = getSkillPromptInjection;
exports.getSkillPermissions = getSkillPermissions;
exports.getSkillHealth = getSkillHealth;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const skill_schema_js_1 = require("./skill-schema.js");
const SKILL_DIRS = [
    path_1.default.join(process.env.HOME || "", ".config", "opencode", "skills"),
    path_1.default.join(process.cwd(), ".opencode", "skills")
];
const activeSkills = {};
let skillCache = null;
let cacheTimestamp = 0;
async function discoverSkills(forceRefresh = false) {
    if (!forceRefresh && skillCache && Date.now() - cacheTimestamp < 60000) {
        return skillCache;
    }
    const skills = [];
    for (const dir of SKILL_DIRS) {
        try {
            const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory())
                    continue;
                const manifestPath = path_1.default.join(dir, entry.name, "skill.json");
                try {
                    const raw = JSON.parse(await promises_1.default.readFile(manifestPath, "utf-8"));
                    skills.push((0, skill_schema_js_1.validateSkillManifest)(raw));
                }
                catch (e) {
                    console.warn(`[SkillLoader] skill_manifest_invalid: ${dir}/${entry.name} - ${e.message}`);
                }
            }
        }
        catch (e) {
            // Directory doesn't exist or not accessible
        }
    }
    skillCache = skills;
    cacheTimestamp = Date.now();
    return skills;
}
function matchSkills(description, agent, allSkills) {
    const descLower = description.toLowerCase();
    return allSkills.filter(s => {
        const agentMatch = s.agents.length === 0 || s.agents.includes(agent);
        const triggerMatch = s.triggers.some(t => descLower.includes(t.toLowerCase()));
        return agentMatch && triggerMatch;
    });
}
async function resolveDependencies(skills, allSkills) {
    const resolved = new Map();
    const queue = [...skills];
    while (queue.length > 0) {
        const s = queue.shift();
        if (resolved.has(s.id))
            continue;
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
async function startSkillMCPs(sessionId, skills) {
    if (!skills.length)
        return;
    activeSkills[sessionId] = activeSkills[sessionId] || [];
    for (const skill of skills) {
        const active = {
            manifest: skill,
            mcp_pids: {},
            mcp_health: {},
            injected_at: Date.now()
        };
        if (skill.mcp_servers) {
            for (const [name, cfg] of Object.entries(skill.mcp_servers)) {
                try {
                    const proc = (0, child_process_1.spawn)(cfg.command, cfg.args, {
                        env: { ...process.env, ...cfg.env },
                        stdio: ["pipe", "pipe", "pipe"],
                        detached: true
                    });
                    proc.unref();
                    active.mcp_pids[name] = proc.pid;
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
                }
                catch (e) {
                    console.warn(`[SkillLoader] skill_mcp_start_failed: session=${sessionId}, skill=${skill.id}, mcp=${name}, error=${e.message}`);
                }
            }
        }
        activeSkills[sessionId].push(active);
    }
}
async function stopSkillMCPs(sessionId) {
    const skills = activeSkills[sessionId];
    if (!skills)
        return;
    for (const active of skills) {
        for (const [name, pid] of Object.entries(active.mcp_pids)) {
            try {
                process.kill(pid, "SIGTERM");
                console.log(`[SkillLoader] skill_mcp_stopped: session=${sessionId}, skill=${active.manifest.id}, mcp=${name}, pid=${pid}`);
            }
            catch {
                try {
                    process.kill(pid, "SIGKILL");
                }
                catch { }
            }
        }
    }
    delete activeSkills[sessionId];
    console.log(`[SkillLoader] skill_session_cleaned: session=${sessionId}`);
}
function getSkillPromptInjection(sessionId) {
    const skills = activeSkills[sessionId];
    if (!skills)
        return "";
    return skills
        .map(s => s.manifest.system_prompt_injection)
        .filter(Boolean)
        .join("\n\n");
}
function getSkillPermissions(sessionId) {
    const skills = activeSkills[sessionId];
    if (!skills)
        return {};
    const merged = { fs: "deny", network: "deny", exec: "none" };
    for (const s of skills) {
        if (s.manifest.permissions) {
            if (s.manifest.permissions.fs === "write")
                merged.fs = "write";
            else if (s.manifest.permissions.fs === "read" && merged.fs !== "write")
                merged.fs = "read";
            if (s.manifest.permissions.network === "allow")
                merged.network = "allow";
            if (s.manifest.permissions.exec === "sandbox")
                merged.exec = "sandbox";
        }
    }
    return merged;
}
function getSkillHealth(sessionId) {
    const skills = activeSkills[sessionId];
    if (!skills)
        return {};
    const health = {};
    for (const s of skills) {
        for (const [mcp, ok] of Object.entries(s.mcp_health)) {
            health[`${s.manifest.id}:${mcp}`] = ok;
        }
    }
    return health;
}
//# sourceMappingURL=skill-loader.js.map