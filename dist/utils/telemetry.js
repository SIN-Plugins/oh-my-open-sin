"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.structuredLog = structuredLog;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const TELEMETRY_LOG = path_1.default.join(process.env.HOME || "", ".config/opencode/logs/telemetry.jsonl");
async function structuredLog(level, msg, data = {}) {
    const event = {
        level,
        msg,
        timestamp: new Date().toISOString(),
        ...data
    };
    try {
        await promises_1.default.mkdir(path_1.default.dirname(TELEMETRY_LOG), { recursive: true });
        await promises_1.default.appendFile(TELEMETRY_LOG, JSON.stringify(event) + "\n");
    }
    catch (e) {
        console.error(`[telemetry] Failed to write log: ${e.message}`);
    }
}
//# sourceMappingURL=telemetry.js.map