#!/usr/bin/env tsx
import { runVerificationGateV2, type VerificationReportV2 } from "../utils/verification-gate-v2";

export async function sinVerifyDebug(sessionId?: string, testCmd?: string, projectType?: string): Promise<VerificationReportV2 | null> {
  const sid = sessionId || process.argv[2];
  if (!sid) { 
    console.log("Usage: sin-verify-debug <sessionId> [testCmd] [projectType]"); 
    return null;
  }
  
  return await runVerificationGateV2(sid, process.cwd(), {
    test_cmd: testCmd || process.argv[3] || "npm test",
    min_coverage_delta: -5,
    max_new_lsp_errors: 0,
    max_ui_structural_score: 0.4,
    require_ui: false,
    project_type: (projectType || process.argv[4] || "fullstack") as any
  });
}

export class SinVerifyDebug {
  async run(sessionId: string, testCmd?: string, projectType?: string): Promise<VerificationReportV2 | null> {
    return sinVerifyDebug(sessionId, testCmd, projectType);
  }
}

async function main() {
  const report = await sinVerifyDebug();
  if (report) console.log(JSON.stringify(report, null, 2));
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
