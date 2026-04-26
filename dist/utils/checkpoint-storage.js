"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCheckpoint = saveCheckpoint;
exports.loadCheckpoint = loadCheckpoint;
exports.listCheckpoints = listCheckpoints;
exports.cleanupStaleCheckpoints = cleanupStaleCheckpoints;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const telemetry_1 = require("./telemetry");
const checkpoint_state_1 = require("./checkpoint-state");
const CKPT_DIR = path_1.default.join(process.cwd(), ".opencode", "checkpoints", "state");
const MAX_RETENTION = 14 * 24 * 60 * 60 * 1000; // 14 days
async function ensureDir() {
    await promises_1.default.mkdir(CKPT_DIR, { recursive: true });
}
async function saveCheckpoint(state) {
    await ensureDir();
    const id = state.session_id;
    const json = (0, checkpoint_state_1.serializeState)(state);
    const tmpPath = path_1.default.join(CKPT_DIR, `${id}.json.tmp`);
    const finalPath = path_1.default.join(CKPT_DIR, `${id}.json`);
    await promises_1.default.writeFile(tmpPath, json, "utf-8");
    await promises_1.default.rename(tmpPath, finalPath);
    (0, telemetry_1.structuredLog)("info", "state_checkpoint_saved", { session_id: id, phase: state.phase, size_bytes: Buffer.byteLength(json) });
    return id;
}
async function loadCheckpoint(sessionId) {
    await ensureDir();
    const filePath = path_1.default.join(CKPT_DIR, `${sessionId}.json`);
    try {
        const raw = await promises_1.default.readFile(filePath, "utf-8");
        return (0, checkpoint_state_1.deserializeState)(raw);
    }
    catch (e) {
        if (e.code === "ENOENT")
            return null;
        (0, telemetry_1.structuredLog)("warn", "state_checkpoint_load_failed", { session_id: sessionId, error: e.message });
        return null;
    }
}
async function listCheckpoints() {
    await ensureDir();
    const files = await promises_1.default.readdir(CKPT_DIR).catch(() => []);
    const entries = [];
    for (const f of files.filter(f => f.endsWith(".json"))) {
        try {
            const raw = await promises_1.default.readFile(path_1.default.join(CKPT_DIR, f), "utf-8");
            const state = JSON.parse(raw);
            entries.push({ id: state.session_id, phase: state.phase, ts: state.timestamp, size: Buffer.byteLength(raw) });
        }
        catch { }
    }
    return entries.sort((a, b) => b.ts - a.ts);
}
async function cleanupStaleCheckpoints() {
    await ensureDir();
    const cutoff = Date.now() - MAX_RETENTION;
    const files = await promises_1.default.readdir(CKPT_DIR).catch(() => []);
    let removed = 0;
    for (const f of files) {
        try {
            const p = path_1.default.join(CKPT_DIR, f);
            const stat = await promises_1.default.stat(p);
            if (stat.mtimeMs < cutoff) {
                await promises_1.default.unlink(p);
                removed++;
            }
        }
        catch { }
    }
    (0, telemetry_1.structuredLog)("info", "state_checkpoints_cleaned", { removed });
    return removed;
}
//# sourceMappingURL=checkpoint-storage.js.map