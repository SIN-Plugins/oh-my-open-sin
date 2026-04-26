export type FailureType = "syntax" | "type" | "test" | "runtime" | "merge" | "dependency" | "quota" | "lsp" | "flaky_test" | "unknown";
export type RootCause = "code_error" | "env_missing" | "dep_mismatch" | "test_assertion" | "merge_conflict" | "rate_limit" | "tool_failure" | "unknown";
export interface FailureAnalysis {
    types: FailureType[];
    primary_type: FailureType;
    root_cause: RootCause;
    confidence: number;
    is_flaky: boolean;
    hint: string;
    error_snippet: string;
    lsp_diagnostics?: {
        file: string;
        line: number;
        message: string;
    }[];
}
export declare function classifyFailureV2(errorOutput: string, exitCode?: number, lspOutput?: string): FailureAnalysis;
//# sourceMappingURL=failure-classifier-v2.d.ts.map