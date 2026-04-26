"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckpoint = createCheckpoint;
exports.rollbackPartial = rollbackPartial;
exports.restoreCheckpoint = restoreCheckpoint;
exports.cleanupCheckpoints = cleanupCheckpoints;
const child_process_1 = require("child_process");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const telemetry_1 = require("./telemetry");
const CKPT_DIR = path_1.default.join(process.cwd(), ".opencode", "checkpoints");
function run(cmd, cwd = process.cwd()) {
    return (0, child_process_1.execSync)(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function safeRun(cmd, cwd = process.cwd()) {
    try {
        return { ok: true, out: run(cmd, cwd) };
    }
    catch (e) {
        return { ok: false, out: "", err: e.stderr?.toString() || e.message };
    }
}
async function createCheckpoint(sessionId, worktreePath, milestone = false) {
    const target = worktreePath || process.cwd();
    await promises_1.default.mkdir(CKPT_DIR, { recursive: true });
    const gitCheck = safeRun("git rev-parse --is-inside-work-tree", target);
    if (gitCheck.ok) {
        const treeHash = run("git write-tree", target);
        const parent = run("git rev-parse HEAD", target);
        const msg = milestone ? `sin-milestone:${sessionId}` : `sin-checkpoint:${sessionId}`;
        const commitHash = run(`git commit-tree ${treeHash} -p ${parent} -m "${msg}"`, target);
        const ref = `refs/sin-checkpoints/${sessionId}`;
        run(`git update-ref ${ref} ${commitHash}`, target);
        const meta = { id: sessionId, type: "git-ref", hash: commitHash, worktree: target, ts: Date.now(), validation_passed: milestone };
        await promises_1.default.writeFile(path_1.default.join(CKPT_DIR, `${sessionId}.json`), JSON.stringify(meta, null, 2));
        (0, telemetry_1.structuredLog)("info", "checkpoint_created", { session_id: sessionId, type: meta.type, milestone });
        return meta;
    }
    // Fallback: file-delta snapshot
    const files = await promises_1.default.readdir(target, { recursive: true }).catch(() => []);
    const hash = (0, crypto_1.createHash)("sha256");
    const tracked = [];
    for (const f of files.slice(0, 300)) {
        try {
            const full = path_1.default.join(target, f);
            if ((await promises_1.default.stat(full)).isFile()) {
                const content = await promises_1.default.readFile(full, "utf-8");
                hash.update(`${f}:${content.slice(0, 500)}`);
                tracked.push(f);
            }
        }
        catch { }
    }
    const meta = { id: sessionId, type: "file-delta", hash: hash.digest("hex").slice(0, 16), files: tracked, worktree: target, ts: Date.now() };
    await promises_1.default.writeFile(path_1.default.join(CKPT_DIR, `${sessionId}.json`), JSON.stringify(meta, null, 2));
    (0, telemetry_1.structuredLog)("info", "checkpoint_created", { session_id: sessionId, type: meta.type });
    return meta;
}
async function rollbackPartial(sessionId, files, worktreePath) {
    const target = worktreePath || process.cwd();
    const gitCheck = safeRun("git rev-parse --is-inside-work-tree", target);
    if (!gitCheck.ok)
        return false;
    const ref = `refs/sin-checkpoints/${sessionId}`;
    const exists = safeRun(`git rev-parse --verify ${ref}`, target);
    if (!exists.ok)
        return false;
    for (const f of files) {
        safeRun(`git checkout ${ref} -- ${f}`, target);
    }
    (0, telemetry_1.structuredLog)("info", "partial_rollback", { session_id: sessionId, files: files.length });
    return true;
}
async function restoreCheckpoint(sessionId, worktreePath) {
    const target = worktreePath || process.cwd();
    const gitCheck = safeRun("git rev-parse --is-inside-work-tree", target);
    if (gitCheck.ok) {
        const ref = `refs/sin-checkpoints/${sessionId}`;
        if (!safeRun(`git rev-parse --verify ${ref}`, target).ok)
            return false;
        run(`git checkout ${ref} -- .`, target);
        run("git clean -fd", target);
        (0, telemetry_1.structuredLog)("info", "checkpoint_restored", { session_id: sessionId });
        return true;
    }
    return false;
}
async function cleanupCheckpoints(maxAgeHours = 24) {
    try {
        const gitCheck = safeRun("git rev-parse --is-inside-work-tree");
        if (!gitCheck.ok)
            return;
        const refs = run("git for-each-ref --format='%(refname)' refs/sin-checkpoints/").split("\n").filter(Boolean);
        const cutoff = Date.now() - maxAgeHours * 3600000;
        for (const ref of refs) {
            const sessionId = ref.split("/").pop();
            const metaPath = path_1.default.join(CKPT_DIR, `${sessionId}.json`);
            try {
                const meta = JSON.parse(await promises_1.default.readFile(metaPath, "utf-8"));
                if (meta.ts < cutoff) {
                    safeRun(`git update-ref -d ${ref}`);
                    await promises_1.default.unlink(metaPath).catch(() => { });
                }
            }
            catch { }
        }
    }
    catch { }
}
//# sourceMappingURL=checkpoint-manager-v2.js.map