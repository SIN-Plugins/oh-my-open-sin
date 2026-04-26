#!/usr/bin/env tsx
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinResumeCLI = SinResumeCLI;
exports.sinResumeCLI = sinResumeCLI;
const checkpoint_storage_1 = require("../utils/checkpoint-storage");
const checkpoint_resume_1 = require("../utils/checkpoint-resume");
async function SinResumeCLI(cmd, arg) {
    if (cmd === "list") {
        const entries = await (0, checkpoint_storage_1.listCheckpoints)();
        console.log(`📦 ${entries.length} checkpoints:`);
        for (const e of entries) {
            console.log(`  ${e.id} | ${e.phase} | ${new Date(e.ts).toISOString()} | ${(e.size / 1024).toFixed(1)}KB`);
        }
        return entries;
    }
    if (cmd === "show" && arg) {
        const state = await (0, checkpoint_storage_1.loadCheckpoint)(arg);
        if (!state) {
            console.log("❌ Not found");
            throw new Error("Checkpoint not found");
        }
        console.log(JSON.stringify(state, null, 2));
        return state;
    }
    if (cmd === "resume" && arg) {
        const payload = await (0, checkpoint_resume_1.prepareResume)(arg);
        console.log(JSON.stringify(payload, null, 2));
        return payload;
    }
    throw new Error("Usage: sin-resume <list|show|resume> [session_id]");
}
async function sinResumeCLI(cmd, arg) {
    return SinResumeCLI(cmd, arg);
}
async function main() {
    const [, , cmd, arg] = process.argv;
    try {
        await SinResumeCLI(cmd, arg);
    }
    catch (e) {
        console.error("❌", e.message);
        process.exit(1);
    }
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
//# sourceMappingURL=sin-resume.js.map