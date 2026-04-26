#!/usr/bin/env tsx
"use strict";
/**
 * Skill Management CLI
 * Commands: list, validate, doctor
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sinSkillsCLI = void 0;
exports.SinSkillsCLI = SinSkillsCLI;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const skill_loader_js_1 = require("../utils/skill-loader.js");
const SKILL_DIRS = [
    path_1.default.join(process.env.HOME || "", ".config", "opencode", "skills"),
    path_1.default.join(process.cwd(), ".opencode", "skills")
];
async function list() {
    const skills = await (0, skill_loader_js_1.discoverSkills)(true);
    console.log(`📦 ${skills.length} skills discovered:`);
    for (const s of skills) {
        console.log(`  ✅ ${s.id} v${s.version} | triggers: ${s.triggers.slice(0, 3).join(", ")}...`);
    }
}
async function validate(dir) {
    const manifestPath = path_1.default.join(dir, "skill.json");
    try {
        const raw = JSON.parse(await promises_1.default.readFile(manifestPath, "utf-8"));
        const { validateSkillManifest } = await import("../utils/skill-schema.js");
        validateSkillManifest(raw);
        console.log(`✅ ${dir} valid`);
    }
    catch (e) {
        console.error(`❌ ${dir} invalid: ${e.message}`);
        process.exit(1);
    }
}
async function doctor() {
    console.log("🔍 Skill System Doctor");
    for (const dir of SKILL_DIRS) {
        const exists = await promises_1.default.stat(dir).catch(() => null);
        console.log(`  📁 ${dir}: ${exists ? "found" : "missing"}`);
    }
    const skills = await (0, skill_loader_js_1.discoverSkills)(true);
    console.log(`  🧩 Loaded: ${skills.length}`);
    const invalid = [];
    for (const dir of SKILL_DIRS) {
        try {
            const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
                if (e.isDirectory()) {
                    try {
                        await validate(path_1.default.join(dir, e.name));
                    }
                    catch {
                        invalid.push(path_1.default.join(dir, e.name));
                    }
                }
            }
        }
        catch { }
    }
    if (invalid.length > 0) {
        console.log(`⚠️  Invalid skills found: ${invalid.length}`);
    }
    console.log("✅ Doctor complete.");
}
// Export functions for programmatic use
async function SinSkillsCLI(args = process.argv.slice(2)) {
    const cmd = args[0];
    switch (cmd) {
        case "list":
            await list();
            break;
        case "validate":
            await validate(args[1] || ".");
            break;
        case "doctor":
            await doctor();
            break;
        default:
            console.log("Usage: sin-skills <list|validate|doctor> [path]");
            process.exit(1);
    }
}
exports.sinSkillsCLI = SinSkillsCLI;
// CLI entry point
const cmd = process.argv[2];
switch (cmd) {
    case "list":
        list();
        break;
    case "validate":
        validate(process.argv[3] || ".");
        break;
    case "doctor":
        doctor();
        break;
    default:
        console.log("Usage: sin-skills <list|validate|doctor> [path]");
        process.exit(1);
}
//# sourceMappingURL=sin-skills.js.map