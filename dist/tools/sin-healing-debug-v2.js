#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinHealingDebugV2 = void 0;
exports.sinHealingDebugV2 = sinHealingDebugV2;
const promises_1 = __importDefault(require("fs/promises"));
const failure_classifier_v2_1 = require("../utils/failure-classifier-v2");
const healing_learner_1 = require("../utils/healing-learner");
async function sinHealingDebugV2(errorFile) {
    const raw = await promises_1.default.readFile(errorFile, "utf-8");
    const analysis = (0, failure_classifier_v2_1.classifyFailureV2)(raw);
    const matrix = await (0, healing_learner_1.loadMatrix)();
    const recommended = (0, healing_learner_1.recommendStrategy)(analysis.primary_type, matrix);
    return {
        analysis,
        recommended_strategy: recommended,
        matrix_snapshot: matrix[analysis.primary_type] || {}
    };
}
class SinHealingDebugV2 {
    async run(errorFile) {
        return sinHealingDebugV2(errorFile);
    }
}
exports.SinHealingDebugV2 = SinHealingDebugV2;
async function main() {
    const [, , errorFile] = process.argv;
    if (!errorFile) {
        console.log("Usage: sin-healing-debug-v2 <error-log.txt>");
        process.exit(1);
    }
    const result = await sinHealingDebugV2(errorFile);
    console.log(JSON.stringify(result, null, 2));
}
main().catch(e => {
    console.error("❌", e.message);
    process.exit(1);
});
//# sourceMappingURL=sin-healing-debug-v2.js.map