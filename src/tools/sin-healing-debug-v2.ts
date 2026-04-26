#!/usr/bin/env tsx
import fs from "fs/promises";
import { classifyFailureV2 } from "../utils/failure-classifier-v2";
import { loadMatrix, recommendStrategy } from "../utils/healing-learner";

export async function sinHealingDebugV2(errorFile: string) {
  const raw = await fs.readFile(errorFile, "utf-8");
  const analysis = classifyFailureV2(raw);
  const matrix = await loadMatrix();
  const recommended = recommendStrategy(analysis.primary_type, matrix);
  
  return { 
    analysis, 
    recommended_strategy: recommended, 
    matrix_snapshot: matrix[analysis.primary_type] || {} 
  };
}

export class SinHealingDebugV2 {
  async run(errorFile: string) {
    return sinHealingDebugV2(errorFile);
  }
}

async function main() {
  const [,, errorFile] = process.argv;
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
