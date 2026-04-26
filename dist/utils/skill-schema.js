"use strict";
/**
 * Strict Skill Schema & Runtime Validator
 * Enterprise-grade validation for skill manifests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSkillManifest = validateSkillManifest;
function validateSkillManifest(raw) {
    const errors = [];
    if (!raw?.id || typeof raw.id !== "string") {
        errors.push("Missing/invalid id");
    }
    if (!raw?.name || typeof raw.name !== "string") {
        errors.push("Missing/invalid name");
    }
    if (!raw?.version || !/^\d+\.\d+\.\d+$/.test(raw.version)) {
        errors.push("Invalid version (must be semver)");
    }
    if (!Array.isArray(raw?.triggers) || raw.triggers.length === 0) {
        errors.push("triggers must be non-empty array");
    }
    if (!Array.isArray(raw?.agents)) {
        errors.push("agents must be array");
    }
    if (raw.mcp_servers && typeof raw.mcp_servers !== "object") {
        errors.push("mcp_servers must be object");
    }
    if (raw.permissions) {
        const p = raw.permissions;
        if (p.fs && !["read", "write", "deny"].includes(p.fs)) {
            errors.push("Invalid fs permission");
        }
        if (p.network && !["allow", "deny"].includes(p.network)) {
            errors.push("Invalid network permission");
        }
        if (p.exec && !["sandbox", "none"].includes(p.exec)) {
            errors.push("Invalid exec permission");
        }
    }
    if (errors.length > 0) {
        throw new Error(`❌ Skill ${raw?.id || "unknown"} invalid: ${errors.join(", ")}`);
    }
    return raw;
}
//# sourceMappingURL=skill-schema.js.map