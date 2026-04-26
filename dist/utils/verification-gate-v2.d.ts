import { UIDiffResultV2 } from "./verifier-ui-v2";
import { TestResultV2 } from "./verifier-tests-v2";
import { LSPResultV2 } from "./verifier-lsp-v2";
export interface VerificationConfigV2 {
    test_cmd?: string;
    min_coverage_delta?: number;
    max_new_lsp_errors?: number;
    max_ui_structural_score?: number;
    require_ui?: boolean;
    project_type?: "frontend" | "backend" | "fullstack" | "library";
}
export interface VerificationReportV2 {
    verified: boolean;
    score: number;
    ui: UIDiffResultV2;
    tests: TestResultV2;
    lsp: LSPResultV2;
    failures: string[];
    next_action: "pass" | "heal" | "escalate";
    cache_hit: boolean;
    ts: string;
}
export declare function runVerificationGateV2(sessionId: string, cwd: string, cfg?: VerificationConfigV2): Promise<VerificationReportV2>;
//# sourceMappingURL=verification-gate-v2.d.ts.map