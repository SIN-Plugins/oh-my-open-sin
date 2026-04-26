#!/usr/bin/env tsx
/**
 * Skill Management CLI
 * Commands: list, validate, doctor
 */

import fs from "fs/promises";
import path from "path";
import { discoverSkills } from "../utils/skill-loader.js";

const SKILL_DIRS = [
  path.join(process.env.HOME || "", ".config", "opencode", "skills"),
  path.join(process.cwd(), ".opencode", "skills")
];

async function list() {
  const skills = await discoverSkills(true);
  console.log(`📦 ${skills.length} skills discovered:`);
  for (const s of skills) {
    console.log(`  ✅ ${s.id} v${s.version} | triggers: ${s.triggers.slice(0, 3).join(", ")}...`);
  }
}

async function validate(dir: string) {
  const manifestPath = path.join(dir, "skill.json");
  try {
    const raw = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
    const { validateSkillManifest } = await import("../utils/skill-schema.js");
    validateSkillManifest(raw);
    console.log(`✅ ${dir} valid`);
  } catch (e: any) {
    console.error(`❌ ${dir} invalid: ${e.message}`);
    process.exit(1);
  }
}

async function doctor() {
  console.log("🔍 Skill System Doctor");
  
  for (const dir of SKILL_DIRS) {
    const exists = await fs.stat(dir).catch(() => null);
    console.log(`  📁 ${dir}: ${exists ? "found" : "missing"}`);
  }
  
  const skills = await discoverSkills(true);
  console.log(`  🧩 Loaded: ${skills.length}`);
  
  const invalid = [];
  for (const dir of SKILL_DIRS) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          try {
            await validate(path.join(dir, e.name));
          } catch {
            invalid.push(path.join(dir, e.name));
          }
        }
      }
    } catch {}
  }
  
  if (invalid.length > 0) {
    console.log(`⚠️  Invalid skills found: ${invalid.length}`);
  }
  
  console.log("✅ Doctor complete.");
}

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
