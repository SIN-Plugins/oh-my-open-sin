export interface LSPResultV2 {
    clean: boolean;
    new_errors: number;
    total_errors: number;
    warnings: number;
    files: string[];
    regression_blocked: boolean;
}
export declare function runLSPV2(cwd?: string, baselineDir?: string): Promise<LSPResultV2>;
//# sourceMappingURL=verifier-lsp-v2.d.ts.map