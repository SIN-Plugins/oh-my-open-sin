"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareResume = prepareResume;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const telemetry_1 = require("./telemetry");
const checkpoint_storage_1 = require("./checkpoint-storage");
async function prepareResume(sessionId) {
    const state = await (0, checkpoint_storage_1.loadCheckpoint)(sessionId);
    if (!state) {
        return { restored: false, session_id: sessionId, phase: "unknown", injected_context: "", metadata: {}, warnings: ["Checkpoint not found"] };
    }
    const warnings = [];
    let context = `🔄 RESUMING FROM CHECKPOINT (${new Date(state.timestamp).toISOString()})\nPhase: ${state.phase}\nAgent: ${state.agent}\nModel: ${state.model}\nOriginal Task: ${state.description}\n`;
    if (state.routing_context) {
        context += `\n🎯 Routing Context: ${JSON.stringify(state.routing_context, null, 2)}\n`;
    }
    if (state.verification_state) {
        context += `\n🔍 Verification State: Score ${state.verification_state.score || "N/A"} | Failures: ${(state.verification_state.failures || []).join(", ") || "none"}\n`;
    }
    if (state.healing_state) {
        context += `\n🩹 Healing State: Attempt ${state.healing_state.attempt || 0}/${state.healing_state.max_attempts || 3} | Strategy: ${state.healing_state.last_strategy || "none"}\n`;
    }
    if (state.active_skills?.length) {
        context += `\n🧩 Active Skills: ${state.active_skills.join(", ")}\n`;
    }
    if (state.pending_tasks?.length) {
        context += `\n⏳ Pending Tasks: ${state.pending_tasks.join("\n- ")}\n`;
    }
    // Restore file deltas if present
    if (state.file_deltas && Object.keys(state.file_deltas).length > 0) {
        for (const [file, delta] of Object.entries(state.file_deltas)) {
            try {
                const fullPath = path_1.default.join(process.cwd(), file);
                await promises_1.default.mkdir(path_1.default.dirname(fullPath), { recursive: true });
                if (delta.content)
                    await promises_1.default.writeFile(fullPath, delta.content, "utf-8");
            }
            catch (e) {
                warnings.push(`Failed to restore ${file}: ${e.message}`);
            }
        }
    }
    const metadata = {
        plugin: "oh-my-open-sin",
        resumed_from: sessionId,
        phase: state.phase,
        routing_agent: state.agent,
        routing_model: state.model,
        ...state.metadata,
        checkpoint_restored: true
    };
    (0, telemetry_1.structuredLog)("info", "resume_prepared", { session_id: sessionId, phase: state.phase, warnings: warnings.length });
    return { restored: true, session_id: sessionId, phase: state.phase, injected_context: context, metadata, warnings };
}
//# sourceMappingURL=checkpoint-resume.js.map