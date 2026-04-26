#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sinRouteDebug = void 0;
exports.SinRouteDebug = SinRouteDebug;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const router_v2_1 = require("../utils/router-v2");
async function main() {
    const [, , targetPath, description, budget] = process.argv;
    if (!targetPath || !description) {
        console.log("Usage: sin-route-debug <path> <description> [budget_pct]");
        process.exit(1);
    }
    const cfgPath = path_1.default.join(process.env.HOME || "", ".config/opencode/oh-my-open-sin.json");
    const cfg = JSON.parse(await promises_1.default.readFile(cfgPath, "utf-8"));
    const decision = await (0, router_v2_1.routeTaskV2)({
        description,
        target_paths: [targetPath],
        budget_pct: parseFloat(budget || "0"),
        breakerStates: {}, // simulate all healthy
        config: cfg
    });
    console.log(JSON.stringify(decision, null, 2));
}
// Export functions for programmatic use
async function SinRouteDebug(args = process.argv.slice(2)) {
    const [targetPath, description, budget] = args;
    if (!targetPath || !description) {
        console.log("Usage: sin-route-debug <path> <description> [budget_pct]");
        process.exit(1);
    }
    const cfgPath = path_1.default.join(process.env.HOME || "", ".config/opencode/oh-my-open-sin.json");
    const cfg = JSON.parse(await promises_1.default.readFile(cfgPath, "utf-8"));
    const decision = await (0, router_v2_1.routeTaskV2)({
        description,
        target_paths: [targetPath],
        budget_pct: parseFloat(budget || "0"),
        breakerStates: {},
        config: cfg
    });
    console.log(JSON.stringify(decision, null, 2));
}
exports.sinRouteDebug = SinRouteDebug;
// CLI entry point
main().catch(e => { console.error("❌", e.message); process.exit(1); });
//# sourceMappingURL=sin-route-debug.js.map