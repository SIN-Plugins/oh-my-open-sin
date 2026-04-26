"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSwarmPolicy = registerSwarmPolicy;
exports.enforceSwarmPolicy = enforceSwarmPolicy;
exports.processSwarmMessage = processSwarmMessage;
const telemetry_1 = require("./telemetry");
const swarm_messaging_1 = require("./swarm-messaging");
const policyStore = {};
function registerSwarmPolicy(agent, policy) {
    policyStore[agent] = policy;
    (0, telemetry_1.structuredLog)("info", "swarm_policy_registered", { agent, tools: policy.allowed_tools.length, network: policy.network });
}
function enforceSwarmPolicy(agent, action, target) {
    const policy = policyStore[agent];
    if (!policy)
        return true; // Default allow if no policy
    if (action === "tool" && target && !policy.allowed_tools.includes(target)) {
        (0, telemetry_1.structuredLog)("warn", "swarm_policy_violation", { agent, action, target, reason: "tool_not_allowed" });
        return false;
    }
    if (action === "file" && target && !policy.allowed_files.some(f => target.startsWith(f))) {
        (0, telemetry_1.structuredLog)("warn", "swarm_policy_violation", { agent, action, target, reason: "file_not_allowed" });
        return false;
    }
    if (action === "network" && policy.network === "deny") {
        (0, telemetry_1.structuredLog)("warn", "swarm_policy_violation", { agent, action, reason: "network_denied" });
        return false;
    }
    if (action === "exec" && policy.exec === "none") {
        (0, telemetry_1.structuredLog)("warn", "swarm_policy_violation", { agent, action, reason: "exec_denied" });
        return false;
    }
    return true;
}
function processSwarmMessage(msg) {
    const verified = (0, swarm_messaging_1.verifyMessage)(msg);
    (0, swarm_messaging_1.logSwarmInteraction)(msg, verified);
    if (!verified)
        return { valid: false, sanitized: {}, reason: "signature_mismatch" };
    const sanitized = (0, swarm_messaging_1.sanitizePayload)(msg.payload);
    return { valid: true, sanitized, reason: undefined };
}
//# sourceMappingURL=swarm-security.js.map