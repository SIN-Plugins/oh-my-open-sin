#!/usr/bin/env tsx
import path from "path";
import fs from "fs/promises";
import { routeTaskV2 } from "../utils/router-v2";

async function main() {
  const [,, targetPath, description, budget] = process.argv;
  if (!targetPath || !description) {
    console.log("Usage: sin-route-debug <path> <description> [budget_pct]");
    process.exit(1);
  }

  const cfgPath = path.join(process.env.HOME || "", ".config/opencode/oh-my-open-sin.json");
  const cfg = JSON.parse(await fs.readFile(cfgPath, "utf-8"));

  const decision = await routeTaskV2({
    description,
    target_paths: [targetPath],
    budget_pct: parseFloat(budget || "0"),
    breakerStates: {}, // simulate all healthy
    config: cfg
  });

  console.log(JSON.stringify(decision, null, 2));
}

// Export functions for programmatic use
export async function SinRouteDebug(args: string[] = process.argv.slice(2)) {
  const [targetPath, description, budget] = args;
  if (!targetPath || !description) {
    console.log("Usage: sin-route-debug <path> <description> [budget_pct]");
    process.exit(1);
  }

  const cfgPath = path.join(process.env.HOME || "", ".config/opencode/oh-my-open-sin.json");
  const cfg = JSON.parse(await fs.readFile(cfgPath, "utf-8"));

  const decision = await routeTaskV2({
    description,
    target_paths: [targetPath],
    budget_pct: parseFloat(budget || "0"),
    breakerStates: {},
    config: cfg
  });

  console.log(JSON.stringify(decision, null, 2));
}

export const sinRouteDebug = SinRouteDebug;

// CLI entry point
main().catch(e => { console.error("❌", e.message); process.exit(1); });
