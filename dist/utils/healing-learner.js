"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMatrix = loadMatrix;
exports.updateMatrix = updateMatrix;
exports.recommendStrategy = recommendStrategy;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const telemetry_1 = require("./telemetry");
const MATRIX_FILE = path_1.default.join(process.cwd(), ".opencode", "healing-matrix.json");
async function loadMatrix() {
    try {
        const raw = await promises_1.default.readFile(MATRIX_FILE, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
async function updateMatrix(failureType, strategy, success) {
    const matrix = await loadMatrix();
    if (!matrix[failureType])
        matrix[failureType] = {};
    if (!matrix[failureType][strategy])
        matrix[failureType][strategy] = { attempts: 0, successes: 0, success_rate: 0, last_used: 0 };
    const entry = matrix[failureType][strategy];
    entry.attempts++;
    if (success)
        entry.successes++;
    entry.success_rate = entry.successes / entry.attempts;
    entry.last_used = Date.now();
    await promises_1.default.writeFile(MATRIX_FILE, JSON.stringify(matrix, null, 2));
    (0, telemetry_1.structuredLog)("info", "healing_matrix_updated", { failure_type: failureType, strategy, success, rate: entry.success_rate });
}
function recommendStrategy(failureType, matrix) {
    const strategies = matrix[failureType] || {};
    const entries = Object.entries(strategies).filter(([, v]) => v.attempts >= 2);
    if (entries.length === 0)
        return "lsp_auto_fix"; // default
    entries.sort((a, b) => b[1].success_rate - a[1].success_rate);
    return entries[0][0];
}
//# sourceMappingURL=healing-learner.js.map