"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyIntent = classifyIntent;
const telemetry_1 = require("./telemetry");
const INTENT_WEIGHTS = {
    "architect": { category: "architecture", weight: 3 },
    "system design": { category: "architecture", weight: 3 },
    "pipeline": { category: "architecture", weight: 2 },
    "scale": { category: "architecture", weight: 2 },
    "security": { category: "security", weight: 3 },
    "audit": { category: "security", weight: 3 },
    "vulnerability": { category: "security", weight: 3 },
    "secret": { category: "security", weight: 2 },
    "refactor": { category: "refactor", weight: 3 },
    "rename": { category: "refactor", weight: 2 },
    "rewrite": { category: "refactor", weight: 2 },
    "clean up": { category: "refactor", weight: 2 },
    "research": { category: "research", weight: 3 },
    "explore": { category: "research", weight: 3 },
    "find api": { category: "research", weight: 2 },
    "docs": { category: "research", weight: 2 },
    "ui": { category: "frontend", weight: 3 },
    "frontend": { category: "frontend", weight: 3 },
    "css": { category: "frontend", weight: 2 },
    "component": { category: "frontend", weight: 2 },
    "backend": { category: "backend", weight: 3 },
    "api": { category: "backend", weight: 2 },
    "middleware": { category: "backend", weight: 2 },
    "database": { category: "database", weight: 3 },
    "schema": { category: "database", weight: 3 },
    "migration": { category: "database", weight: 2 },
    "prisma": { category: "database", weight: 2 },
    "deploy": { category: "devops", weight: 3 },
    "ci/cd": { category: "devops", weight: 3 },
    "docker": { category: "devops", weight: 2 },
    "test": { category: "testing", weight: 3 },
    "spec": { category: "testing", weight: 3 },
    "coverage": { category: "testing", weight: 2 },
    "fix typo": { category: "quick_fix", weight: 3 },
    "update comment": { category: "quick_fix", weight: 2 },
    "bump version": { category: "quick_fix", weight: 2 }
};
function classifyIntent(description) {
    const lower = description.toLowerCase();
    const scores = {
        architecture: 0, security: 0, refactor: 0, research: 0, frontend: 0,
        backend: 0, database: 0, devops: 0, testing: 0, quick_fix: 0, unknown: 0
    };
    const matched = [];
    for (const [term, cfg] of Object.entries(INTENT_WEIGHTS)) {
        if (lower.includes(term)) {
            scores[cfg.category] += cfg.weight;
            matched.push(term);
        }
    }
    // N-gram boost for compound intents
    if (lower.includes("auth") && lower.includes("system"))
        scores.security += 2;
    if (lower.includes("state") && lower.includes("management"))
        scores.frontend += 2;
    if (lower.includes("query") && lower.includes("optimization"))
        scores.database += 2;
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const category = best[1] > 0 ? best[0] : "unknown";
    (0, telemetry_1.structuredLog)("info", "intent_classified", { description: description.slice(0, 80), category, score: best[1], matched_terms: matched });
    return { category, score: best[1], matched_terms: matched };
}
//# sourceMappingURL=intent-classifier.js.map