"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeBlackboard = writeBlackboard;
exports.readBlackboard = readBlackboard;
exports.resolveConflict = resolveConflict;
exports.gcBlackboard = gcBlackboard;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const telemetry_1 = require("./telemetry");
const BLACKBOARD_DIR = path_1.default.join(process.cwd(), ".opencode", "swarm-blackboard");
const MAX_RETENTION_MS = 24 * 60 * 60 * 1000;
async function ensureDir() { await promises_1.default.mkdir(BLACKBOARD_DIR, { recursive: true }); }
function hashValue(val) {
    return (0, crypto_1.createHash)("sha256").update(JSON.stringify(val, Object.keys(val).sort())).digest("hex").slice(0, 12);
}
async function writeBlackboard(key, value, author) {
    await ensureDir();
    const filePath = path_1.default.join(BLACKBOARD_DIR, `${key}.json`);
    let version = 1;
    try {
        const raw = await promises_1.default.readFile(filePath, "utf-8");
        const existing = JSON.parse(raw);
        version = existing.version + 1;
    }
    catch { }
    const entry = { key, value, version, author, ts: Date.now(), hash: hashValue(value) };
    await promises_1.default.writeFile(filePath, JSON.stringify(entry, null, 2));
    (0, telemetry_1.structuredLog)("info", "blackboard_written", { key, version, author });
    return entry;
}
async function readBlackboard(key) {
    await ensureDir();
    const filePath = path_1.default.join(BLACKBOARD_DIR, `${key}.json`);
    try {
        const raw = await promises_1.default.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function resolveConflict(key, newValue, author) {
    const existing = await readBlackboard(key);
    if (!existing)
        return writeBlackboard(key, newValue, author);
    // Last-writer-wins with version bump + audit trail
    const merged = { ...existing.value, ...newValue };
    return writeBlackboard(key, merged, author);
}
async function gcBlackboard() {
    await ensureDir();
    const cutoff = Date.now() - MAX_RETENTION_MS;
    const files = await promises_1.default.readdir(BLACKBOARD_DIR).catch(() => []);
    let removed = 0;
    for (const f of files) {
        try {
            const p = path_1.default.join(BLACKBOARD_DIR, f);
            const stat = await promises_1.default.stat(p);
            if (stat.mtimeMs < cutoff) {
                await promises_1.default.unlink(p);
                removed++;
            }
        }
        catch { }
    }
    (0, telemetry_1.structuredLog)("info", "blackboard_gc", { removed });
    return removed;
}
//# sourceMappingURL=swarm-memory.js.map