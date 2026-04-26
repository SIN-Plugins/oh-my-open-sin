#!/usr/bin/env tsx
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinVerifyDebug = void 0;
exports.sinVerifyDebug = sinVerifyDebug;
const verification_gate_v2_1 = require("../utils/verification-gate-v2");
async function sinVerifyDebug(sessionId, testCmd, projectType) {
    const sid = sessionId || process.argv[2];
    if (!sid) {
        console.log("Usage: sin-verify-debug <sessionId> [testCmd] [projectType]");
        return null;
    }
    return await (0, verification_gate_v2_1.runVerificationGateV2)(sid, process.cwd(), {
        test_cmd: testCmd || process.argv[3] || "npm test",
        min_coverage_delta: -5,
        max_new_lsp_errors: 0,
        max_ui_structural_score: 0.4,
        require_ui: false,
        project_type: (projectType || process.argv[4] || "fullstack")
    });
}
class SinVerifyDebug {
    async run(sessionId, testCmd, projectType) {
        return sinVerifyDebug(sessionId, testCmd, projectType);
    }
}
exports.SinVerifyDebug = SinVerifyDebug;
async function main() {
    const report = await sinVerifyDebug();
    if (report)
        console.log(JSON.stringify(report, null, 2));
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
//# sourceMappingURL=sin-verify-debug.js.map